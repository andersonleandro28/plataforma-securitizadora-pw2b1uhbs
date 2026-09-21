-- 20260921070000_unify_liquidation_and_paid_status_credit_limit.sql
--
-- 1. Alinhamento retroativo:
--    Garante que qualquer operação de crédito com todas as parcelas quitadas/pagas
--    tenha status 'liquidado' (ou 'pago' tratado igualmente nas consultas que liberam limite).
--    Operações com qualquer parcela pendente ou prorrogada continuam com status 'aprovado'
--    e consumindo limite do tomador.
--
-- 2. Atualização dos RPCs:
--    - liquidate_credit_operation_full: garante transição para 'liquidado' (libera limite).
--    - revert_credit_operation_full_liquidation: reverte para 'aprovado' (consome limite).
--    - extend_credit_operation_installment: se estava 'liquidado' ou 'pago', reverte para 'aprovado' (consome limite).
--    - liquidate_credit_operation_installment: se todas as parcelas forem quitadas ('pago'/'liquidado'), atualiza para 'liquidado'; caso contrário 'aprovado'.
--    - revert_credit_operation_installment_liquidation: se restam parcelas abertas/pendentes/prorrogadas, reverte para 'aprovado'.
--
-- 3. Função auxiliar / trigger ou reparo final de consistência.

-- 1. Reparo Retroativo de Dados
DO $$
DECLARE
  r RECORD;
  v_insts JSONB;
  v_len INT;
  v_all_truly_paid BOOLEAN;
  v_has_open_installments BOOLEAN;
  v_new_insts JSONB;
  v_elem JSONB;
  v_i INT;
  v_st TEXT;
  v_is_extended BOOLEAN;
  v_full_ext_ref TEXT;
BEGIN
  FOR r IN 
    SELECT id, status, liquidation_date, liquidation_value, installments_data
    FROM public.credit_operations
    WHERE installments_data IS NOT NULL
      AND jsonb_typeof(installments_data) = 'array'
      AND jsonb_array_length(installments_data) > 0
  LOOP
    v_insts := r.installments_data;
    v_len := jsonb_array_length(v_insts);
    v_all_truly_paid := TRUE;
    v_has_open_installments := FALSE;
    v_new_insts := '[]'::jsonb;

    FOR v_i IN 0..(v_len - 1)
    LOOP
      v_elem := v_insts->v_i;
      v_st := LOWER(COALESCE(v_elem->>'status', ''));
      
      v_is_extended := (
        v_st IN ('prorrogado', 'prorrogada')
        OR (v_elem->>'original_due_date') IS NOT NULL
        OR COALESCE((v_elem->>'extension_interest')::numeric, 0) > 0
        OR COALESCE((v_elem->>'prorrogacao_juros')::numeric, 0) > 0
      );

      IF v_is_extended AND v_st IN ('prorrogado', 'prorrogada') THEN
        v_elem := (v_elem - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied');
      END IF;

      v_st := LOWER(COALESCE(v_elem->>'status', ''));

      IF (v_st NOT IN ('pago', 'liquidado')) 
         OR (v_st IN ('prorrogado', 'prorrogada', 'pendente')) 
         OR (v_elem->>'payment_date' IS NULL AND v_elem->>'data_pagamento' IS NULL) THEN
        v_all_truly_paid := FALSE;
        v_has_open_installments := TRUE;
      END IF;

      v_new_insts := v_new_insts || jsonb_build_array(v_elem);
    END LOOP;

    -- Se tem parcelas abertas mas a operação estava marcada como 'liquidado' ou 'pago',
    -- reverte para 'aprovado' para reter o consumo do limite
    IF v_has_open_installments AND r.status IN ('pago', 'liquidado') THEN
      UPDATE public.credit_operations
      SET 
        status = 'aprovado',
        liquidation_date = NULL,
        liquidation_value = NULL,
        installments_data = v_new_insts,
        updated_at = NOW()
      WHERE id = r.id;

      v_full_ext_ref := 'op-liq-' || r.id::text;
      DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
      DELETE FROM public.movimentacoes_caixa 
      WHERE referencia_id = r.id 
        AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

    -- Se todas as parcelas foram pagas, garante status = 'liquidado' (liberando o limite)
    ELSIF v_all_truly_paid AND v_len > 0 AND r.status NOT IN ('liquidado') THEN
      UPDATE public.credit_operations
      SET 
        status = 'liquidado',
        installments_data = v_new_insts,
        updated_at = NOW()
      WHERE id = r.id;

    ELSIF v_new_insts != v_insts THEN
      UPDATE public.credit_operations
      SET installments_data = v_new_insts, updated_at = NOW()
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 2. Atualizar RPC liquidate_credit_operation_full
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

  -- Atualizar credit_operations com status 'liquidado' (libera limite do tomador)
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
    'external_ref', v_ext_ref,
    'operation_status', 'liquidado'
  );
