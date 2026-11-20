-- TROCA DE CONTA DE DESPESA = MIGRAÇÃO (nunca duplicação)
--
-- A trigger on_expense_paid (sync_expense_to_treasury) recriava/atualizava o
-- espelho de tesouraria a cada UPDATE, porém SEM o campo bank_account_id: o
-- espelho ficava sem conta (ou na conta antiga) quando a despesa trocava de
-- conta, fazendo o motor contábil lançar a saída na conta errada / sem conta —
-- e a edição da despesa aparecia como "lançamento novo na BNK Digital" sem
-- remover o da Conta Principal (a duplicação relatada pelo usuário).
--
-- Correção cirúrgica: o espelho passa a CARREGAR a conta da despesa no
-- UPDATE (migração) e no INSERT — nunca um segundo lançamento.
-- Nenhum dado é alterado aqui (a limpeza das duplicatas já derivadas é feita
-- à parte, auditável); apenas a mecânica da trigger.

CREATE OR REPLACE FUNCTION public.sync_expense_to_treasury()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    IF EXISTS (SELECT 1 FROM public.treasury_transactions WHERE expense_id = NEW.id) THEN
      UPDATE public.treasury_transactions
      SET
        amount = NEW.amount,
        date = COALESCE(NEW.payment_date, NEW.due_date),
        description = NEW.description,
        category = NEW.category,
        bank_account_id = NEW.bank_account_id
      WHERE expense_id = NEW.id;
    ELSE
      INSERT INTO public.treasury_transactions (type, amount, date, description, category, expense_id, is_escrow, bank_account_id)
      VALUES ('out', NEW.amount, COALESCE(NEW.payment_date, NEW.due_date), NEW.description, NEW.category, NEW.id, false, NEW.bank_account_id);
    END IF;
  ELSIF NEW.status = 'pending' THEN
    DELETE FROM public.treasury_transactions WHERE expense_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_expense_paid ON public.expenses;
CREATE TRIGGER on_expense_paid
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_to_treasury();
