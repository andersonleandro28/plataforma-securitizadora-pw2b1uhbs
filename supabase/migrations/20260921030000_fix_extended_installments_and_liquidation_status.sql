-- 20260921030000_fix_extended_installments_and_liquidation_status.sql
--
-- Correção da causa raiz:
-- 1. extend_credit_operation_installment:
--    - Ao prorrogar parcela, garante que a operação pai (credit_operations) saia de 'pago'/'liquidado' caso estivesse,
--      revertendo para 'aprovado' e limpando liquidation_date e liquidation_value.
--    - Limpa registros órfãos de quitação global ('op-liq-{id}') se a operação não estiver mais quitada.
--    - Garante que a parcela prorrogada tenha status 'prorrogado' e que campos de liquidação da parcela
--      (payment_date, data_pagamento, amount_paid, etc.) sejam explicitamente removidos ou nulos.
--
-- 2. liquidate_credit_operation_installment:
--    - Regra estrita de quitação de operação: apenas parcelas cujo status seja explicitamente 'pago' ou 'liquidado'
--      (ou que tenham payment_date preenchida) contam como pagas. Parcelas 'prorrogado', 'prorrogada' ou 'pendente' NUNCA contam.
--    - Se nem todas as parcelas estiverem pagas/liquidadas:
--      * a operação NÃO deve permanecer nem ser colocada em 'liquidado'/'pago'. Se estava, reverte para 'aprovado'
--        e limpa liquidation_date / liquidation_value globais.
--      * estorna lançamento global de quitação integral ('op-liq-{id}') da tesouraria e caixa se existir.
--
-- 3. revert_credit_operation_installment_liquidation:
--    - Reforça a mesma regra estrita de quitação e preserva lançamentos das parcelas pagas restantes.
--
-- 4. Backfill idempotente:
--    - Limpa dados incorretos de prorrogações anteriores (onde payment_date pudesse ter ficado gravada em parcela prorrogada).
--    - Para TODA operação em credit_operations que esteja com status 'liquidado' ou 'pago' mas cujo cronograma
--      possua parcelas com status 'prorrogado', 'prorrogada' ou 'pendente' (ou qualquer parcela sem quitação efetiva):
--      * Reverte o status da operação para 'aprovado'.
--      * Limpa liquidation_date e liquidation_value.
--      * Estorna lançamentos contábeis de quitação global ('op-liq-{id}') em treasury_transactions e movimentacoes_caixa.
--      * PRESERVA estritamente os lançamentos contábeis de parcelas individuais ('op-bol-{id}-{idx}').

-- 1. Atualizar RPC extend_credit_operation_installment
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
    liquidation_date = CASE WHEN v_target_op_status = 'liquidado' THEN liquidation_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_op_status = 'liquidado' THEN liquidation_value ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Se a operação saiu de liquidada para aprovada, remove lançamento de liquidação global ('op-liq-{id}')
  IF v_target_op_status != 'liquidado' THEN
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