END;
$$;

-- 3. Atualizar RPC revert_credit_operation_full_liquidation
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

  -- Atualizar credit_operations para 'aprovado' (volta a consumir o limite do tomador)
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
      'new_status', 'aprovado',
      'external_ref', v_ext_ref,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'operation_status', 'aprovado'
  );
END;
$$;

-- 4. Atualizar RPC extend_credit_operation_installment
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
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_target_op_status TEXT;
  v_full_ext_ref TEXT;
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
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem prorrogar parcelas';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada';
  END IF;

  v_installments := v_op.installments_data;
  v_op_is_single := (v_op.installments IS NULL OR v_op.installments <= 1);

  -- Se installments_data estiver vazio/nulo e for parcela única, inicializar cronograma
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

  IF jsonb_array_length(v_installments) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  -- Verificar se já está paga
  v_installment := v_installments->p_installment_idx;
  v_current_status := LOWER(COALESCE(v_installment->>'status', ''));
  IF v_current_status IN ('pago', 'liquidado') AND (v_installment->>'payment_date' IS NOT NULL OR v_installment->>'data_pagamento' IS NOT NULL) THEN
    RAISE EXCEPTION 'Não é permitido prorrogar uma parcela que já foi paga/liquidada';
  END IF;

  v_old_due_date := COALESCE(v_installment->>'dueDate', v_installment->>'due_date', v_op.due_date::text);

  -- Montar novo cronograma limpando dados de quitação caso existissem espúrios
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

      -- Remove explicitamente campos de liquidação da parcela
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied')
        || jsonb_build_object(
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

  -- Determina novo status da operação: se a operação estava como 'liquidado' ou 'pago',
  -- com a prorrogação desta parcela ela certamente NÃO está toda quitada! Deve voltar para 'aprovado'.
  IF v_op.status IN ('pago', 'liquidado') THEN
    v_target_op_status := 'aprovado';
  ELSE
    v_target_op_status := v_op.status;
  END IF;

  -- Atualizar a operação
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_op_status,
    due_date = CASE 
      WHEN jsonb_array_length(v_new_installments) = 1 THEN p_new_due_date
      ELSE due_date 
    END,
    liquidation_date = CASE WHEN v_target_op_status IN ('liquidado', 'pago') THEN liquidation_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_op_status IN ('liquidado', 'pago') THEN liquidation_value ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Se a operação saiu de liquidada para aprovada, remove lançamento de liquidação global ('op-liq-{id}')
  IF v_target_op_status NOT IN ('liquidado', 'pago') THEN
    v_full_ext_ref := 'op-liq-' || v_op_uuid::text;
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_op_uuid 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');
  END IF;

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
      'operation_status_after', v_target_op_status,
      'extended_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments,
    'operation_status', v_target_op_status
  );
END;
$$;

-- 5. Permissões explícitas
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_full_liquidation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
