-- 20260920060000_single_installment_receivables.sql
-- Suporte a operações de parcela única na mesa de recebíveis:
-- 1. Popula installments_data para operações com 1 parcela ou installments_data vazio
-- 2. Atualiza liquidate_credit_operation_installment para garantir suporte robusto a parcela única (criando a parcela se installments_data estiver vazio) e atualizar status geral da operação para 'pago' / 'liquidado'
-- 3. Atualiza revert_credit_operation_installment_liquidation para manter coerência do status da operação
-- 4. Atualiza extend_credit_operation_installment para permitir prorrogar parcela única (inicializando cronograma se vazio)
-- 5. Atualiza save_credit_operation_installments

-- 1. Inicializar installments_data em operações existentes que tenham 1 parcela e cronograma vazio
DO $$
DECLARE
  r RECORD;
  v_initial_inst JSONB;
  v_status TEXT;
BEGIN
  FOR r IN 
    SELECT id, due_date, face_value, status, installments_data
    FROM public.credit_operations
    WHERE installments_data IS NULL 
       OR jsonb_typeof(installments_data) != 'array' 
       OR jsonb_array_length(installments_data) = 0
  LOOP
    IF LOWER(COALESCE(r.status, '')) IN ('pago', 'liquidado') THEN
      v_status := 'pago';
    ELSE
      v_status := 'pendente';
    END IF;

    v_initial_inst := jsonb_build_array(
      jsonb_build_object(
        'number', 1,
        'dueDate', COALESCE(r.due_date::text, CURRENT_DATE::text),
        'due_date', COALESCE(r.due_date::text, CURRENT_DATE::text),
        'value', COALESCE(r.face_value, 0),
        'valor_original', COALESCE(r.face_value, 0),
        'original_value', COALESCE(r.face_value, 0),
        'status', v_status
      )
    );

    UPDATE public.credit_operations
    SET 
      installments_data = v_initial_inst,
      updated_at = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Atualizar liquidate_credit_operation_installment
