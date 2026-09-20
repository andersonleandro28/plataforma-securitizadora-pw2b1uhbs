-- Atualização do RPC extend_credit_operation_installment para persistir os campos calculados de prorrogação
-- (prorrogacao_juros, prorrogacao_multa, valor_original, valor_atualizado, total_devido)
-- além de manter compatibilidade com extension_interest e extension_penalty.

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
  IF v_installments IS NULL OR jsonb_array_length(v_installments) <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  -- Verificar se já está paga
  v_installment := v_installments->p_installment_idx;
  v_current_status := LOWER(COALESCE(v_installment->>'status', ''));
  IF v_current_status IN ('pago', 'liquidado') THEN
    RAISE EXCEPTION 'Não é permitido prorrogar uma parcela que já foi paga/liquidada';
  END IF;

  v_old_due_date := COALESCE(v_installment->>'dueDate', v_installment->>'due_date');

  -- Montar novo cronograma
  FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      -- Se a parcela já tiver valor_original preservado, use-o; senão use value ou rateio
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

  -- Atualizar a operação
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
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

GRANT EXECUTE ON FUNCTION public.extend_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
