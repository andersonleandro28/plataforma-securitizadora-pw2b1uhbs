-- Expand investment_products table with new fields for the advanced module
ALTER TABLE public.investment_products
ADD COLUMN IF NOT EXISTS rating TEXT DEFAULT 'Risco Médio',
ADD COLUMN IF NOT EXISTS manager TEXT,
ADD COLUMN IF NOT EXISTS management_policy TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS global_quotas INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS quota_value NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS min_quotas_per_investor INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_quotas_per_investor INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS sold_quotas INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS application_cotization_months INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS redemption_cotization_months INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS financial_settlement TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS target_audience TEXT,
ADD COLUMN IF NOT EXISTS grace_period TEXT,
ADD COLUMN IF NOT EXISTS offer_start_date DATE,
ADD COLUMN IF NOT EXISTS offer_end_date DATE,
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Ensure RLS allows the necessary operations for authenticated users
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "auth_all_investment_products" ON public.investment_products;
  CREATE POLICY "auth_all_investment_products" ON public.investment_products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
