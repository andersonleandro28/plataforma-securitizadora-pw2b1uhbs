-- Correção da função revert_ccb_installment_liquidation
-- Corrige o erro "operator does not exist: uuid = text" (code 42883)
-- Causa: origem_id em mapeamento_movimentacoes é UUID, mas a query comparava com string concatenada (v_rec.id::text || '-bol-' || idx)
-- Além disso, aceitamos tanto UUID quanto TEXT em p_recebivel_id com cast seguro para UUID em todas as operações.

CREATE OR REPLACE FUNCTION public.revert_ccb_installment_liquidation(
  p_recebivel_id TEXT,
  p_installment_idx INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recebivel_uuid UUID;
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
  -- Validar formato do UUID
  BEGIN
    v_recebivel_uuid := p_recebivel_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID do recebível inválido: %', p_recebivel_id;
  END;

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
  SELECT * INTO v_rec FROM public.recebiveis_ccb WHERE id = v_recebivel_uuid;
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
  WHERE id = v_recebivel_uuid;

  -- Por garantia explícita (idempotência), deleta a transação correspondente em treasury_transactions
  v_ext_ref := 'ccb-bol-' || v_recebivel_uuid::text || '-' || (p_installment_idx + 1);
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;

  -- Se existirem lançamentos em mapeamento_movimentacoes para este recebível (origem_id UUID)
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela = 'ccb' AND origem_id = v_recebivel_uuid;

  -- Se existirem lançamentos em movimentacoes_caixa correspondentes
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_recebivel_uuid
    AND categoria IN ('liquidação_recebível', 'pagamento_ccb')
    AND descricao ILIKE ('%' || (p_installment_idx + 1) || '%');

  -- Registrar no audit_log
  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome
  FROM public.profiles WHERE id = v_rec.tomador_id;

  INSERT INTO public.audit_logs (entity_type, entity_id, action, details)
  VALUES (
    'recebiveis_ccb',
    v_recebivel_uuid,
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
    'recebivel_id', v_recebivel_uuid,
    'installment_idx', p_installment_idx,
    'boletos', v_new_boletos
  );
END;
$$;

-- Sobrecarga com UUID para compatibilidade com chamadas tipadas como UUID
CREATE OR REPLACE FUNCTION public.revert_ccb_installment_liquidation(
  p_recebivel_id UUID,
  p_installment_idx INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.revert_ccb_installment_liquidation(p_recebivel_id::text, p_installment_idx);
END;
$$;

-- Permitir execução por usuários autenticados (a validação de admin/staff está dentro da função)
GRANT EXECUTE ON FUNCTION public.revert_ccb_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_ccb_installment_liquidation(UUID, INT) TO authenticated;
