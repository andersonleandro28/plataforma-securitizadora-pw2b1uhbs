-- Migration: Add tables and columns for document extraction features

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.investment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  rate TEXT NOT NULL,
  term TEXT NOT NULL,
  min_investment NUMERIC NOT NULL,
  risk TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.borders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  border_number TEXT NOT NULL,
  cedente TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.border_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  border_id UUID NOT NULL REFERENCES public.borders(id) ON DELETE CASCADE,
  document_number TEXT NOT NULL,
  due_date DATE,
  face_value NUMERIC NOT NULL,
  rate TEXT,
  acquisition_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.border_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "auth_all_investment_products" ON public.investment_products;
  CREATE POLICY "auth_all_investment_products" ON public.investment_products 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "auth_all_borders" ON public.borders;
  CREATE POLICY "auth_all_borders" ON public.borders 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "auth_all_border_items" ON public.border_items;
  CREATE POLICY "auth_all_border_items" ON public.border_items 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
