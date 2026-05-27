DO $$
BEGIN
    -- 1. Treasury Cleanup based on reference_ids of investments and redemptions
    -- Also include the CCB categories as requested
    DELETE FROM public.treasury_transactions 
    WHERE category IN ('Recebimento de Parcelas - CCB', 'Aquisição de Ativos - CCB')
       OR reference_id IN (SELECT id FROM public.investments)
       OR reference_id IN (SELECT id FROM public.investment_redemptions);

    -- 2. Audit Log Maintenance for investment entities
    DELETE FROM public.audit_logs 
    WHERE entity_type IN (
        'investments', 
        'investment_redemptions', 
        'investment_products', 
        'debenture_subscriptions', 
        'debenture_series', 
        'debentures'
    );

    -- 3. Delete in order to respect FK constraints
    DELETE FROM public.investment_redemptions;
    DELETE FROM public.investment_proofs;
    DELETE FROM public.debenture_subscriptions;
    DELETE FROM public.investments;
    DELETE FROM public.investment_products;
    DELETE FROM public.debenture_series;
    DELETE FROM public.debentures;

    -- 4. Profile Reset
    UPDATE public.profiles SET wallet_balance = 0;

END $$;
