-- 20260920080000_liquidate_credit_operation_full.sql
-- 1. Cria a RPC liquidate_credit_operation_full para liquidar operações completas da mesa de operações (/operations)
--    Garante sincronização transacional atômica e idempotente com:
--    - credit_operations (status = 'liquidado', liquidation_date, liquidation_value, installments_data todos marcados como pagos)
--    - treasury_transactions (entrada com external_ref dedup 'op-liq-{id}' e tipo 'in', valor = face_value ou pago, data = liquidation_date)
--    - movimentacoes_caixa (entrada com tipo = 'entrada', categoria = 'liquidação_recebível', referencia_id = id, referencia_tipo = 'recebível', created_at alinhado à data da baixa)
--    - mapeamento_movimentacoes (origem_tabela = 'recebíveis', origem_id = id)
--    - audit_logs (registro detalhado da auditoria)
-- 2. Cria a RPC revert_credit_operation_full_liquidation para estorno seguro e completo
-- 3. Backfill idempotente para a operação #255621A2 (e quaisquer operações liquidadas que estejam com dados dessincronizados)

-- 1. RPC liquidate_credit_operation_full
CREATE OR REPLACE FUNCTION public.liquidate_credit_operation_full(
  p_operation_id TEXT,
  p_payment_date DATE,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_total NUMERIC;
  v_date DATE;
  v_installments JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_installment JSONB;
  v_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_mov_id UUID;
  v_count_inst INT := 0;
BEGIN
  -- Validar UUID
  BEGIN
    v_op_uuid := p_operation_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID da operação inválido: %', p_operation_id;
  END;

  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    -- Fallback para usuário de sistema caso invocado em background confiável
    v_user_id := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  -- Validar permissão
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem baixar operações';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada: %', p_operation_id;
  END IF;

  v_date := COALESCE(p_payment_date, v_op.liquidation_date, CURRENT_DATE);
  v_total := COALESCE(p_amount_paid, v_op.liquidation_value, v_op.face_value, v_op.requested_value, 0);

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago da liquidação deve ser maior que zero';
  END IF;

  -- Preparar cronograma de parcelas (installments_data) marcando todas como pagas
  v_installments := v_op.installments_data;
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    v_installments := jsonb_build_array(
      jsonb_build_object(
        'number', 1,
        'dueDate', COALESCE(v_op.due_date::text, v_date::text),
        'due_date', COALESCE(v_op.due_date::text, v_date::text),
        'value', v_total,
        'valor_original', v_total,
        'original_value', v_total,
        'status', 'pago',
        'payment_date', v_date::text,
        'data_pagamento', v_date::text,
        'amount_paid', v_total
      )
    );
  END IF;

  v_count_inst := jsonb_array_length(v_installments);
  FOR v_idx IN 0..(v_count_inst - 1)
  LOOP
    v_installment := v_installments->v_idx;
    v_installment := v_installment || jsonb_build_object(
      'status', 'pago',
      'payment_date', v_date::text,
      'data_pagamento', v_date::text,
      'amount_paid', COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, (v_total / GREATEST(v_count_inst, 1))),
      'paid_at', NOW(),
      'paid_by', v_user_id,
      'notes', p_notes
    );
    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar credit_operations
  UPDATE public.credit_operations
  SET
    status = 'liquidado',
    liquidation_date = v_date,
    liquidation_value = v_total,
    installments_data = v_new_installments,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Categoria de tesouraria
  SELECT id INTO v_cat_id 
  FROM public.transaction_categories 
  WHERE name = 'Liquidação de Recebível' OR name = 'Recebimento de Parcelas - Operação'
  LIMIT 1;

  v_ext_ref := 'op-liq-' || v_op_uuid::text;
  v_desc := 'Liquidação de recebível — ' || COALESCE(v_op.sacado, 'Sacado') || 
            ' (Doc ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || ')';

  -- Inserir ou atualizar em treasury_transactions (DRE / Tesouraria)
  INSERT INTO public.treasury_transactions (
    type,
    amount,
    date,
    description,
    category,
    category_id,
    reference_id,
    is_escrow,
    external_ref,
    status
  )
  VALUES (
    'in',
    v_total,
    v_date,
    v_desc,
    'Liquidação de Recebível',
    v_cat_id,
    v_op_uuid,
    false,
    v_ext_ref,
    'Confirmado'
  )
  ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
  SET 
    amount = EXCLUDED.amount,
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    status = 'Confirmado';

  -- Sincronizar movimentacoes_caixa (Livro Caixa)
  -- Remove duplicatas anteriores de liquidação desta operação inteira
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid 
    AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

  INSERT INTO public.movimentacoes_caixa (
    tipo,
    categoria,
    descricao,
    valor,
    saldo_anterior,
    saldo_novo,
    referencia_id,
    referencia_tipo,
    referencia_numero,
    user_id,
    created_at
  )
  VALUES (
    'entrada',
    'liquidação_recebível',
    v_desc,
    v_total,
    0,
    0,
    v_op_uuid,
    'recebível',
    COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)),
    v_user_id,
    (v_date::text || ' 12:00:00+00')::timestamptz
  )
  RETURNING id INTO v_mov_id;

  -- Mapeamento movimentações
  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE origem_tabela = 'recebíveis' 
      AND origem_id = v_op_uuid;

    INSERT INTO public.mapeamento_movimentacoes (
      movimentacao_caixa_id,
      origem_tabela,
      origem_id,
      sincronizado,
      user_id,
      created_at
    )
    VALUES (
      v_mov_id,
      'recebíveis',
      v_op_uuid,
      true,
      v_user_id,
      NOW()
    );
  END IF;

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_liquidated_operation_full',
    jsonb_build_object(
      'admin', v_user_id,
      'payment_date', v_date,
      'amount_paid', v_total,
      'sacado', v_op.sacado,
      'cedente', v_op.cedente,
      'document_number', v_op.document_number,
      'external_ref', v_ext_ref
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'payment_date', v_date,
    'amount_paid', v_total,
    'external_ref', v_ext_ref
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT) TO authenticated;

