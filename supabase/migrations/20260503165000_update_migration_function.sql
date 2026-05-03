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
  v_exists boolean;
BEGIN
  -- Verifica se já existem dados para evitar erro e duplicação
  SELECT EXISTS(SELECT 1 FROM public.movimentacoes_caixa LIMIT 1) INTO v_exists;
  
  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'Os dados já foram migrados anteriormente. Não é possível rodar a migração novamente para evitar duplicidades.');
  END IF;

  SELECT id INTO v_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;

  DELETE FROM public.mapeamento_movimentacoes WHERE id IS NOT NULL;
  DELETE FROM public.movimentacoes_caixa WHERE id IS NOT NULL;
  DELETE FROM public.saldo_caixa WHERE id IS NOT NULL;

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
         (arr.b->>'unit_value')::numeric + COALESCE((arr.b->>'interest_applied')::numeric, 0) + COALESCE((arr.b->>'penalty_applied')::numeric, 0),
         r.id, 'ccb', COALESCE((arr.b->>'payment_date')::timestamptz, r.created_at), 'ccb', md5(r.id::text || arr.idx::text)::uuid
  FROM public.recebiveis_ccb r, jsonb_array_elements(r.boletos) WITH ORDINALITY AS arr(b, idx)
  WHERE arr.b->>'status' = 'Pago' AND ((arr.b->>'unit_value')::numeric > 0);

  INSERT INTO temp_movs (tipo, categoria, descricao, valor, referencia_id, referencia_tipo, data_operacao, origem_tabela, origem_id)
  SELECT 'entrada', 'pagamento_ccb', 'Pagamento de parcela CCB', 
         (arr.i->>'value')::numeric,
         o.id, 'ccb', COALESCE((arr.i->>'payment_date')::timestamptz, o.created_at), 'ccb', md5(o.id::text || arr.idx::text)::uuid
  FROM public.operacoes_antecipacao o, jsonb_array_elements(o.installments) WITH ORDINALITY AS arr(i, idx)
  WHERE arr.i->>'status' = 'paga' AND ((arr.i->>'value')::numeric > 0);

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
    
    BEGIN
      INSERT INTO public.mapeamento_movimentacoes (movimentacao_caixa_id, origem_tabela, origem_id, sincronizado, user_id, data_sincronizacao)
      VALUES (v_mov_id, v_movs.origem_tabela, v_movs.origem_id, true, v_user_id, NOW());
    EXCEPTION WHEN OTHERS THEN
      -- Em caso da trigger check_duplicidade_mapeamento disparar, ignoramos e prosseguimos
    END;
    
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.auditoria_limpeza (acao, descricao, data, user_id)
  VALUES ('migracao_historica', 'Migração de ' || v_count || ' registros para movimentacoes_caixa', NOW(), auth.uid());

  RETURN jsonb_build_object('success', true, 'count', v_count, 'saldo_final', (SELECT saldo_atual FROM public.saldo_caixa WHERE user_id = v_user_id));
END;
$function$;