CREATE OR REPLACE FUNCTION public.liquidate_credit_operation_installment(
  p_operation_id TEXT,
  p_installment_idx INT,
  p_payment_date DATE,
  p_amount_paid NUMERIC,
  p_interest_applied NUMERIC DEFAULT 0,
  p_penalty_applied NUMERIC DEFAULT 0,
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
  v_installments JSONB;
  v_installment JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_total NUMERIC;
  v_mov_id UUID;
  v_all_paid BOOLEAN := TRUE;
  v_inst_val NUMERIC;
  v_total_paid_op NUMERIC := 0;
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
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validar permissão
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem baixar parcelas';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada';
  END IF;

  v_installments := v_op.installments_data;

  -- Se installments_data estiver vazio ou nulo, inicializar com 1 parcela correspondente à operação
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    v_installments := jsonb_build_array(
      jsonb_build_object(
        'number', 1,
        'dueDate', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
        'due_date', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
        'value', COALESCE(v_op.face_value, 0),
        'valor_original', COALESCE(v_op.face_value, 0),
        'original_value', COALESCE(v_op.face_value, 0),
        'status', 'pendente'
      )
    );
  END IF;

  IF jsonb_array_length(v_installments) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma da operação';
  END IF;

  v_total := COALESCE(p_amount_paid, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago deve ser maior que zero';
  END IF;

  -- Atualizar cronograma de parcelas
  FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_inst_val := COALESCE(
        (v_installment->>'valor_original')::numeric,
        (v_installment->>'original_value')::numeric,
        (v_installment->>'value')::numeric,
        (v_op.face_value / jsonb_array_length(v_installments))
      );

      v_installment := v_installment || jsonb_build_object(
        'status', 'pago',
        'value', v_inst_val,
        'payment_date', p_payment_date,
        'data_pagamento', p_payment_date,
        'amount_paid', v_total,
        'interest_applied', COALESCE(p_interest_applied, 0),
        'penalty_applied', COALESCE(p_penalty_applied, 0),
        'paid_at', NOW(),
        'paid_by', v_user_id,
        'notes', p_notes
      );
    END IF;

    IF LOWER(COALESCE(v_installment->>'status', '')) NOT IN ('pago', 'liquidado') THEN
      v_all_paid := FALSE;
    ELSE
      v_total_paid_op := v_total_paid_op + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
    END IF;

    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar a operação no banco (se todas as parcelas foram pagas, marcar operação como pago/liquidado)
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = CASE WHEN v_all_paid THEN 'pago' ELSE status END,
    liquidation_date = CASE WHEN v_all_paid THEN p_payment_date ELSE liquidation_date END,
    liquidation_value = CASE WHEN v_all_paid THEN v_total_paid_op ELSE liquidation_value END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Buscar categoria para treasury_transactions
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_desc := 'Recebimento Parcela ' || (p_installment_idx + 1) || '/' || jsonb_array_length(v_installments) || 
            ' - Operação ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || 
            ' - Sacado: ' || COALESCE(v_op.sacado, 'Desconhecido') || 
            ' - Cedente: ' || COALESCE(v_op.cedente, 'N/A');

  -- Inserir ou atualizar em treasury_transactions (DRE e Tesouraria)
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
    p_payment_date,
    v_desc,
    'Recebimento de Parcelas - Operação',
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

  -- Espelhar em movimentacoes_caixa (Livro Caixa Contabilidade)
  DELETE FROM public.movimentacoes_caixa 
  WHERE referencia_id = v_op_uuid 
    AND referencia_numero = (p_installment_idx + 1)::text 
    AND referencia_tipo = 'parcela_operacao';

  INSERT INTO public.movimentacoes_caixa (
    tipo,
    categoria,
    descricao,
    valor,
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
    v_op_uuid,
    'parcela_operacao',
    (p_installment_idx + 1)::text,
    v_user_id,
    (p_payment_date::text || ' 12:00:00+00')::timestamptz
  )
  RETURNING id INTO v_mov_id;

  -- Mapeamento movimentações
  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE origem_tabela = 'credit_operations_installment' 
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
      'credit_operations_installment',
      v_op_uuid,
      true,
      v_user_id,
      NOW()
    );
  END IF;

  -- Registrar no audit_logs
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_liquidated_operation_installment',
    jsonb_build_object(
      'admin', v_user_id,
      'installment_idx', p_installment_idx,
      'installment_number', p_installment_idx + 1,
      'payment_date', p_payment_date,
      'amount_paid', v_total,
      'interest_applied', p_interest_applied,
      'penalty_applied', p_penalty_applied,
      'sacado', v_op.sacado,
      'cedente', v_op.cedente,
      'external_ref', v_ext_ref
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments,
    'all_paid', v_all_paid
  );
END;
$$;

-- 3. Atualizar revert_credit_operation_installment_liquidation
CREATE OR REPLACE FUNCTION public.revert_credit_operation_installment_liquidation(
  p_operation_id TEXT,
  p_installment_idx INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_installments JSONB;
  v_installment JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_old_status TEXT;
  v_ext_ref TEXT;
  v_any_paid BOOLEAN := FALSE;
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
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validar permissão
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem reverter baixas';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação não encontrada';
  END IF;

  v_installments := v_op.installments_data;
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  -- Iterar e recriar o array com a parcela limpa
  FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_old_status := v_installment->>'status';
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied' - 'notes')
                       || jsonb_build_object('status', CASE WHEN (v_installment->>'extension_interest')::numeric > 0 OR (v_installment->>'prorrogacao_juros')::numeric > 0 THEN 'prorrogado' ELSE 'pendente' END);
    END IF;

    IF LOWER(COALESCE(v_installment->>'status', '')) IN ('pago', 'liquidado') THEN
      v_any_paid := TRUE;
    END IF;

    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar a operação
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = CASE 
      WHEN NOT v_any_paid AND status IN ('pago', 'liquidado') THEN 'aprovado' 
      ELSE status 
    END,
    liquidation_date = CASE WHEN NOT v_any_paid THEN NULL ELSE liquidation_date END,
    liquidation_value = CASE WHEN NOT v_any_paid THEN NULL ELSE liquidation_value END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Remover de treasury_transactions
  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;

  -- Remover de movimentacoes_caixa e mapeamento_movimentacoes
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela = 'credit_operations_installment' AND origem_id = v_op_uuid;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid
    AND (
      referencia_numero = (p_installment_idx + 1)::text 
      OR (referencia_tipo = 'parcela_operacao' AND descricao ILIKE ('%Parcela ' || (p_installment_idx + 1) || '/%'))
    );

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_reverted_operation_installment_liquidation',
    jsonb_build_object(
      'admin', v_user_id,
      'installment_idx', p_installment_idx,
      'installment_number', p_installment_idx + 1,
      'previous_status', v_old_status,
      'external_ref', v_ext_ref,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments
  );
END;
$$;

-- 4. Atualizar extend_credit_operation_installment com suporte a parcela única e cronograma vazio
CREATE OR REPLACE FUNCTION public.extend_credit_operation_installment(
  p_operation_id TEXT,
  p_installment_idx INT,
  p_new_due_date DATE,
  p_interest_calculated NUMERIC DEFAULT 0,
  p_penalty_calculated NUMERIC DEFAULT 0,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_installments JSONB;
  v_installment JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_old_due_date TEXT;
  v_current_status TEXT;
  v_orig_val NUMERIC;
  v_interest NUMERIC;
  v_penalty NUMERIC;
  v_updated_val NUMERIC;
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
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validar permissão
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem prorrogar parcelas';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada';
  END IF;

  v_installments := v_op.installments_data;

  -- Se installments_data estiver vazio ou nulo, inicializar com 1 parcela correspondente à operação
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    v_installments := jsonb_build_array(
      jsonb_build_object(
        'number', 1,
        'dueDate', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
        'due_date', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
        'value', COALESCE(v_op.face_value, 0),
        'valor_original', COALESCE(v_op.face_value, 0),
        'original_value', COALESCE(v_op.face_value, 0),
        'status', 'pendente'
      )
    );
  END IF;

  IF jsonb_array_length(v_installments) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  -- Verificar se já está paga
  v_installment := v_installments->p_installment_idx;
  v_current_status := LOWER(COALESCE(v_installment->>'status', ''));
  IF v_current_status IN ('pago', 'liquidado') THEN
    RAISE EXCEPTION 'Não é permitido prorrogar uma parcela que já foi paga/liquidada';
  END IF;

  v_old_due_date := COALESCE(v_installment->>'dueDate', v_installment->>'due_date', v_op.due_date::text);

  -- Montar novo cronograma
  FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_orig_val := COALESCE(
        (v_installment->>'original_value')::numeric,
        (v_installment->>'valor_original')::numeric,
        (v_installment->>'value')::numeric,
        (v_op.face_value / jsonb_array_length(v_installments))
      );
      v_interest := COALESCE(p_interest_calculated, 0);
      v_penalty := COALESCE(p_penalty_calculated, 0);
      v_updated_val := ROUND(v_orig_val + v_interest + v_penalty, 2);

      v_installment := v_installment || jsonb_build_object(
        'dueDate', p_new_due_date,
        'due_date', p_new_due_date,
        'original_due_date', COALESCE(v_installment->>'original_due_date', v_old_due_date),
        'status', 'prorrogado',
        'value', v_orig_val,
        'valor_original', v_orig_val,
        'original_value', v_orig_val,
        'extension_interest', v_interest,
        'prorrogacao_juros', v_interest,
        'extension_penalty', v_penalty,
        'prorrogacao_multa', v_penalty,
        'valor_atualizado', v_updated_val,
        'total_devido', v_updated_val,
        'extended_at', NOW(),
        'extended_by', v_user_id,
        'extension_reason', p_reason
      );
    END IF;
    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar a operação (atualiza também due_date principal da operação para refletir a prorrogação caso seja parcela única ou a última)
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    due_date = CASE 
      WHEN jsonb_array_length(v_new_installments) = 1 THEN p_new_due_date
      ELSE due_date 
    END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_extended_operation_installment',
    jsonb_build_object(
      'admin', v_user_id,
      'installment_idx', p_installment_idx,
      'installment_number', p_installment_idx + 1,
      'old_due_date', v_old_due_date,
      'new_due_date', p_new_due_date,
      'original_value', v_orig_val,
      'interest_calculated', v_interest,
      'penalty_calculated', v_penalty,
      'valor_atualizado', v_updated_val,
      'reason', p_reason,
      'extended_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_operation_installments(TEXT, JSONB) TO authenticated;
