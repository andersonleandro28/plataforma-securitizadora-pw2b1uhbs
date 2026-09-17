-- Reversão de Baixa de Parcela de CCB
-- Garante sincronização perfeita com treasury_transactions, movimentacoes_caixa e mapeamento_movimentacoes

-- 1. Atualizar a função sync_ccb_boletos_to_treasury() para garantir que parcelas que deixem de estar 'Pago'/'pago'
-- tenham o registro removido de treasury_transactions imediatamente e sem órfãos.
CREATE OR REPLACE FUNCTION public.sync_ccb_boletos_to_treasury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_boleto JSONB;
  v_ext_ref TEXT;
  v_desc TEXT;
  idx INT := 1;
  v_total NUMERIC;
  v_status TEXT;
BEGIN
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome FROM public.profiles WHERE id = NEW.tomador_id;

  IF NEW.boletos IS NOT NULL THEN
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(NEW.boletos)
    LOOP
      v_ext_ref := 'ccb-bol-' || NEW.id || '-' || idx;
      v_status := LOWER(COALESCE(v_boleto->>'status', ''));
      
      IF v_status IN ('pago', 'liquidado') THEN
        v_total := (COALESCE((v_boleto->>'unit_value')::numeric, 0) + COALESCE((v_boleto->>'interest_applied')::numeric, 0) + COALESCE((v_boleto->>'penalty_applied')::numeric, 0));
        v_desc := 'Recebimento Parcela ' || idx || ' - CCB nº ' || substr(NEW.ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
        VALUES ('in', v_total, COALESCE((v_boleto->>'payment_date')::date, (v_boleto->>'data_pagamento')::date, NOW()::date), v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref)
        ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
        SET amount = EXCLUDED.amount, date = EXCLUDED.date, description = EXCLUDED.description;
      ELSE
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END IF;
      idx := idx + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garantir o trigger em recebiveis_ccb para boletos
DROP TRIGGER IF EXISTS on_recebiveis_ccb_boletos_change ON public.recebiveis_ccb;
CREATE TRIGGER on_recebiveis_ccb_boletos_change
  AFTER UPDATE OF boletos ON public.recebiveis_ccb
  FOR EACH ROW EXECUTE FUNCTION public.sync_ccb_boletos_to_treasury();

-- 2. Função RPC segura para reverter baixa de parcela de recebíveis CCB
-- Limpa o boleto no JSONB, remove qualquer registro em treasury_transactions,
-- remove eventuais registros em movimentacoes_caixa / mapeamento_movimentacoes e registra audit_log.
CREATE OR REPLACE FUNCTION public.revert_ccb_installment_liquidation(
  p_recebivel_id UUID,
  p_installment_idx INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_rec RECORD;
  v_boletos JSONB;
  v_boleto JSONB;
  v_new_boletos JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_ext_ref TEXT;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_old_status TEXT;
  v_tomador_nome TEXT;
BEGIN
  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validar permissão (admin ou staff)
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem reverter baixas';
  END IF;

  -- Buscar o recebível
  SELECT * INTO v_rec FROM public.recebiveis_ccb WHERE id = p_recebivel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebível não encontrado';
  END IF;

  v_boletos := v_rec.boletos;
  IF v_boletos IS NULL OR jsonb_array_length(v_boletos) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no registro';
  END IF;

  -- Iterar e recriar o array com a parcela limpa
  FOR v_idx IN 0..(jsonb_array_length(v_boletos) - 1)
  LOOP
    v_boleto := v_boletos->v_idx;
    IF v_idx = p_installment_idx THEN
      v_old_status := v_boleto->>'status';
      -- Limpar status e dados de pagamento da parcela
      v_boleto := (v_boleto - 'payment_date' - 'data_pagamento' - 'data_liquidacao' - 'interest_applied' - 'penalty_applied')
                  || jsonb_build_object('status', 'Pendente');
    END IF;
    v_new_boletos := v_new_boletos || jsonb_build_array(v_boleto);
  END LOOP;

  -- Atualizar recebiveis_ccb (o trigger on_recebiveis_ccb_boletos_change cuidará do treasury_transactions)
  UPDATE public.recebiveis_ccb
  SET boletos = v_new_boletos
  WHERE id = p_recebivel_id;

  -- Por garantia explícita (idempotência), deleta a transação correspondente em treasury_transactions
  v_ext_ref := 'ccb-bol-' || p_recebivel_id || '-' || (p_installment_idx + 1);
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;

  -- Se existirem lançamentos em movimentacoes_caixa / mapeamento_movimentacoes para esta parcela / ccb
  -- Remove eventuais referências diretas
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela = 'ccb' AND origem_id = (v_rec.id::text || '-bol-' || (p_installment_idx + 1));

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_rec.id
    AND categoria IN ('liquidação_recebível', 'pagamento_ccb')
    AND descricao ILIKE ('%' || (p_installment_idx + 1) || '%');

  -- Registrar no audit_log
  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome
  FROM public.profiles WHERE id = v_rec.tomador_id;

  INSERT INTO public.audit_logs (entity_type, entity_id, action, details)
  VALUES (
    'recebiveis_ccb',
    p_recebivel_id,
    'admin_reverted_installment_liquidation',
    jsonb_build_object(
      'admin', v_user_id,
      'installment_idx', p_installment_idx,
      'parcela_numero', p_installment_idx + 1,
      'tomador', v_tomador_nome,
      'previous_status', v_old_status,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'recebivel_id', p_recebivel_id,
    'installment_idx', p_installment_idx,
    'boletos', v_new_boletos
  );
END;
$function$;

-- Permitir execução por usuários autenticados (a validação de admin/staff está dentro da função)
GRANT EXECUTE ON FUNCTION public.revert_ccb_installment_liquidation(UUID, INT) TO authenticated;
