-- Adicionar colunas de regras de negócio e vínculo com série real no produto de investimento
ALTER TABLE public.investment_products 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.debenture_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS redemption_rules TEXT,
ADD COLUMN IF NOT EXISTS ir_rules TEXT;
