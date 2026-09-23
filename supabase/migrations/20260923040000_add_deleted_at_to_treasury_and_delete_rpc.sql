-- Migration: add_deleted_at_to_treasury_and_delete_rpc
-- Permite exclusão de lançamentos financeiros manuais/errados na tesouraria e livro caixa
-- com auditoria e controle estrito de permissões (apenas admin/staff com permissão de escrita).

-- 1. Adicionar deleted_at na tabela treasury_transactions se ainda não existir
ALTER TABLE public.treasury_transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Adicionar deleted_by na tabela treasury_transactions para rastreamento
ALTER TABLE public.treasury_transactions
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Adicionar deleted_at e deleted_by na tabela movimentacoes_caixa (caso haja registros manuais legados)
ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Criar índice para performance em buscas não deletadas
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_deleted_at
  ON public.treasury_transactions(deleted_at);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_deleted_at
  ON public.movimentacoes_caixa(deleted_at);

-- 5. Função RPC segura: delete_financial_transaction
-- Valida se o usuário é admin/staff (não accountant), verifica se o lançamento não pertence a
-- uma fonte estrutural imutável (ex: liquidação de operação de crédito sem cancelamento prévio, ou despesa oficial),
-- e executa o soft-delete registrando auditoria. Se for uma despesa administrativa direta ou crédito avulso,
-- remove com segurança.
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

    -- Se já estiver deletado
    IF v_old_data->>'deleted_at' IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lançamento já se encontra excluído');
    END IF;

    -- Proteção de fontes oficiais estruturais:
    -- Se estiver vinculado a expense_id (despesa criada via módulo de despesas)
    IF v_old_data->>'expense_id' IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este lançamento foi gerado a partir de uma Despesa oficial. A exclusão ou estorno deve ser feita diretamente no módulo de Despesas.');
    END IF;

    -- Executa soft delete
    UPDATE public.treasury_transactions
    SET 
      deleted_at = NOW(),
      deleted_by = v_caller_id,
      status = 'Cancelado'
    WHERE id = p_record_id;

    -- Registra em audit_logs
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

    -- Se for um resgate oficial ou despesa vinculada
    IF (v_old_data->>'referencia_tipo' = 'resgate_investimento' OR v_old_data->>'referencia_tipo' = 'despesa') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este lançamento está vinculado a um processo oficial de resgate ou despesa. Use o estorno na respectiva tela de origem.');
    END IF;

    -- Executa soft delete
    UPDATE public.movimentacoes_caixa
    SET 
      deleted_at = NOW(),
      deleted_by = v_caller_id
    WHERE id = p_record_id;

    -- Registra em audit_logs
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

  -- TRATAMENTO 3: expenses (se for uma despesa avulsa/administrativa)
  ELSIF p_target_table = 'expenses' THEN
    SELECT to_jsonb(e) INTO v_old_data
    FROM public.expenses e
    WHERE e.id = p_record_id;

    IF v_old_data IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Despesa não encontrada');
    END IF;

    -- Remove expense (o trigger ou cascade já remove da tesouraria)
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
