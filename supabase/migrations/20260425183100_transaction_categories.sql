CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.treasury_transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_transaction_categories" ON public.transaction_categories;
CREATE POLICY "auth_all_transaction_categories" ON public.transaction_categories 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert requested defaults
INSERT INTO public.transaction_categories (name, type) VALUES
  ('Tarifa Bancária (TED/PIX/Transferências)', 'out'),
  ('Cesta de Serviços Bancários', 'out'),
  ('Tarifa de Emissão de Boletos', 'out'),
  ('Multa', 'out'),
  ('Juros', 'out'),
  ('Receitas Diversas', 'in')
ON CONFLICT (name) DO NOTHING;
