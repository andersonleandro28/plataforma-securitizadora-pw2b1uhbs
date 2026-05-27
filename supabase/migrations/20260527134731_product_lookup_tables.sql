CREATE TABLE IF NOT EXISTS public.product_status_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.risk_rating_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.currency_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL
);

ALTER TABLE public.product_status_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rating_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_status" ON public.product_status_options;
CREATE POLICY "auth_select_status" ON public.product_status_options 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_risk" ON public.risk_rating_options;
CREATE POLICY "auth_select_risk" ON public.risk_rating_options 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_currency" ON public.currency_options;
CREATE POLICY "auth_select_currency" ON public.currency_options 
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.product_status_options (label, value) VALUES
  ('Ativo', 'active'),
  ('Inativo', 'inactive'),
  ('Arquivado', 'archived'),
  ('Rascunho', 'draft')
ON CONFLICT (value) DO NOTHING;

INSERT INTO public.risk_rating_options (label, value) VALUES
  ('Baixo', 'low'),
  ('Médio', 'medium'),
  ('Alto', 'high'),
  ('Muito Alto', 'very_high')
ON CONFLICT (value) DO NOTHING;

INSERT INTO public.currency_options (label, value) VALUES
  ('BRL (Real)', 'BRL'),
  ('USD (Dólar)', 'USD'),
  ('EUR (Euro)', 'EUR')
ON CONFLICT (value) DO NOTHING;
