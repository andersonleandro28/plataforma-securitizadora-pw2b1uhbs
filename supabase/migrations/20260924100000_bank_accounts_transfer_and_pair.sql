-- Migration: add_transfer_fields_and_atomic_transfer_rpc
-- Adiciona campos de rastreio de transferências entre contas bancárias no Livro Caixa (movimentacoes_caixa),
-- cria índices e implementa RPC atômica para efetivação de transferências com validação de saldo e espelhamento,
-- além de suporte a exclusão em par na delete_financial_transaction.

-- 1. Adicionar colunas de transferência em movimentacoes_caixa se não existirem
ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS transfer_pair_id UUID DEFAULT NULL;

ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS transfer_counterpart_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;

-- 2. Índices para lookup rápido de transferências
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_transfer_pair_id
  ON public.movimentacoes_caixa(transfer_pair_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_transfer_counterpart_acc
  ON public.movimentacoes_caixa(transfer_counterpart_account_id);

-- 3. Função RPC para calcular saldo em tempo real de uma conta bancária específica no Livro Caixa
CREATE OR REPLACE FUNCTION public.get_bank_account_balance(p_bank_account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_balance NUMERIC := 0;
  v_active_id UUID;
  v_is_target_active BOOLEAN := FALSE;
BEGIN
  -- Identifica conta ativa padrão (fallback de lançamentos sem bank_account_id)
  SELECT id INTO v_active_id
  FROM public.company_bank_accounts
  WHERE is_active = TRUE
  LIMIT 1;

  IF v_active_id IS NULL THEN
    SELECT id INTO v_active_id
    FROM public.company_bank_accounts
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  v_is_target_active := (p_bank_account_id = v_active_id);

  -- Calcula saldo considerando entradas positivas e saídas negativas
  -- Lançamentos sem bank_account_id são atribuídos à conta bancária ativa
  SELECT COALESCE(SUM(
    CASE 
      WHEN lower(trim(tipo)) = 'entrada' THEN COALESCE(valor, 0)
      ELSE -COALESCE(valor, 0)
    END
  ), 0) INTO v_balance
  FROM public.movimentacoes_caixa
  WHERE deleted_at IS NULL
    AND (
      bank_account_id = p_bank_account_id
      OR (bank_account_id IS NULL AND v_is_target_active)
    );

  RETURN v_balance;
END;
$$;

-- 4. Função RPC atômica para registrar transferência entre contas bancárias
CREATE OR REPLACE FUNCTION public.execute_bank_transfer(
  p_source_account_id UUID,
  p_destination_account_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_source_acc RECORD;
  v_dest_acc RECORD;
  v_source_balance NUMERIC;
  v_pair_id UUID;
  v_out_id UUID;
  v_in_id UUID;
  v_desc_out TEXT;
  v_desc_in TEXT;
  v_timestamp TIMESTAMPTZ;
BEGIN
  -- 1. Autenticação e autorização
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado.');
  END IF;

  SELECT role, is_admin, is_staff, is_accountant
  INTO v_caller_profile
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_profile.is_admin = TRUE 
     OR v_caller_profile.role = 'admin'::app_role 
     OR v_caller_profile.is_staff = TRUE 
     OR v_caller_profile.role = 'staff'::app_role THEN
    v_is_authorized := TRUE;
  END IF;

  -- Usuário contador ou sem privilégio de escrita não pode efetuar transferências
  IF v_caller_profile.is_accountant = TRUE 
     AND v_caller_profile.is_admin IS NOT TRUE 
     AND v_caller_profile.role != 'admin'::app_role THEN
    v_is_authorized := FALSE;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada. Apenas administradores podem realizar transferências entre contas.');
  END IF;

  -- 2. Validações básicas
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contas de origem e destino devem ser informadas.');
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'A conta de origem e a conta de destino devem ser diferentes.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor da transferência deve ser maior que zero.');
  END IF;

  IF p_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A data da transferência deve ser informada.');
  END IF;

  -- 3. Obter dados das contas
  SELECT id, bank_name, branch, account_number
  INTO v_source_acc
  FROM public.company_bank_accounts
  WHERE id = p_source_account_id;

  IF v_source_acc.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta de origem não encontrada.');
  END IF;

  SELECT id, bank_name, branch, account_number
  INTO v_dest_acc
  FROM public.company_bank_accounts
  WHERE id = p_destination_account_id;

  IF v_dest_acc.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta de destino não encontrada.');
  END IF;

  -- 4. Validação de saldo em tempo real na conta de origem
  v_source_balance := public.get_bank_account_balance(p_source_account_id);
  IF v_source_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente na conta de origem para esta transferência. Saldo atual: R$ ' || to_char(v_source_balance, 'FM999G999G990D00')
    );
  END IF;

  -- 5. Montar descrições e identificador de par
  v_pair_id := gen_random_uuid();
  v_out_id := gen_random_uuid();
  v_in_id := gen_random_uuid();
  
  -- Timestamp com horário de meio-dia local da data escolhida para evitar fuso
  v_timestamp := (p_date::TEXT || ' 12:00:00+00')::TIMESTAMPTZ;

  v_desc_out := 'Transferência entre contas — de ' || v_source_acc.bank_name || ' (' || v_source_acc.account_number || ') para ' || v_dest_acc.bank_name || ' (' || v_dest_acc.account_number || ')' || COALESCE(' — ' || NULLIF(trim(p_notes), ''), '');
  v_desc_in := 'Transferência entre contas — recebido de ' || v_source_acc.bank_name || ' (' || v_source_acc.account_number || ') em ' || v_dest_acc.bank_name || ' (' || v_dest_acc.account_number || ')' || COALESCE(' — ' || NULLIF(trim(p_notes), ''), '');

  -- 6. Inserir perna de SAÍDA na conta de origem
  INSERT INTO public.movimentacoes_caixa (
    id,
    tipo,
    categoria,
    descricao,
    valor,
    bank_account_id,
    created_at,
    user_id,
    referencia_id,
    referencia_tipo,
    referencia_numero,
    transfer_pair_id,
    transfer_counterpart_account_id
  ) VALUES (
    v_out_id,
    'saida',
    'Transferência entre Contas',
    v_desc_out,
    p_amount,
    p_source_account_id,
    v_timestamp,
    v_caller_id,
    v_pair_id,
    'transferencia_entre_contas',
    substr(v_pair_id::text, 1, 8),
    v_pair_id,
    p_destination_account_id
  );

  -- 7. Inserir perna de ENTRADA na conta de destino
  INSERT INTO public.movimentacoes_caixa (
    id,
    tipo,
    categoria,
    descricao,
    valor,
    bank_account_id,
    created_at,
    user_id,
    referencia_id,
    referencia_tipo,
    referencia_numero,
    transfer_pair_id,
    transfer_counterpart_account_id
  ) VALUES (
    v_in_id,
    'entrada',
    'Transferência entre Contas',
    v_desc_in,
    p_amount,
    p_destination_account_id,
    v_timestamp,
    v_caller_id,
    v_pair_id,
    'transferencia_entre_contas',
    substr(v_pair_id::text, 1, 8),
    v_pair_id,
    p_source_account_id
  );

  -- 8. Auditoria
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    v_caller_id,
    'bank_transfer',
    'movimentacoes_caixa',
    v_pair_id,
    jsonb_build_object(
      'pair_id', v_pair_id,
      'source_account_id', p_source_account_id,
      'destination_account_id', p_destination_account_id,
      'amount', p_amount,
      'date', p_date,
      'out_record_id', v_out_id,
      'in_record_id', v_in_id,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transferência de R$ ' || to_char(p_amount, 'FM999G999G990D00') || ' realizada com sucesso!',
    'pair_id', v_pair_id,
    'out_id', v_out_id,
    'in_id', v_in_id
  );
END;
$$;

-- 5. Atualizar função delete_financial_transaction para tratar exclusão conjunta do par de transferências
CREATE OR REPLACE FUNCTION public.delete_financial_transaction(
  p_target_table TEXT,
  p_record_id UUID,
  p_justification TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_old_data JSONB;
  v_pair_id UUID;
  v_affected_count INT := 0;
BEGIN
  -- Identifica usuário autenticado
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Checa perfil e permissões
  SELECT role, is_admin, is_staff, is_accountant
  INTO v_caller_profile
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_profile.is_admin = TRUE OR v_caller_profile.role = 'admin'::app_role OR v_caller_profile.is_staff = TRUE OR v_caller_profile.role = 'staff'::app_role THEN
    v_is_authorized := TRUE;
  END IF;

  -- Accountant é estritamente somente leitura
  IF v_caller_profile.is_accountant = TRUE AND v_caller_profile.is_admin IS NOT TRUE AND v_caller_profile.role != 'admin'::app_role THEN
    v_is_authorized := FALSE;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada. Apenas administradores e equipe autorizada podem excluir lançamentos.');
  END IF;

  -- TRATAMENTO 1: treasury_transactions
  IF p_target_table = 'treasury_transactions' THEN
    SELECT to_jsonb(t) INTO v_old_data
    FROM public.treasury_transactions t
    WHERE t.id = p_record_id;

    IF v_old_data IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lançamento não encontrado');
    END IF;

    IF v_old_data->>'deleted_at' IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lançamento já se encontra excluído');
    END IF;

    IF v_old_data->>'expense_id' IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este lançamento foi gerado a partir de uma Despesa oficial. A exclusão ou estorno deve ser feita diretamente no módulo de Despesas.');
    END IF;

    UPDATE public.treasury_transactions
    SET 
      deleted_at = NOW(),
      deleted_by = v_caller_id,
      status = 'Cancelado'
    WHERE id = p_record_id;

    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_caller_id,
      'delete_treasury_transaction',
      'treasury_transactions',
      p_record_id,
      jsonb_build_object(
        'justification', p_justification,
        'deleted_record', v_old_data
      )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Lançamento de tesouraria excluído com sucesso.');

  -- TRATAMENTO 2: movimentacoes_caixa
  ELSIF p_target_table = 'movimentacoes_caixa' THEN
    SELECT to_jsonb(m) INTO v_old_data
    FROM public.movimentacoes_caixa m
    WHERE m.id = p_record_id;

    IF v_old_data IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lançamento de caixa não encontrado');
    END IF;

    IF v_old_data->>'deleted_at' IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lançamento já se encontra excluído');
    END IF;

    IF (v_old_data->>'referencia_tipo' = 'resgate_investimento' OR v_old_data->>'referencia_tipo' = 'despesa') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este lançamento está vinculado a um processo oficial de resgate ou despesa. Use o estorno na respectiva tela de origem.');
    END IF;

    -- Se for parte de uma transferência entre contas, exclui AMBAS as pernas atomicamente
    IF v_old_data->>'transfer_pair_id' IS NOT NULL OR v_old_data->>'referencia_tipo' = 'transferencia_entre_contas' THEN
      v_pair_id := COALESCE((v_old_data->>'transfer_pair_id')::UUID, (v_old_data->>'referencia_id')::UUID);

      IF v_pair_id IS NOT NULL THEN
        UPDATE public.movimentacoes_caixa
        SET 
          deleted_at = NOW(),
          deleted_by = v_caller_id
        WHERE (transfer_pair_id = v_pair_id OR referencia_id = v_pair_id)
          AND deleted_at IS NULL;
        
        GET DIAGNOSTICS v_affected_count = ROW_COUNT;

        INSERT INTO public.audit_logs (
          user_id,
          action,
          entity_type,
          entity_id,
          details
        ) VALUES (
          v_caller_id,
          'delete_bank_transfer_pair',
          'movimentacoes_caixa',
          v_pair_id,
          jsonb_build_object(
            'justification', p_justification,
            'pair_id', v_pair_id,
            'affected_records', v_affected_count,
            'triggered_by_record_id', p_record_id
          )
        );

        RETURN jsonb_build_object('success', true, 'message', 'O par de lançamentos da transferência (origem e destino) foi excluído com sucesso.');
      END IF;
    END IF;

    -- Exclusão comum avulsa
    UPDATE public.movimentacoes_caixa
    SET 
      deleted_at = NOW(),
      deleted_by = v_caller_id
    WHERE id = p_record_id;

    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_caller_id,
      'delete_movimentacao_caixa',
      'movimentacoes_caixa',
      p_record_id,
      jsonb_build_object(
        'justification', p_justification,
        'deleted_record', v_old_data
      )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Lançamento de caixa excluído com sucesso.');

  -- TRATAMENTO 3: expenses
  ELSIF p_target_table = 'expenses' THEN
    SELECT to_jsonb(e) INTO v_old_data
    FROM public.expenses e
    WHERE e.id = p_record_id;

    IF v_old_data IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Despesa não encontrada');
    END IF;

    DELETE FROM public.expenses WHERE id = p_record_id;

    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_caller_id,
      'delete_expense',
      'expenses',
      p_record_id,
      jsonb_build_object(
        'justification', p_justification,
        'deleted_record', v_old_data
      )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Despesa excluída com sucesso.');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Tabela de destino inválida para exclusão: ' || p_target_table);
  END IF;
END;
$$;
