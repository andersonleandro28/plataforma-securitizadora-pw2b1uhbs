DO $$
BEGIN
  ALTER TABLE public.treasury_transactions ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE;
END $$;

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
        category = NEW.category
      WHERE expense_id = NEW.id;
    ELSE
      INSERT INTO public.treasury_transactions (type, amount, date, description, category, expense_id, is_escrow)
      VALUES ('out', NEW.amount, COALESCE(NEW.payment_date, NEW.due_date), NEW.description, NEW.category, NEW.id, false);
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