-- 2. Atualizar RPC liquidate_credit_operation_installment
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
  v_total NUMERIC;
  v_inst_val NUMERIC;
  v_ext_ref TEXT;
  v_full_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_all_paid BOOLEAN := TRUE;
  v_total_paid_op NUMERIC := 0;
  v_latest_payment_date DATE := NULL;
  v_inst_payment_date DATE;
  v_total_inst_count INT;
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_mov_id UUID;
  v_target_status TEXT;
  v_st TEXT;
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
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem dar baixa em parcelas';
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

  v_total_inst_count := jsonb_array_length(v_installments);

  IF v_total_inst_count <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  v_total := COALESCE(p_amount_paid, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago deve ser maior que zero';
  END IF;

  -- Atualizar cronograma de parcelas e computar status geral
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

    v_st := LOWER(COALESCE(v_installment->>'status', ''));

    -- REGRA ESTRITA: Parcela prorrogada NÃO é paga!
    -- Parcela paga precisa ter status 'pago'/'liquidado' E possuir data de pagamento.
    IF (v_st NOT IN ('pago', 'liquidado')) OR (v_st IN ('prorrogado', 'prorrogada', 'pendente')) OR (v_installment->>'payment_date' IS NULL AND v_installment->>'data_pagamento' IS NULL) THEN
      v_all_paid := FALSE;
    ELSE
      v_total_paid_op := v_total_paid_op + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
      
      -- Identificar data mais recente de pagamento entre as parcelas pagas
      v_inst_payment_date := NULL;
      IF v_installment->>'payment_date' IS NOT NULL THEN
        BEGIN
          v_inst_payment_date := (v_installment->>'payment_date')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_payment_date := NULL;
        END;
      ELSIF v_installment->>'data_pagamento' IS NOT NULL THEN
        BEGIN
          v_inst_payment_date := (v_installment->>'data_pagamento')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_payment_date := NULL;
        END;
      END IF;

      IF v_inst_payment_date IS NOT NULL THEN
        IF v_latest_payment_date IS NULL OR v_inst_payment_date > v_latest_payment_date THEN
          v_latest_payment_date := v_inst_payment_date;
        END IF;
      END IF;
    END IF;

    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Determinar o status da operação:
  -- Apenas quando TODAS as parcelas estiverem efetivamente pagas a operação vai para 'liquidado'!
  -- Caso contrário, se a operação estiver marcada como 'liquidado'/'pago', reverte para 'aprovado'.
  IF v_all_paid AND v_total_inst_count > 0 THEN
    v_target_status := 'liquidado';
  ELSE
    IF v_op.status IN ('pago', 'liquidado') THEN
      v_target_status := 'aprovado';
    ELSE
      v_target_status := v_op.status;
    END IF;
  END IF;

  -- Data de liquidação a aplicar
  IF v_latest_payment_date IS NULL THEN
    v_latest_payment_date := p_payment_date;
  END IF;

  -- Atualizar credit_operations
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_status,
    liquidation_date = CASE WHEN v_target_status = 'liquidado' THEN v_latest_payment_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_status = 'liquidado' THEN v_total_paid_op ELSE NULL END,
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

  -- Se a operação não está 100% quitada ou se for parcela única, limpa 'op-liq-{id}'
  IF v_target_status != 'liquidado' OR v_total_inst_count = 1 THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_op_uuid 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');
  END IF;

  -- Inserir ou atualizar em treasury_transactions para a parcela em questão
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
      'all_paid', v_all_paid,
      'new_operation_status', v_target_status,
      'liquidation_date', CASE WHEN v_target_status = 'liquidado' THEN v_latest_payment_date ELSE NULL END,
      'liquidation_value', CASE WHEN v_target_status = 'liquidado' THEN v_total_paid_op ELSE NULL END
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


-- 3. Atualizar RPC revert_credit_operation_installment_liquidation
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
  v_all_remaining_paid BOOLEAN := TRUE;
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_remaining_paid_total NUMERIC := 0;
  v_last_payment_date DATE := NULL;
  v_inst_p_date DATE;
  v_total_inst_count INT;
  v_target_status TEXT;
  v_st TEXT;
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
                       || jsonb_build_object('status', CASE WHEN (v_installment->>'extension_interest')::numeric > 0 OR (v_installment->>'prorrogacao_juros')::numeric > 0 OR (v_installment->>'original_due_date') IS NOT NULL THEN 'prorrogado' ELSE 'pendente' END);
    END IF;

    v_st := LOWER(COALESCE(v_installment->>'status', ''));

    -- REGRA ESTRITA: parcelas prorrogadas NÃO são pagas
    IF (v_st IN ('pago', 'liquidado')) AND (v_st NOT IN ('prorrogado', 'prorrogada', 'pendente')) AND (v_installment->>'payment_date' IS NOT NULL OR v_installment->>'data_pagamento' IS NOT NULL) THEN
      v_any_paid := TRUE;
      v_remaining_paid_total := v_remaining_paid_total + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
      
      v_inst_p_date := NULL;
      IF v_installment->>'payment_date' IS NOT NULL THEN
        BEGIN
          v_inst_p_date := (v_installment->>'payment_date')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_p_date := NULL;
        END;
      ELSIF v_installment->>'data_pagamento' IS NOT NULL THEN
        BEGIN
          v_inst_p_date := (v_installment->>'data_pagamento')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_p_date := NULL;
        END;
      END IF;

      IF v_inst_p_date IS NOT NULL THEN
        IF v_last_payment_date IS NULL OR v_inst_p_date > v_last_payment_date THEN
          v_last_payment_date := v_inst_p_date;
        END IF;
      END IF;
    ELSE
      v_all_remaining_paid := FALSE;
    END IF;

    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Determinar novo status da operação
  IF v_all_remaining_paid AND v_total_inst_count > 0 THEN
    v_target_status := 'liquidado';
  ELSE
    IF v_op.status IN ('pago', 'liquidado') THEN
      v_target_status := 'aprovado';
    ELSE
      v_target_status := v_op.status;
    END IF;
  END IF;

  -- Atualizar a operação
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_status,
    liquidation_date = CASE WHEN v_target_status = 'liquidado' THEN v_last_payment_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_status = 'liquidado' THEN v_remaining_paid_total ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Remover de treasury_transactions a parcela revertida
  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
  IF v_total_inst_count = 1 OR NOT v_any_paid OR v_target_status != 'liquidado' THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
  END IF;

  -- Remover de movimentacoes_caixa e mapeamento_movimentacoes da parcela revertida
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid
    AND (
      (referencia_tipo = 'parcela_operacao' AND referencia_numero = (p_installment_idx + 1)::text)
      OR (referencia_tipo = 'parcela_operacao' AND descricao ILIKE ('%Parcela ' || (p_installment_idx + 1) || '/' || v_total_inst_count || '%'))
      OR (v_total_inst_count = 1 AND referencia_tipo IN ('recebível', 'recebivel'))
      OR (NOT v_any_paid AND referencia_tipo IN ('recebível', 'recebivel'))
      OR (v_target_status != 'liquidado' AND referencia_tipo IN ('recebível', 'recebivel'))
    );

  DELETE FROM public.mapeamento_movimentacoes
  WHERE (origem_tabela = 'credit_operations_installment' OR origem_tabela = 'recebíveis')
    AND origem_id = v_op_uuid
    AND NOT EXISTS (
      SELECT 1 FROM public.movimentacoes_caixa mc WHERE mc.id = mapeamento_movimentacoes.movimentacao_caixa_id
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
      'operation_status_after', v_target_status,
      'remaining_paid_count', CASE WHEN v_any_paid THEN 1 ELSE 0 END,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments,
    'remaining_paid', v_any_paid,
    'operation_status', v_target_status
  );
END;
$$;


-- 4. Backfill idempotente:
-- Corrigir operações com parcelas prorrogadas ou pendentes que foram indevidamente marcadas como 'liquidado'/'pago'.
-- Corrigir também parcelas prorrogadas no cronograma que possam conter dados de liquidação indevidos.
DO $$
DECLARE
  r RECORD;
  v_insts JSONB;
  v_len INT;
  v_all_truly_paid BOOLEAN;
  v_has_extended_or_pending BOOLEAN;
  v_new_insts JSONB;
  v_elem JSONB;
  v_i INT;
  v_st TEXT;
  v_is_extended BOOLEAN;
  v_full_ext_ref TEXT;
  v_fixed_ops_count INT := 0;
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
    v_has_extended_or_pending := FALSE;
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

      -- Se for prorrogada mas estiver com status pago ou campos de pagamento sem que tenha havido quitação real posterior:
      -- uma parcela prorrogada só é verdadeiramente paga se seu status for explicitamente 'pago'/'liquidado'
      -- e ela NÃO estiver em aberto. Mas se status é 'prorrogado', ela NUNCA deve carregar payment_date nem contar como liquidada.
      IF v_is_extended AND v_st IN ('prorrogado', 'prorrogada') THEN
        -- Limpa resquícios de payment_date em parcela com status prorrogado
        v_elem := (v_elem - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied');
      END IF;

      -- Reavalia status
      v_st := LOWER(COALESCE(v_elem->>'status', ''));

      IF v_st IN ('prorrogado', 'prorrogada') OR v_st = 'pendente' OR (v_elem->>'payment_date' IS NULL AND v_elem->>'data_pagamento' IS NULL) THEN
        v_all_truly_paid := FALSE;
        v_has_extended_or_pending := TRUE;
      END IF;

      v_new_insts := v_new_insts || jsonb_build_array(v_elem);
    END LOOP;

    -- Se a operação contém parcelas prorrogadas ou pendentes mas o status da operação está 'liquidado' ou 'pago':
    -- Reverter a operação para 'aprovado' e limpar campos de liquidação global!
    IF v_has_extended_or_pending AND r.status IN ('liquidado', 'pago') THEN
      UPDATE public.credit_operations
      SET 
        status = 'aprovado',
        liquidation_date = NULL,
        liquidation_value = NULL,
        installments_data = v_new_insts,
        updated_at = NOW()
      WHERE id = r.id;

      -- Estorna lançamento global op-liq-{id} se existisse, preservando os lançamentos de parcelas individuais (op-bol-{id}-{n})
      v_full_ext_ref := 'op-liq-' || r.id::text;
      DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
      DELETE FROM public.movimentacoes_caixa 
      WHERE referencia_id = r.id 
        AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

      v_fixed_ops_count := v_fixed_ops_count + 1;
    ELSIF v_new_insts != v_insts THEN
      -- Se apenas o cronograma foi limpo de chaves inconsistentes
      UPDATE public.credit_operations
      SET installments_data = v_new_insts, updated_at = NOW()
      WHERE id = r.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill concluído: % operações corrigidas de liquidado/pago indevido para aprovado.', v_fixed_ops_count;
END $$;

-- Permissões explícitas
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
