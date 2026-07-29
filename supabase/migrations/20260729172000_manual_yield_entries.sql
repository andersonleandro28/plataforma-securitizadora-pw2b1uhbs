-- Add yield_split_pct column to investment_products
ALTER TABLE public.investment_products
ADD COLUMN IF NOT EXISTS yield_split_pct NUMERIC NOT NULL DEFAULT 50;

-- Create manual_yield_entries table
CREATE TABLE IF NOT EXISTS public.manual_yield_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  gross_percentage NUMERIC NOT NULL,
  client_percentage NUMERIC NOT NULL,
  securitizadora_percentage NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS manual_yield_entries_product_id_idx ON public.manual_yield_entries(product_id);
CREATE INDEX IF NOT EXISTS manual_yield_entries_period_idx ON public.manual_yield_entries(period);

-- Enable RLS
ALTER TABLE public.manual_yield_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then create new ones
DROP POLICY IF EXISTS "manual_yield_admin_all" ON public.manual_yield_entries;
CREATE POLICY "manual_yield_admin_all" ON public.manual_yield_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('admin'::app_role, 'staff'::app_role) OR profiles.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('admin'::app_role, 'staff'::app_role) OR profiles.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "manual_yield_investor_select" ON public.manual_yield_entries;
CREATE POLICY "manual_yield_investor_select" ON public.manual_yield_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investments inv
      WHERE inv.product_id = manual_yield_entries.product_id
      AND inv.user_id = auth.uid()
    )
  );
