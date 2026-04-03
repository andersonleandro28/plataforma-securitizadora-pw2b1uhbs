DO $$
BEGIN
  -- 1. Add columns to debenture_subscriptions
  ALTER TABLE public.debenture_subscriptions 
  ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

  -- Remove existing RPC if any to replace
  DROP FUNCTION IF EXISTS public.approve_investment(uuid);
  DROP FUNCTION IF EXISTS public.cancel_investment(uuid, uuid);
END $$;

CREATE OR REPLACE FUNCTION public.approve_investment(p_investment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    SET sold_quotas = COALESCE(sold_quotas, 0) + v_inv.quotas 
    WHERE id = v_inv.product_id;

    -- Approve investment
    UPDATE public.investments 
    SET status = 'approved', updated_at = NOW() 
    WHERE id = p_investment_id;

    -- Sync to legacy debenture_subscriptions
    IF v_prod.series_id IS NOT NULL THEN
        INSERT INTO public.debenture_subscriptions (investment_id, series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date, status)
        SELECT 
            p_investment_id,
            v_prod.series_id,
            COALESCE(p.full_name, p.email),
            p.document_number,
            v_inv.quotas,
            v_inv.unit_price,
            v_inv.total_value,
            CURRENT_DATE,
            'Ativo'
        FROM public.profiles p WHERE p.id = v_inv.user_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_investment(p_investment_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_inv RECORD;
    v_prod RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
    
    IF v_inv.status = 'cancelled' OR v_inv.status = 'Excluído' THEN
        RETURN;
    END IF;

    IF v_inv.status = 'approved' THEN
        SELECT * INTO v_prod FROM public.investment_products WHERE id = v_inv.product_id FOR UPDATE;
        
        -- Revert sold quotas
        UPDATE public.investment_products 
        SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_inv.quotas)
        WHERE id = v_inv.product_id;

        -- Soft delete the subscription
        UPDATE public.debenture_subscriptions
        SET status = 'Excluído', deleted_at = NOW(), deleted_by = p_admin_id
        WHERE investment_id = p_investment_id;
    END IF;

    -- Update investment status
    UPDATE public.investments 
    SET status = 'Excluído', updated_at = NOW() 
    WHERE id = p_investment_id;

    -- Log audit
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
        'investments', 
        p_investment_id, 
        'admin_deleted_investment', 
        p_admin_id, 
        jsonb_build_object('message', 'Investimento ' || p_investment_id || ' excluído pelo Admin.')
    );
END;
$function$;
