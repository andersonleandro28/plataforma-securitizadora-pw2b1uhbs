-- Create Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    branch TEXT,
    account_number TEXT,
    pix_key TEXT,
    owner_name TEXT NOT NULL,
    owner_document TEXT NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create Investments Table
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.investment_products(id) ON DELETE CASCADE NOT NULL,
    bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
    quotas INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_value NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending_transfer', -- pending_transfer, awaiting_review, approved, rejected
    rejection_reason TEXT,
    transfer_date DATE,
    transfer_value NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Investment Proofs Table
CREATE TABLE IF NOT EXISTS public.investment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setup Storage Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('investment-proofs', 'investment-proofs', false) ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
DROP POLICY IF EXISTS "auth_upload_proofs" ON storage.objects;
CREATE POLICY "auth_upload_proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'investment-proofs');

DROP POLICY IF EXISTS "auth_read_proofs" ON storage.objects;
CREATE POLICY "auth_read_proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'investment-proofs');

-- RLS Policies for Tables
DROP POLICY IF EXISTS "auth_all_company_bank_accounts" ON public.company_bank_accounts;
CREATE POLICY "auth_all_company_bank_accounts" ON public.company_bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_investments" ON public.investments;
CREATE POLICY "auth_all_investments" ON public.investments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_investment_proofs" ON public.investment_proofs;
CREATE POLICY "auth_all_investment_proofs" ON public.investment_proofs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC to toggle active bank account
CREATE OR REPLACE FUNCTION public.set_active_bank_account(p_account_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.company_bank_accounts SET is_active = false WHERE id != p_account_id;
  UPDATE public.company_bank_accounts SET is_active = true WHERE id = p_account_id;
END;
$$;

-- RPC to approve investment atomically
CREATE OR REPLACE FUNCTION public.approve_investment(p_investment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_inv RECORD;
    v_prod RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
    IF v_inv.status != 'awaiting_review' THEN
        RAISE EXCEPTION 'Investment is not pending review';
    END IF;

    SELECT * INTO v_prod FROM public.investment_products WHERE id = v_inv.product_id FOR UPDATE;

    -- Increment sold quotas
    UPDATE public.investment_products 
    SET sold_quotas = sold_quotas + v_inv.quotas 
    WHERE id = v_inv.product_id;

    -- Approve investment
    UPDATE public.investments 
    SET status = 'approved', updated_at = NOW() 
    WHERE id = p_investment_id;

    -- Sync to legacy debenture_subscriptions for backwards compatibility of charts
    IF v_prod.series_id IS NOT NULL THEN
        INSERT INTO public.debenture_subscriptions (series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date)
        SELECT 
            v_prod.series_id,
            COALESCE(p.full_name, p.email),
            p.document_number,
            v_inv.quotas,
            v_inv.unit_price,
            v_inv.total_value,
            CURRENT_DATE
        FROM public.profiles p WHERE p.id = v_inv.user_id;
    END IF;
END;
$$;
