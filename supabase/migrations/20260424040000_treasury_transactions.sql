CREATE TABLE IF NOT EXISTS public.treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    is_escrow BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_treasury_transactions" ON public.treasury_transactions;
CREATE POLICY "auth_all_treasury_transactions" ON public.treasury_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
