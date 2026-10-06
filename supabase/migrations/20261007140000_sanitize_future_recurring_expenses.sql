-- Migration: Saneamento de despesas recorrentes futuras incorretamente marcadas como pagas
-- Regra de negócio:
-- Parcelas recorrentes (recurrence_group_id IS NOT NULL) com vencimento futuro (due_date > CURRENT_DATE)
-- que estavam marcadas como 'paid' devem voltar para 'pending' com payment_date = NULL.
-- A trigger sync_expense_to_treasury já remove automaticamente qualquer lançamento em treasury_transactions
-- correspondente a despesas cujo status retorne para 'pending'.
-- Adicionalmente, caso haja registros em mapeamento_movimentacoes e movimentacoes_caixa vinculados a essas despesas,
-- removemos os registros correspondentes para restaurar a fidelidade do Livro Caixa.
-- Parcelas com vencimento hoje ou passado (due_date <= CURRENT_DATE) e despesas avulsas permanecem inalteradas.

DO $$
DECLARE
  r RECORD;
  v_mov_id UUID;
BEGIN
  -- Percorrer todas as parcelas recorrentes futuras indevidamente marcadas como paid
  FOR r IN
    SELECT id, description, due_date, recurrence_group_id
    FROM public.expenses
    WHERE recurrence_group_id IS NOT NULL
      AND status = 'paid'
      AND due_date > CURRENT_DATE
  LOOP
    -- 1. Localizar e remover movimentação de caixa correspondente, se houver
    FOR v_mov_id IN
      SELECT movimentacao_caixa_id
      FROM public.mapeamento_movimentacoes
      WHERE (origem_id = r.id AND origem_tabela IN ('despesas', 'fornecedores'))
         OR (origem_id = r.id)
    LOOP
      DELETE FROM public.mapeamento_movimentacoes WHERE movimentacao_caixa_id = v_mov_id;
      DELETE FROM public.movimentacoes_caixa WHERE id = v_mov_id;
    END LOOP;

    -- Também limpar caso haja movimentacoes_caixa gravadas com referencia_id = r.id diretamente
    DELETE FROM public.movimentacoes_caixa
    WHERE (referencia_id = r.id AND referencia_tipo = 'despesa')
       OR (referencia_id = r.id AND categoria IN ('despesa', 'fornecedor'));

    -- 2. Atualizar a despesa: voltar para 'pending' e anular payment_date
    -- A trigger on_expense_paid (sync_expense_to_treasury) dispara no UPDATE e executa:
    -- DELETE FROM public.treasury_transactions WHERE expense_id = NEW.id;
    UPDATE public.expenses
    SET status = 'pending',
        payment_date = NULL,
        updated_at = NOW()
    WHERE id = r.id;

    -- Garantia defensiva: assegurar que treasury_transactions não mantenha resíduo
    DELETE FROM public.treasury_transactions WHERE expense_id = r.id;

    -- Registrar log de auditoria do saneamento
    INSERT INTO public.audit_logs (entity_type, entity_id, action, details)
    VALUES (
      'expenses',
      r.id,
      'REVERT_FUTURE_RECURRING_EXPENSE_TO_PENDING',
      jsonb_build_object(
        'expense_id', r.id,
        'description', r.description,
        'due_date', r.due_date,
        'recurrence_group_id', r.recurrence_group_id,
        'reason', 'Saneamento: parcela recorrente futura não pode nascer como paga'
      )
    );
  END LOOP;
END $$;
