DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id UUID, p_admin_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_redemption RECORD;
    v_investment RECORD;
    v_product RECORD;
    v_profile RECORD;
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

    -- PASSO 3: Retorna ao estoque -> +Cotas resgatadas na tabela de produtos
    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_product.id;

    -- PASSO 4: Status investimento -> "Resgatado" (se resgatou tudo)
    UPDATE public.investments 
    SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
        status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
        updated_at = NOW()
    WHERE id = v_investment.id;

    -- PASSO 1: Baixa subscrição -> Atualizar/Deletar registro
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
        
        -- Remove se a quantidade zerar
        DELETE FROM public.debenture_subscriptions 
        WHERE quantity <= 0 
          AND series_id = v_product.series_id 
          AND document_number = v_profile.document_number;
    END IF;

    -- PASSO 2: Atualiza saldo investidor (Aumenta o saldo em caixa livre)
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
    WHERE id = v_profile.id;

    -- Marca resgate como pago
    UPDATE public.investment_redemptions
    SET status = 'paid', updated_at = NOW(), updated_by = p_admin_id
    WHERE id = p_redemption_id;

    -- Log auditoria rigoroso
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
        'investment_redemptions', 
        p_redemption_id, 
        'redemption_paid', 
        p_admin_id, 
        jsonb_build_object(
            'net_value', v_redemption.net_value, 
            'quotas', v_redemption.requested_quotas,
            'message', 'Resgate ID ' || p_redemption_id || ': Baixou ' || v_redemption.requested_quotas || ' cotas, saldo investidor atualizado em R$ ' || v_redemption.net_value,
            'investor_id', v_profile.id
        )
    );
END;
$func$;
