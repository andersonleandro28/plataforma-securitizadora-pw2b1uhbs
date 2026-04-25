ALTER TABLE public.investment_redemptions
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_amount numeric DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Resgates e Rendimentos') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Resgates e Rendimentos', 'out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Impostos e Taxas') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Impostos e Taxas', 'out');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_redemption RECORD;
    v_investment RECORD;
    v_product RECORD;
    v_profile RECORD;
    v_cat_resgate uuid;
    v_cat_imposto uuid;
BEGIN
    -- 1. Lock redemption
    SELECT * INTO v_redemption FROM public.investment_redemptions WHERE id = p_redemption_id FOR UPDATE;
    IF v_redemption.status != 'approved' THEN
        RAISE EXCEPTION 'O resgate precisa estar aprovado para ser pago.';
    END IF;

    -- 2. Lock investment
    SELECT * INTO v_investment FROM public.investments WHERE id = v_redemption.investment_id FOR UPDATE;

    -- 3. Lock product
    SELECT * INTO v_product FROM public.investment_products WHERE id = v_investment.product_id FOR UPDATE;

    -- 4. Lock profile (investor)
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_redemption.user_id FOR UPDATE;

    SELECT id INTO v_cat_resgate FROM public.transaction_categories WHERE name = 'Resgates e Rendimentos' LIMIT 1;
    SELECT id INTO v_cat_imposto FROM public.transaction_categories WHERE name = 'Impostos e Taxas' LIMIT 1;

    -- PASSO 3: Retorna ao estoque
    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_product.id;

    -- PASSO 4: Status investimento
    UPDATE public.investments
    SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
        status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
        updated_at = NOW()
    WHERE id = v_investment.id;

    -- PASSO 1: Baixa subscrição
    IF v_product.series_id IS NOT NULL THEN
        UPDATE public.debenture_subscriptions
        SET quantity = GREATEST(0, quantity - v_redemption.requested_quotas),
            total_amount = GREATEST(0, total_amount - (v_redemption.requested_quotas * unit_price))
        WHERE id = (
            SELECT id FROM public.debenture_subscriptions
            WHERE series_id = v_product.series_id
              AND document_number = v_profile.document_number
            ORDER BY created_at ASC LIMIT 1
        );

        DELETE FROM public.debenture_subscriptions
        WHERE quantity <= 0
          AND series_id = v_product.series_id
          AND document_number = v_profile.document_number;
    END IF;

    -- PASSO 2: Atualiza saldo investidor
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
    WHERE id = v_profile.id;

    -- Marca resgate como pago
    UPDATE public.investment_redemptions
    SET status = 'paid', updated_at = NOW(), updated_by = p_admin_id
    WHERE id = p_redemption_id;

    -- Lançamentos na Tesouraria
    INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by)
    VALUES ('out', v_redemption.net_value, 'Pagamento de Resgate - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id);

    IF COALESCE(v_redemption.tax_amount, 0) > 0 THEN
        INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by)
        VALUES ('out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) - Resgate ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Impostos e Taxas', v_cat_imposto, CURRENT_DATE, p_admin_id);
    END IF;

    -- Log auditoria
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
        'investment_redemptions',
        p_redemption_id,
        'redemption_paid',
        p_admin_id,
        jsonb_build_object(
            'net_value', v_redemption.net_value,
            'tax_amount', v_redemption.tax_amount,
            'quotas', v_redemption.requested_quotas,
            'message', 'Resgate ID ' || p_redemption_id || ': Baixou ' || v_redemption.requested_quotas || ' cotas, saldo investidor atualizado em R$ ' || v_redemption.net_value || '. IR Retido: R$ ' || COALESCE(v_redemption.tax_amount, 0),
            'investor_id', v_profile.id
        )
    );
END;
$function$;
