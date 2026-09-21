-- 20260921010000_sync_single_installment_liquidation.sql
-- Sincronização automática do status da operação na fila de borderôs (/operations) com a liquidação de parcelas:
-- 1. Ao dar baixa de parcela via liquidate_credit_operation_installment em operação de PARCELA ÚNICA (1 parcela no cronograma),
--    o status da operação é atualizado diretamente para 'liquidado', com liquidation_date e liquidation_value preenchidos.
-- 2. Idempotência e consistência com a baixa pela mesa (liquidate_credit_operation_full):
--    - Se a operação já estiver 'liquidada', a baixa da parcela respeita os registros de tesouraria/caixa existentes
--      (limpando referências antigas ou aproveitando de forma não duplicada).
--    - Limpa tanto 'op-bol-{id}-{idx}' quanto 'op-liq-{id}' se necessário para evitar duplicidade entre os dois fluxos.
-- 3. Na reversão (revert_credit_operation_installment_liquidation e revert_credit_operation_full_liquidation):
--    - Se for revertida a baixa, limpa ambos os external_ref ('op-bol-...' e 'op-liq-...') e volta status para 'aprovado'
--    - Reseta liquidation_date e liquidation_value se nenhuma parcela estiver paga.
-- 4. Backfill para operações de parcela única já com parcela paga (ex: d64ccab7-ce5c-4523-9b41-6633be86b2d0): status -> 'liquidado'.

-- 1. Atualizar liquidate_credit_operation_installment
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
  v_full_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_total NUMERIC;
  v_mov_id UUID;
  v_all_paid BOOLEAN := TRUE;
  v_inst_val NUMERIC;
  v_total_paid_op NUMERIC := 0;
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_total_inst_count INT;
  v_target_status TEXT;
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
    -- Fallback se invocado de contexto confiável
    v_user_id := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
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
  v_op_is_single := (v_op.installments IS NULL OR v_op.installments <= 1);

  -- Se installments_data estiver vazio/nulo e for parcela única (ou geral), auto-inicializar cronograma
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    IF v_op_is_single THEN
      IF LOWER(COALESCE(v_op.status, '')) IN ('pago', 'liquidado') THEN
        v_init_status := 'pago';
      ELSE
        v_init_status := 'pendente';
      END IF;

      v_installments := jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'dueDate', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'due_date', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'valor_original', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'original_value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'status', v_init_status,
          'payment_date', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'data_pagamento', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'amount_paid', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_value, v_op.face_value, v_op.requested_value, 0) ELSE NULL END
        )
      );
    ELSE
      RAISE EXCEPTION 'Cronograma de parcelas não encontrado para a operação';
    END IF;
  END IF;

  v_total_inst_count := jsonb_array_length(v_installments);

  IF v_total_inst_count <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma da operação';
  END IF;

  v_total := COALESCE(p_amount_paid, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago deve ser maior que zero';
  END IF;

  -- Atualizar cronograma de parcelas
  FOR v_idx IN 0..(v_total_inst_count - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_inst_val := COALESCE(
        (v_installment->>'valor_original')::numeric,
        (v_installment->>'original_value')::numeric,
        (v_installment->>'value')::numeric,
        (v_op.face_value / GREATEST(v_total_inst_count, 1))
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

  -- Determinar o status da operação:
  -- SE for parcela única (total de parcelas = 1) E todas pagas => 'liquidado' (solicitação explícita do usuário)
  -- Se for multi-parcela E todas pagas => 'pago' (preserva o comportamento existente das operações parceladas)
  IF v_all_paid THEN
    IF v_total_inst_count = 1 THEN
      v_target_status := 'liquidado';
    ELSE
      v_target_status := 'pago';
    END IF;
  ELSE
    v_target_status := v_op.status;
  END IF;

  -- Atualizar credit_operations com status, data e valor de liquidação
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_status,
    liquidation_date = CASE WHEN v_all_paid THEN p_payment_date ELSE liquidation_date END,
    liquidation_value = CASE WHEN v_all_paid THEN v_total_paid_op ELSE liquidation_value END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Categoria de tesouraria
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' OR name = 'Liquidação de Recebível' LIMIT 1;

  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  v_desc := 'Recebimento Parcela ' || (p_installment_idx + 1) || '/' || v_total_inst_count || 
            ' - Operação ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || 
            ' - Sacado: ' || COALESCE(v_op.sacado, 'Desconhecido') || 
            ' - Cedente: ' || COALESCE(v_op.cedente, 'N/A');

  -- Se for parcela única e houver lançamento prévio de 'op-liq-{id}', limpa-o para evitar lançamento duplo no DRE/Tesouraria
  IF v_total_inst_count = 1 THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_op_uuid 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');
  END IF;

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
    AND (
      (referencia_tipo = 'parcela_operacao' AND referencia_numero = (p_installment_idx + 1)::text)
      OR (v_total_inst_count = 1 AND referencia_tipo IN ('recebível', 'recebivel'))
    );

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
      'external_ref', v_ext_ref,
      'new_operation_status', v_target_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments,
    'all_paid', v_all_paid,
    'operation_status', v_target_status
  );
END;
$$;

-- 2. Atualizar revert_credit_operation_installment_liquidation
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
  v_full_ext_ref TEXT;
  v_any_paid BOOLEAN := FALSE;
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_remaining_paid_total NUMERIC := 0;
  v_last_payment_date DATE := NULL;
  v_total_inst_count INT;
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
  v_op_is_single := (v_op.installments IS NULL OR v_op.installments <= 1);

  -- Se installments_data estiver vazio/nulo e for parcela única, auto-inicializar cronograma
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    IF v_op_is_single THEN
      IF LOWER(COALESCE(v_op.status, '')) IN ('pago', 'liquidado') THEN
        v_init_status := 'pago';
      ELSE
        v_init_status := 'pendente';
      END IF;

      v_installments := jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'dueDate', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'due_date', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'valor_original', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'original_value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'status', v_init_status,
          'payment_date', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'data_pagamento', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'amount_paid', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_value, v_op.face_value, v_op.requested_value, 0) ELSE NULL END
        )
      );
    ELSE
      RAISE EXCEPTION 'Cronograma de parcelas não encontrado para a operação';
    END IF;
  END IF;

  v_total_inst_count := jsonb_array_length(v_installments);

  IF v_total_inst_count <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  -- Validar se a parcela a ser revertida está de fato paga/liquidada
  v_installment := v_installments->p_installment_idx;
  v_old_status := LOWER(COALESCE(v_installment->>'status', ''));
  IF v_old_status NOT IN ('pago', 'liquidado') AND (v_installment->>'payment_date' IS NULL AND v_installment->>'data_pagamento' IS NULL) THEN
    RAISE EXCEPTION 'A parcela % não está paga/liquidada (status atual: %)', p_installment_idx + 1, COALESCE(v_installment->>'status', 'indefinido');
  END IF;

  -- Iterar e recriar o array com a parcela limpa
  FOR v_idx IN 0..(v_total_inst_count - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied' - 'notes')
                       || jsonb_build_object('status', CASE WHEN (v_installment->>'extension_interest')::numeric > 0 OR (v_installment->>'prorrogacao_juros')::numeric > 0 THEN 'prorrogado' ELSE 'pendente' END);
    END IF;

    IF LOWER(COALESCE(v_installment->>'status', '')) IN ('pago', 'liquidado') THEN
      v_any_paid := TRUE;
      v_remaining_paid_total := v_remaining_paid_total + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
      IF v_installment->>'payment_date' IS NOT NULL THEN
        v_last_payment_date := (v_installment->>'payment_date')::date;
      END IF;
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
    liquidation_date = CASE WHEN NOT v_any_paid THEN NULL ELSE COALESCE(v_last_payment_date, liquidation_date) END,
    liquidation_value = CASE WHEN NOT v_any_paid THEN NULL ELSE v_remaining_paid_total END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Remover de treasury_transactions tanto a parcela quanto a liquidação total (caso de parcela única)
  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
  IF v_total_inst_count = 1 OR NOT v_any_paid THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
  END IF;

  -- Remover de movimentacoes_caixa e mapeamento_movimentacoes
  DELETE FROM public.mapeamento_movimentacoes
  WHERE (origem_tabela = 'credit_operations_installment' OR origem_tabela = 'recebíveis')
    AND origem_id = v_op_uuid;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid
    AND (
      referencia_numero = (p_installment_idx + 1)::text 
      OR (referencia_tipo = 'parcela_operacao' AND descricao ILIKE ('%Parcela ' || (p_installment_idx + 1) || '/%'))
      OR (v_total_inst_count = 1 AND referencia_tipo IN ('recebível', 'recebivel'))
      OR (NOT v_any_paid AND referencia_tipo IN ('recebível', 'recebivel'))
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
    'installments_data', v_new_installments,
    'remaining_paid', v_any_paid
  );
END;
$$;

-- 3. Atualizar liquidate_credit_operation_full para idempotência se a parcela já tiver sido baixada
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
      'notes', COALESCE(p_notes, v_installment->>'notes')
    );
    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar credit_operations com status 'liquidado'
  UPDATE public.credit_operations
  SET
    status = 'liquidado',
    liquidation_date = v_date,
    liquidation_value = v_total,
    installments_data = v_new_installments,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Limpar lançamentos de parcelas individuais anteriores para evitar duplicidade com a liquidação integral
  DELETE FROM public.treasury_transactions 
  WHERE reference_id = v_op_uuid AND external_ref LIKE 'op-bol-%';

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid AND referencia_tipo = 'parcela_operacao';

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
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid 
    AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

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
    'recebível',
    COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)),
    v_user_id,
    (v_date::text || ' 12:00:00+00')::timestamptz
  )
  RETURNING id INTO v_mov_id;

  -- Mapeamento movimentações
  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE (origem_tabela = 'recebíveis' OR origem_tabela = 'credit_operations_installment')
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

