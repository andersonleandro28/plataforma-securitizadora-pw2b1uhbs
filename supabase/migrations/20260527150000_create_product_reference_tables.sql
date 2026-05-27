CREATE TABLE IF NOT EXISTS public.product_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_risk_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for statuses
ALTER TABLE public.product_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_product_statuses" ON public.product_statuses;
CREATE POLICY "auth_all_product_statuses" ON public.product_statuses FOR SELECT TO authenticated USING (true);

-- RLS for risk ratings
ALTER TABLE public.product_risk_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_product_risk_ratings" ON public.product_risk_ratings;
CREATE POLICY "auth_all_product_risk_ratings" ON public.product_risk_ratings FOR SELECT TO authenticated USING (true);

-- RLS for currencies
ALTER TABLE public.product_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_product_currencies" ON public.product_currencies;
CREATE POLICY "auth_all_product_currencies" ON public.product_currencies FOR SELECT TO authenticated USING (true);

-- Seed data using ON CONFLICT DO NOTHING for idempotency
INSERT INTO public.product_statuses (label) VALUES
('Ativo'), 
('Inativo'), 
('Arquivado'), 
('Pendente')
ON CONFLICT (label) DO NOTHING;

INSERT INTO public.product_risk_ratings (label) VALUES
('Risco Baixo'), 
('Risco Médio'), 
('Risco Alto'), 
('AAA'), 
('AA'), 
('A')
ON CONFLICT (label) DO NOTHING;

INSERT INTO public.product_currencies (code, label, symbol) VALUES
('BRL', 'Real', 'R$'),
('USD', 'Dólar', '$')
ON CONFLICT (code) DO NOTHING;
