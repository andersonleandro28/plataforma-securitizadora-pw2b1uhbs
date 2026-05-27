DO $$
BEGIN
  -- Seed product_statuses
  INSERT INTO public.product_statuses (id, label) VALUES
    (gen_random_uuid(), 'Em Captação'),
    (gen_random_uuid(), 'Esgotado'),
    (gen_random_uuid(), 'Em Estruturação'),
    (gen_random_uuid(), 'Liquidado')
  ON CONFLICT (label) DO NOTHING;

  -- Seed product_risk_ratings
  INSERT INTO public.product_risk_ratings (id, label) VALUES
    (gen_random_uuid(), 'Baixo'),
    (gen_random_uuid(), 'Médio'),
    (gen_random_uuid(), 'Alto'),
    (gen_random_uuid(), 'Crítico')
  ON CONFLICT (label) DO NOTHING;

  -- Seed product_currencies
  INSERT INTO public.product_currencies (id, code, label, symbol) VALUES
    (gen_random_uuid(), 'BRL', 'Real Brasileiro', 'R$'),
    (gen_random_uuid(), 'USD', 'Dólar Americano', 'US$')
  ON CONFLICT (code) DO NOTHING;

  -- Seed debenture_series mock to ensure functionality
  IF NOT EXISTS (SELECT 1 FROM public.debentures WHERE issuer_name = 'Sea Connection Investimentos S.A.') THEN
    DECLARE
      v_deb_id uuid := gen_random_uuid();
    BEGIN
      INSERT INTO public.debentures (id, issuer_name, total_volume, issue_date)
      VALUES (v_deb_id, 'Sea Connection Investimentos S.A.', 10000000, CURRENT_DATE);

      INSERT INTO public.debenture_series (id, debenture_id, series_number, volume, indexer, rate, maturity_date)
      VALUES 
        (gen_random_uuid(), v_deb_id, 'Série Unica - 2026', 10000000, 'CDI', 3.5, CURRENT_DATE + interval '2 years');
    END;
  END IF;
END $$;