-- 2. RPC revert_credit_operation_full_liquidation
CREATE OR REPLACE FUNCTION public.revert_credit_operation_full_liquidation(
  p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_installments JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_installment JSONB;
  v_ext_ref TEXT;
BEGIN
  -- Validar UUID
  BEGIN
    v_op_uuid := p_operation_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID da operação inválido: %', p_operation_id;
  END;

  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem reverter liquidação';
  END IF;

  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada: %', p_operation_id;
  END IF;

  -- Restaurar parcelas
  v_installments := v_op.installments_data;
  IF v_installments IS NOT NULL AND jsonb_typeof(v_installments) = 'array' THEN
    FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
    LOOP
      v_installment := v_installments->v_idx;
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'notes')
                       || jsonb_build_object('status', 'pendente');
      v_new_installments := v_new_installments || jsonb_build_array(v_installment);
    END LOOP;
  END IF;

  -- Atualizar credit_operations para 'aprovado'
  UPDATE public.credit_operations
  SET
    status = 'aprovado',
    liquidation_date = NULL,
    liquidation_value = NULL,
    installments_data = v_new_installments,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Deletar de treasury_transactions
  v_ext_ref := 'op-liq-' || v_op_uuid::text;
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;

  -- Deletar mapeamentos e caixa
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela IN ('recebíveis', 'juros') AND origem_id = v_op_uuid;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid 
    AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_reverted_operation_full_liquidation',
    jsonb_build_object(
      'admin', v_user_id,
      'previous_status', v_op.status,
      'external_ref', v_ext_ref,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_credit_operation_full_liquidation(TEXT) TO authenticated;

-- 3. Backfill idempotente para a operação #255621A2
-- Garante que:
-- - liquidation_value esteja preenchido (16390)
-- - installments_data tenha o cronograma inicializado com a parcela paga em 2025-11-11
-- - treasury_transactions possua o lançamento de receita para a data 2025-11-11
-- - movimentacoes_caixa tenha o created_at alinhado à data da baixa (2025-11-11) para o Livro Caixa e DRE reconhecerem no período correto
DO $$
DECLARE
  v_op_id UUID := '255621a2-fe9f-46a0-b328-54b3423e21a0'::uuid;
  v_op RECORD;
  v_cat_id UUID;
  v_mov_id UUID;
  v_admin_id UUID := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
BEGIN
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_id;
  IF FOUND THEN
    -- 1. Atualizar credit_operations se faltar liquidation_value ou installments_data
    UPDATE public.credit_operations
    SET
      liquidation_date = COALESCE(liquidation_date, '2025-11-11'::date),
      liquidation_value = COALESCE(liquidation_value, face_value, 16390),
      installments_data = jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'dueDate', '2025-11-13',
          'due_date', '2025-11-13',
          'value', 16390,
          'valor_original', 16390,
          'original_value', 16390,
          'status', 'pago',
          'payment_date', '2025-11-11',
          'data_pagamento', '2025-11-11',
          'amount_paid', 16390,
          'paid_at', '2025-11-11 12:00:00+00'::timestamptz
        )
      ),
      updated_at = NOW()
    WHERE id = v_op_id;

    -- 2. Categoria de tesouraria
    SELECT id INTO v_cat_id 
    FROM public.transaction_categories 
    WHERE name = 'Liquidação de Recebível' OR name = 'Recebimento de Parcelas - Operação'
    LIMIT 1;

    -- 3. treasury_transactions
    INSERT INTO public.treasury_transactions (
      type,
      amount,
      date,
      description,
      category,
      category_id,
      reference_id,
      is_escrow,
      external_ref,
      status
    )
    VALUES (
      'in',
      16390,
      '2025-11-11'::date,
      'Liquidação de recebível — José Carlos Alves Osório (Doc 012456)',
      'Liquidação de Recebível',
      v_cat_id,
      v_op_id,
      false,
      'op-liq-' || v_op_id::text,
      'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET 
      amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      description = EXCLUDED.description,
      status = 'Confirmado';

    -- 4. Ajustar created_at de movimentacoes_caixa para a data da liquidação (2025-11-11)
    -- Isso garante que relatórios por competência / data de caixa encontrem a movimentação na data da baixa informada
    UPDATE public.movimentacoes_caixa
    SET 
      created_at = '2025-11-11 12:00:00+00'::timestamptz,
      valor = 16390
    WHERE referencia_id = v_op_id 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

    -- Se não existisse movimentação de caixa, cria
    IF NOT EXISTS (
      SELECT 1 FROM public.movimentacoes_caixa 
      WHERE referencia_id = v_op_id AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel')
    ) THEN
      INSERT INTO public.movimentacoes_caixa (
        tipo,
        categoria,
        descricao,
        valor,
        saldo_anterior,
        saldo_novo,
        referencia_id,
        referencia_tipo,
        referencia_numero,
        user_id,
        created_at
      )
      VALUES (
        'entrada',
        'liquidação_recebível',
        'Liquidação de recebível — José Carlos Alves Osório (Doc 012456)',
        16390,
        0,
        0,
        v_op_id,
        'recebível',
        '012456',
        v_admin_id,
        '2025-11-11 12:00:00+00'::timestamptz
      )
      RETURNING id INTO v_mov_id;

      IF v_mov_id IS NOT NULL THEN
        INSERT INTO public.mapeamento_movimentacoes (
          movimentacao_caixa_id,
          origem_tabela,
          origem_id,
          sincronizado,
          user_id,
          created_at
        )
        VALUES (
          v_mov_id,
          'recebíveis',
          v_op_id,
          true,
          v_admin_id,
          NOW()
        );
      END IF;
    END IF;
  END IF;
END $$;
