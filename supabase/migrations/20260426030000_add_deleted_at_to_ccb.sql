ALTER TABLE public.ccb_solicitacoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
