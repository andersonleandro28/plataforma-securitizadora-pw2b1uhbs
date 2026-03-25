DO $$ 
BEGIN
  -- Add new columns to investment_products for redemption rules
  ALTER TABLE public.investment_products ADD COLUMN IF NOT EXISTS allow_early_redemption BOOLEAN DEFAULT false;
  ALTER TABLE public.investment_products ADD COLUMN IF NOT EXISTS early_redemption_penalty_pct NUMERIC DEFAULT 0;
  ALTER TABLE public.investment_products ADD COLUMN IF NOT EXISTS early_redemption_discount_pct NUMERIC DEFAULT 0;
  ALTER TABLE public.investment_products ADD COLUMN IF NOT EXISTS min_grace_period_months INTEGER DEFAULT 0;

  -- Add redeemed_quotas to investments to track partial/full redemptions
  ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS redeemed_quotas INTEGER DEFAULT 0;
EXCEPTION
  WHEN others THEN null;
END $$;

-- Create investment_redemptions table
CREATE TABLE IF NOT EXISTS public.investment_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_quotas INTEGER NOT NULL,
    gross_value NUMERIC NOT NULL,
    net_value NUMERIC NOT NULL,
    penalty_applied NUMERIC DEFAULT 0,
    discount_applied NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, paid
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS Policies for investment_redemptions
ALTER TABLE public.investment_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_investment_redemptions" ON public.investment_redemptions;
CREATE POLICY "auth_all_investment_redemptions" ON public.investment_redemptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC for processing payment securely and atomically
CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id UUID, p_admin_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_redemption RECORD;
    v_investment RECORD;
BEGIN
    SELECT * INTO v_redemption FROM public.investment_redemptions WHERE id = p_redemption_id FOR UPDATE;
    IF v_redemption.status != 'approved' THEN
        RAISE EXCEPTION 'O resgate precisa estar aprovado para ser pago.';
    END IF;

    SELECT * INTO v_investment FROM public.investments WHERE id = v_redemption.investment_id FOR UPDATE;

    -- Incrementar cotas resgatadas e ajustar status se resgate total
    UPDATE public.investments 
    SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
        status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
        updated_at = NOW()
    WHERE id = v_investment.id;

    -- Devolver cotas para a vitrine (estoque)
    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_investment.product_id;

    -- Atualizar status do resgate para finalizado (paid)
    UPDATE public.investment_redemptions
    SET status = 'paid', updated_at = NOW(), updated_by = p_admin_id
    WHERE id = p_redemption_id;

    -- Registrar log de auditoria
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES ('investment_redemptions', p_redemption_id, 'redemption_paid', p_admin_id, jsonb_build_object('net_value', v_redemption.net_value));
END;
$func$;
