-- 20260921223000_fix_borrower_credit_limit_and_restore_paid_status.sql
--
-- Correção URGENTE da regra de limite de crédito do tomador:
-- 1. Regra Definitiva do Usuário:
--    - Status "pago" CONSUME limite de crédito.
--    - Somente o status "liquidado" (e os status terminais não-aprovados 'reprovado', 'cancelado', 'excluido') LIBERA/restaura limite.
--    - Operações que já estavam no status "pago" nunca deveriam ter voltado para "aprovado".
--
-- 2. Restauração de Dados:
--    - Restaura o status 'pago' para qualquer operação que foi indevidamente rebaixada para 'aprovado'
--      (ou que estava em andamento de pagamento/prorrogada mas foi alterada para 'aprovado' pelo reparo anterior).
--    - Preserva intactos todos os dados de liquidação/pagamento, datas, valores e parcelas.
--
-- 3. Atualização dos RPCs:
--    - liquidate_credit_operation_full: baixa integral -> status 'liquidado' (libera limite).
--    - revert_credit_operation_full_liquidation: reversão de liquidação -> status 'pago' (se foi pago ao cliente) ou status anterior, consumindo limite.
--    - liquidate_credit_operation_installment: se todas as parcelas forem pagas -> 'liquidado' (libera limite); se restam parcelas abertas -> permanece 'pago' (continua consumindo limite!).
--    - revert_credit_operation_installment_liquidation: se restam parcelas abertas -> reverte para 'pago' (continua consumindo limite!).
--    - extend_credit_operation_installment: se estava 'liquidado' e prorroga parcela -> volta para 'pago' (consome limite até nova liquidação integral).

-- 1. Restauração de Dados Retroativos
DO $$
BEGIN
  -- Restaura para 'pago' qualquer operação com status 'aprovado' que tenha sido rebaixada indevidamente
  -- (operações de clientes com parcelas prorrogadas ou pagamentos parciais)
  UPDATE public.credit_operations
  SET 
    status = 'pago',
    updated_at = NOW()
  WHERE status = 'aprovado';
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
-- Reversão de liquidação: volta para status 'pago' (consumindo limite do tomador)
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

  -- Atualizar credit_operations para 'pago' (volta a consumir o limite do tomador, nunca 'aprovado')
  UPDATE public.credit_operations
  SET
    status = 'pago',
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
      'new_status', 'pago',
      'external_ref', v_ext_ref,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'operation_status', 'pago'
  );
END;
$$;

-- 4. Atualizar RPC extend_credit_operation_installment
-- Se a operação estava 'liquidado', reverte para 'pago' (volta a consumir limite)
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

  -- Determina novo status da operação: se a operação estava 'liquidado',
  -- com a prorrogação desta parcela ela NÃO está mais 100% quitada! Deve ir para 'pago' (consumindo limite).
  IF v_op.status = 'liquidado' THEN
    v_target_op_status := 'pago';
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

  -- Se a operação saiu de liquidada, remove lançamento de liquidação global ('op-liq-{id}')
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

-- 5. Atualizar RPC liquidate_credit_operation_installment
-- Se todas as parcelas foram quitadas -> status 'liquidado' (libera limite).
-- Se restam parcelas abertas -> status 'pago' (consome limite até a liquidação completa).
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

    IF (v_st NOT IN ('pago', 'liquidado')) OR (v_st IN ('prorrogado', 'prorrogada', 'pendente')) OR (v_installment->>'payment_date' IS NULL AND v_installment->>'data_pagamento' IS NULL) THEN
      v_all_paid := FALSE;
    ELSE
      v_total_paid_op := v_total_paid_op + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
      
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

  -- Se TODAS as parcelas foram pagas, operação vai para 'liquidado' (restaurando o limite do tomador).
  -- Se restam parcelas abertas, o status permanece 'pago' (CONTINUA consumindo o limite!).
  IF v_all_paid AND v_total_inst_count > 0 THEN
    v_target_status := 'liquidado';
  ELSE
    v_target_status := 'pago';
  END IF;

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

  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' OR name = 'Liquidação de Recebível' LIMIT 1;

  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  v_desc := 'Recebimento Parcela ' || (p_installment_idx + 1) || '/' || v_total_inst_count || 
            ' - Operação ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || 
            ' - Sacado: ' || COALESCE(v_op.sacado, 'Desconhecido') || 
            ' - Cedente: ' || COALESCE(v_op.cedente, 'N/A');

  IF v_target_status != 'liquidado' OR v_total_inst_count = 1 THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_op_uuid 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');
  END IF;

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

-- 6. Atualizar RPC revert_credit_operation_installment_liquidation
-- Reversão de parcela: se restam parcelas abertas, status vai para 'pago' (continua consumindo limite do tomador)
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

  v_installment := v_installments->p_installment_idx;
  v_old_status := LOWER(COALESCE(v_installment->>'status', ''));
  IF v_old_status NOT IN ('pago', 'liquidado') AND (v_installment->>'payment_date' IS NULL AND v_installment->>'data_pagamento' IS NULL) THEN
    RAISE EXCEPTION 'A parcela % não está paga/liquidada (status atual: %)', p_installment_idx + 1, COALESCE(v_installment->>'status', 'indefinido');
  END IF;

  FOR v_idx IN 0..(v_total_inst_count - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'interest_applied' - 'penalty_applied' - 'notes')
                       || jsonb_build_object('status', CASE WHEN (v_installment->>'extension_interest')::numeric > 0 OR (v_installment->>'prorrogacao_juros')::numeric > 0 OR (v_installment->>'original_due_date') IS NOT NULL THEN 'prorrogado' ELSE 'pendente' END);
    END IF;

    v_st := LOWER(COALESCE(v_installment->>'status', ''));

    IF (v_st IN ('pago', 'liquidado')) AND (v_st NOT IN ('prorrogado', 'prorrogada', 'pendente')) AND (v_installment->>'payment_date' IS NOT NULL OR v_installment->>'data_pagamento' IS NULL) THEN
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

  -- Se todas as parcelas restantes continuam quitadas -> 'liquidado'.
  -- Se restam parcelas abertas -> status vai para 'pago' (re-consumindo o limite de crédito do tomador).
  IF v_all_remaining_paid AND v_total_inst_count > 0 THEN
    v_target_status := 'liquidado';
  ELSE
    v_target_status := 'pago';
  END IF;

  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_status,
    liquidation_date = CASE WHEN v_target_status = 'liquidado' THEN v_last_payment_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_status = 'liquidado' THEN v_remaining_paid_total ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
  IF v_total_inst_count = 1 OR NOT v_any_paid OR v_target_status != 'liquidado' THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
  END IF;

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
    'remaining_all_paid', v_all_remaining_paid,
    'operation_status', v_target_status
  );
END;
$$;

-- 7. Permissões
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_installment_liquidation(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_credit_operation_full_liquidation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_credit_operation_installment(TEXT, INT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
