-- Create debentures tables to support the new upload flow
CREATE TABLE IF NOT EXISTS public.debentures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_name TEXT NOT NULL,
  total_volume NUMERIC NOT NULL,
  issue_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.debenture_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debenture_id UUID NOT NULL REFERENCES public.debentures(id) ON DELETE CASCADE,
  series_number TEXT NOT NULL,
  volume NUMERIC NOT NULL,
  indexer TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  maturity_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.debentures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debenture_series ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DO $ policies $
BEGIN
  -- Debentures policies
  DROP POLICY IF EXISTS "auth_all_debentures" ON public.debentures;
  CREATE POLICY "auth_all_debentures" ON public.debentures
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- Series policies
  DROP POLICY IF EXISTS "auth_all_series" ON public.debenture_series;
  CREATE POLICY "auth_all_series" ON public.debenture_series
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $ policies $;
