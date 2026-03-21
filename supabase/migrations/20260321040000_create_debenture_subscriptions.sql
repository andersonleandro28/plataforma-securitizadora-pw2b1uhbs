-- Create debenture subscriptions table
CREATE TABLE IF NOT EXISTS public.debenture_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.debenture_series(id) ON DELETE CASCADE,
  investor_name TEXT NOT NULL,
  document_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  subscription_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.debenture_subscriptions ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DO $$
BEGIN
  DROP POLICY IF EXISTS "auth_all_subscriptions" ON public.debenture_subscriptions;
  CREATE POLICY "auth_all_subscriptions" ON public.debenture_subscriptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
