-- Adiciona a coluna bank_code na tabela company_bank_accounts
ALTER TABLE public.company_bank_accounts ADD COLUMN IF NOT EXISTS bank_code TEXT;
