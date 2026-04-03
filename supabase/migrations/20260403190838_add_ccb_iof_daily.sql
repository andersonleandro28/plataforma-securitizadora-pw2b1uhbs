ALTER TABLE public.config_ccb ADD COLUMN IF NOT EXISTS iof_daily_rate_30 numeric NOT NULL DEFAULT 0.0041;
ALTER TABLE public.config_ccb ADD COLUMN IF NOT EXISTS iof_daily_rate_after numeric NOT NULL DEFAULT 0.00274;
