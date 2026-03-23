-- CREATE TABLE
CREATE TABLE IF NOT EXISTS public.user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT,
  account_number TEXT,
  account_type TEXT NOT NULL,
  pix_key TEXT,
  owner_name TEXT NOT NULL,
  owner_document TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bank accounts" ON public.user_bank_accounts;
CREATE POLICY "Users can view own bank accounts" ON public.user_bank_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can insert own bank accounts" ON public.user_bank_accounts;
CREATE POLICY "Users can insert own bank accounts" ON public.user_bank_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can update own bank accounts" ON public.user_bank_accounts;
CREATE POLICY "Users can update own bank accounts" ON public.user_bank_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can delete own bank accounts" ON public.user_bank_accounts;
CREATE POLICY "Users can delete own bank accounts" ON public.user_bank_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- Function to set active
CREATE OR REPLACE FUNCTION public.set_active_user_bank_account(p_account_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_bank_accounts SET is_active = false WHERE user_id = p_user_id AND id != p_account_id;
  UPDATE public.user_bank_accounts SET is_active = true WHERE id = p_account_id;
END;
$$;