-- 4. Atualizar revert_credit_operation_full_liquidation para garantir limpeza limpa de qualquer external_ref residual
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
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref OR (reference_id = v_op_uuid AND external_ref LIKE 'op-bol-%');

  -- Deletar mapeamentos e caixa
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela IN ('recebíveis', 'juros', 'credit_operations_installment') AND origem_id = v_op_uuid;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid;

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

-- 5. Backfill: sincronizar operações de parcela única cuja parcela já está paga para status = 'liquidado'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, liquidation_date, liquidation_value, installments_data
    FROM public.credit_operations
    WHERE (installments IS NULL OR installments <= 1)
      AND installments_data IS NOT NULL
      AND jsonb_typeof(installments_data) = 'array'
      AND jsonb_array_length(installments_data) = 1
      AND (
        installments_data->0->>'status' = 'pago' 
        OR installments_data->0->>'payment_date' IS NOT NULL
        OR installments_data->0->>'data_pagamento' IS NOT NULL
      )
      AND status = 'pago'
  LOOP
    UPDATE public.credit_operations
    SET 
      status = 'liquidado',
      liquidation_date = COALESCE(liquidation_date, (r.installments_data->0->>'payment_date')::date, (r.installments_data->0->>'data_pagamento')::date, CURRENT_DATE),
      liquidation_value = COALESCE(liquidation_value, (r.installments_data->0->>'amount_paid')::numeric, (r.installments_data->0->>'value')::numeric),
      updated_at = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;

-- Permissões explícitas
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_full_liquidation(TEXT) TO authenticated;
