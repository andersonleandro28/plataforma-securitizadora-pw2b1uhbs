DO $$
BEGIN
  -- 1. Adiciona coluna de referencia para conectar o lancamento a operacao originaria
  ALTER TABLE public.treasury_transactions ADD COLUMN IF NOT EXISTS reference_id UUID;

  -- 2. Limpa os lancamentos manuais e duplicados gerados nos testes anteriores
  DELETE FROM public.treasury_transactions 
  WHERE description LIKE 'Devolução de Capital - Resgate%' 
     OR description LIKE 'Distribuição de Lucros/Juros - Resgate%';

  -- 3. Reconecta os lancamentos consolidados (Valor Liquido e Imposto) com os resgates originais
  UPDATE public.treasury_transactions tt
  SET reference_id = ir.id
  FROM public.investment_redemptions ir
  JOIN public.profiles p ON ir.user_id = p.id
  WHERE tt.description = 'Pagamento de Resgate - ' || COALESCE(p.full_name, p.pj_company_name, 'Investidor')
    AND tt.reference_id IS NULL;

  UPDATE public.treasury_transactions tt
  SET reference_id = ir.id
  FROM public.investment_redemptions ir
  JOIN public.profiles p ON ir.user_id = p.id
  WHERE tt.description = 'Imposto a Recolher (IRRF) - Resgate ' || COALESCE(p.full_name, p.pj_company_name, 'Investidor')
    AND tt.reference_id IS NULL;

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
    v_cat_invest uuid;
    v_reinvest_amount numeric := 0;
    v_troco numeric := 0;
    v_new_inv_id uuid;
    v_target_product RECORD;
BEGIN
    SELECT * INTO v_redemption FROM public.investment_redemptions WHERE id = p_redemption_id FOR UPDATE;
    IF v_redemption.status != 'approved' THEN
        RAISE EXCEPTION 'O resgate precisa estar aprovado para ser pago.';
    END IF;

    SELECT * INTO v_investment FROM public.investments WHERE id = v_redemption.investment_id FOR UPDATE;
    SELECT * INTO v_product FROM public.investment_products WHERE id = v_investment.product_id FOR UPDATE;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_redemption.user_id FOR UPDATE;

    SELECT id INTO v_cat_resgate FROM public.transaction_categories WHERE name = 'Resgates e Rendimentos' LIMIT 1;
    SELECT id INTO v_cat_imposto FROM public.transaction_categories WHERE name = 'Impostos e Taxas' LIMIT 1;
    SELECT id INTO v_cat_invest FROM public.transaction_categories WHERE name = 'Investimento' LIMIT 1;

    IF v_cat_invest IS NULL THEN
        SELECT id INTO v_cat_invest FROM public.transaction_categories LIMIT 1;
    END IF;

    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_product.id;

    UPDATE public.investments
    SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
        status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
        updated_at = NOW()
    WHERE id = v_investment.id;

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

    IF v_redemption.is_reinvestment AND v_redemption.reinvestment_product_id IS NOT NULL THEN
        SELECT * INTO v_target_product FROM public.investment_products WHERE id = v_redemption.reinvestment_product_id FOR UPDATE;
        
        v_reinvest_amount := v_redemption.reinvestment_quotas * COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000);
        v_troco := v_redemption.net_value - v_reinvest_amount;
        
        IF v_troco < 0 THEN
            v_troco := 0;
        END IF;

        UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_troco
        WHERE id = v_profile.id;

        v_new_inv_id := gen_random_uuid();
        INSERT INTO public.investments (
            id, user_id, product_id, bank_account_id, quotas, unit_price, total_value, status, transfer_date
        ) VALUES (
            v_new_inv_id, v_profile.id, v_target_product.id, v_investment.bank_account_id, v_redemption.reinvestment_quotas, 
            COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000), v_reinvest_amount, 'approved', CURRENT_DATE
        );

        UPDATE public.investment_products
        SET sold_quotas = COALESCE(sold_quotas, 0) + v_redemption.reinvestment_quotas
        WHERE id = v_target_product.id;

        IF v_target_product.series_id IS NOT NULL THEN
            INSERT INTO public.debenture_subscriptions (
                investment_id, series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date, status
            ) VALUES (
                v_new_inv_id, v_target_product.series_id, COALESCE(v_profile.full_name, v_profile.pj_company_name, v_profile.email), 
                v_profile.document_number, v_redemption.reinvestment_quotas, COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000), 
                v_reinvest_amount, CURRENT_DATE, 'Ativo'
            );
        END IF;

        INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
        VALUES ('out', v_redemption.net_value, 'Resgate (Base p/ Reinvestimento) - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
        
        INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
        VALUES ('in', v_reinvest_amount, 'Integralização por Conversão de Crédito - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Investimento', v_cat_invest, CURRENT_DATE, p_admin_id, true, v_new_inv_id);
        
        IF v_troco > 0 THEN
            INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
            VALUES ('out', v_troco, 'Resgate de Sobra de Subscrição - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
        END IF;

    ELSE
        UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
        WHERE id = v_profile.id;

        INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
        VALUES ('out', v_redemption.net_value, 'Pagamento de Resgate - ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Resgates e Rendimentos', v_cat_resgate, CURRENT_DATE, p_admin_id, true, p_redemption_id);
    END IF;

    IF COALESCE(v_redemption.tax_amount, 0) > 0 THEN
        INSERT INTO public.treasury_transactions (type, amount, description, category, category_id, date, created_by, is_escrow, reference_id)
        VALUES ('out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) - Resgate ' || COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'), 'Impostos e Taxas', v_cat_imposto, CURRENT_DATE, p_admin_id, true, p_redemption_id);
    END IF;

    UPDATE public.investment_redemptions
    SET status = 'paid', updated_at = NOW(), updated_by = p_admin_id
    WHERE id = p_redemption_id;

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
            'is_reinvestment', COALESCE(v_redemption.is_reinvestment, false),
            'reinvest_amount', v_reinvest_amount,
            'troco', v_troco,
            'investor_id', v_profile.id
        )
    );
END;
$function$;
