DROP TABLE IF EXISTS public.movimentacoes_tesouraria CASCADE;
DROP TABLE IF EXISTS public.contas_tesouraria CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_escrow CASCADE;
DROP TABLE IF EXISTS public.parametros_sistema CASCADE;

-- Modify processa_movimentacao_caixa to preserve created_at for historical migrations
CREATE OR REPLACE FUNCTION public.processa_movimentacao_caixa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_saldo_atual NUMERIC(12,2);
BEGIN
  SELECT saldo_atual INTO v_saldo_atual
  FROM public.saldo_caixa
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.saldo_caixa (user_id, saldo_atual, saldo_anterior)
    VALUES (NEW.user_id, 0, 0)
    RETURNING saldo_atual INTO v_saldo_atual;
  END IF;

  IF NEW.tipo = 'saída' THEN
    NEW.saldo_anterior := v_saldo_atual;
    NEW.saldo_novo := v_saldo_atual - NEW.valor;
  ELSIF NEW.tipo = 'entrada' THEN
    NEW.saldo_anterior := v_saldo_atual;
    NEW.saldo_novo := v_saldo_atual + NEW.valor;
  END IF;

  UPDATE public.saldo_caixa
  SET saldo_anterior = v_saldo_atual,
      saldo_atual = NEW.saldo_novo,
      data_atualizacao = NOW(),
      updated_at = NOW()
  WHERE user_id = NEW.user_id;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.migrar_dados_historicos(p_saldo_inicial numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_movs RECORD;
  v_count int := 0;
  v_user_id uuid;
  v_mov_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;

  DELETE FROM public.mapeamento_movimentacoes;
  DELETE FROM public.movimentacoes_caixa;
  DELETE FROM public.saldo_caixa;

  INSERT INTO public.saldo_caixa (user_id, saldo_atual, saldo_anterior)
  VALUES (v_user_id, p_saldo_inicial, p_saldo_inicial);

  CREATE TEMP TABLE temp_movs (
    tipo text,
    categoria text,
    descricao text,
    valor numeric,
    referencia_id uuid,
    referencia_tipo text,
    data_operacao timestamptz,
    origem_tabela text,
    origem_id uuid
  ) ON COMMIT DROP;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'entrada', 'subscrição_debênture', 'Subscrição de debênture — ' || investor_name, total_amount, id, 'subscrição', created_at, 'subscrições', id
  FROM public.debenture_subscriptions
  WHERE status IN ('Ativo', 'Encerrado', 'paid') AND total_amount > 0;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'saída', 'aquisição_ccb', 'Aquisição de CCB — ' || COALESCE((SELECT pj_company_name FROM profiles WHERE id = tomador_id), 'Desconhecido'), acquisition_value, id, 'ccb', created_at, 'ccb', id
  FROM public.recebiveis_ccb WHERE acquisition_value > 0;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'saída', 'aquisição_ccb', 'Aquisição de Antecipação', net_value, id, 'ccb', created_at, 'ccb', id
  FROM public.operacoes_antecipacao WHERE net_value > 0;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'entrada', 'pagamento_ccb', 'Pagamento de parcela CCB', 
         (b.value->>'unit_value')::numeric + COALESCE((b.value->>'interest_applied')::numeric, 0) + COALESCE((b.value->>'penalty_applied')::numeric, 0),
         r.id, 'ccb', COALESCE((b.value->>'payment_date')::timestamptz, r.created_at), 'ccb', md5(r.id::text || (b.value->>'payment_date'))::uuid
  FROM public.recebiveis_ccb r, jsonb_array_elements(r.boletos) b
  WHERE b.value->>'status' = 'Pago' AND ((b.value->>'unit_value')::numeric > 0);

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'entrada', 'pagamento_ccb', 'Pagamento de parcela CCB', 
         (i.value->>'value')::numeric,
         o.id, 'ccb', COALESCE((i.value->>'payment_date')::timestamptz, o.created_at), 'ccb', md5(o.id::text || (i.value->>'payment_date'))::uuid
  FROM public.operacoes_antecipacao o, jsonb_array_elements(o.installments) i
  WHERE i.value->>'status' = 'paga' AND ((i.value->>'value')::numeric > 0);

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'entrada', 'liquidação_recebível', 'Liquidação de recebível — ' || document_number, COALESCE(liquidation_value, face_value), id, 'recebível', COALESCE(liquidation_date::timestamptz, updated_at), 'recebíveis', id
  FROM public.credit_operations
  WHERE status = 'liquidado' AND COALESCE(liquidation_value, face_value) > 0;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'saída', CASE WHEN supplier_id IS NOT NULL THEN 'fornecedor' ELSE 'despesa' END, description, amount, id, CASE WHEN supplier_id IS NOT NULL THEN 'fornecedor' ELSE 'despesa' END, COALESCE(payment_date::timestamptz, created_at), CASE WHEN supplier_id IS NOT NULL THEN 'fornecedores' ELSE 'despesas' END, id
  FROM public.expenses
  WHERE status = 'paid' AND amount > 0;

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT CASE WHEN type = 'in' THEN 'entrada' ELSE 'saída' END, 
         CASE WHEN category ILIKE '%juros%' THEN (CASE WHEN type = 'in' THEN 'juros_entrada' ELSE 'juros_saída' END)
              WHEN category ILIKE '%depósito%' THEN 'depósito'
              ELSE 'despesa' END, 
         description, amount, id, 'outro', created_at, 
         CASE WHEN category ILIKE '%juros%' THEN 'juros'
              WHEN category ILIKE '%depósito%' THEN 'depósitos'
              ELSE 'despesas' END, 
         id
  FROM public.treasury_transactions
  WHERE category ILIKE '%juros%' OR category ILIKE '%depósito%';

  FOR v_movs IN SELECT * FROM temp_movs ORDER BY data_operacao ASC
  LOOP
    INSERT INTO public.movimentacoes_caixa (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, user_id, created_at)
    VALUES (v_movs.tipo, v_movs.categoria, v_movs.descricao, v_movs.valor, v_movs.referencia_id, v_movs.referencia_tipo, v_user_id, v_movs.data_operacao)
    RETURNING id INTO v_mov_id;
    
    INSERT INTO public.mapeamento_movimentacoes (movimentacao_caixa_id, origem_tabela, origem_id, sincronizado, user_id, data_sincronizacao)
    VALUES (v_mov_id, v_movs.origem_tabela, v_movs.origem_id, true, v_user_id, NOW())
    ON CONFLICT DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.auditoria_limpeza (acao, descricao, data, user_id)
  VALUES ('migracao_historica', 'Migração de ' || v_count || ' registros para movimentacoes_caixa', NOW(), auth.uid());

  RETURN jsonb_build_object('success', true, 'count', v_count, 'saldo_final', (SELECT saldo_atual FROM public.saldo_caixa WHERE user_id = v_user_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_saldo_caixa(p_saldo_inicial numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_mov RECORD;
  v_saldo numeric := p_saldo_inicial;
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;

  DROP TRIGGER IF EXISTS trg_protect_movimentacao_core_fields ON public.movimentacoes_caixa;
  
  FOR v_mov IN SELECT id, tipo, valor FROM public.movimentacoes_caixa ORDER BY created_at ASC
  LOOP
    UPDATE public.movimentacoes_caixa
    SET saldo_anterior = v_saldo,
        saldo_novo = CASE WHEN tipo = 'entrada' THEN v_saldo + valor ELSE v_saldo - valor END
    WHERE id = v_mov.id;
    
    v_saldo := CASE WHEN v_mov.tipo = 'entrada' THEN v_saldo + v_mov.valor ELSE v_saldo - v_mov.valor END;
  END LOOP;
  
  UPDATE public.saldo_caixa
  SET saldo_atual = v_saldo, saldo_anterior = v_saldo
  WHERE user_id = v_user_id;
  
  CREATE TRIGGER trg_protect_movimentacao_core_fields
    BEFORE UPDATE ON public.movimentacoes_caixa
    FOR EACH ROW EXECUTE FUNCTION protect_movimentacao_core_fields();

  INSERT INTO public.auditoria_limpeza (acao, descricao, data, user_id)
  VALUES ('ajustar_saldo', 'Saldo inicial ajustado para ' || p_saldo_inicial || '. Novo saldo final: ' || v_saldo, NOW(), auth.uid());

  RETURN jsonb_build_object('success', true, 'saldo_final', v_saldo);
END;
$function$;
