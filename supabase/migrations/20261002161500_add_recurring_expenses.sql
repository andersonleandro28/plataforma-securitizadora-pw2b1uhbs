-- Migration: add recurring expenses support
-- Idempotent addition of recurrence_group_id, installment_number, total_installments to expenses table

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID NULL,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER NULL,
  ADD COLUMN IF NOT EXISTS total_installments INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_recurrence_group_id
  ON public.expenses (recurrence_group_id);
