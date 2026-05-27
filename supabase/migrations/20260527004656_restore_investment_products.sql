DO $DO$
DECLARE
  new_user_id uuid;
  prod1_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
  prod2_id uuid := 'a2222222-2222-2222-2222-222222222222'::uuid;
  prod3_id uuid := 'a3333333-3333-3333-3333-333333333333'::uuid;
  prod4_id uuid := 'a4444444-4444-4444-4444-444444444444'::uuid;
BEGIN
  -- 1. Ensure admin user exists with the required credentials
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'andersonleandro28@gmail.com') THEN
    new_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'andersonleandro28@gmail.com',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Anderson Leandro"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      new_user_id::text,
      format('{"sub": "%s", "email": "%s"}', new_user_id, 'andersonleandro28@gmail.com')::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'andersonleandro28@gmail.com';
    UPDATE auth.users SET encrypted_password = crypt('Skip@Pass', gen_salt('bf')) WHERE id = new_user_id;
  END IF;

  -- Ensure profile is admin
  INSERT INTO public.profiles (id, email, full_name, role, is_admin)
  VALUES (new_user_id, 'andersonleandro28@gmail.com', 'Anderson Leandro', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_admin = true;

  -- 2. Restore Investment Products Catalog
  INSERT INTO public.investment_products (
    id, title, type, rate, term, min_investment, risk, status,
    is_active, is_archived, quota_value, global_quotas, min_quotas_per_investor, max_quotas_per_investor,
    is_highlighted, description, rating, manager, currency
  ) VALUES 
  (
    prod1_id,
    'Debênture Imobiliária Série A',
    'Debênture',
    '12% a.a.',
    '24 meses',
    1000,
    'Baixo',
    'Captação Aberta',
    true,
    false,
    1000,
    5000,
    1,
    100,
    true,
    'Debênture com lastro em recebíveis imobiliários de alto padrão. Excelente opção para diversificação com segurança institucional.',
    'Risco Baixo',
    'Sea Connection S.A.',
    'BRL'
  ),
  (
    prod2_id,
    'CDB Pós-Fixado Alpha',
    'CDB',
    '115% CDI',
    '12 meses',
    5000,
    'Médio',
    'Captação Aberta',
    true,
    false,
    1000,
    2000,
    5,
    50,
    false,
    'Certificado de Depósito Bancário atrelado ao CDI. Rendimento superior para quem busca rentabilidade e liquidez no médio prazo.',
    'Risco Médio',
    'Banco Alpha',
    'BRL'
  ),
  (
    prod3_id,
    'CRI Logística Avançada',
    'CRI',
    'IPCA + 7.5% a.a.',
    '36 meses',
    10000,
    'Baixo',
    'Captação Aberta',
    true,
    false,
    1000,
    1000,
    10,
    200,
    true,
    'Certificado de Recebíveis Imobiliários lastreado em galpões logísticos classe A. Forte proteção contra a inflação no longo prazo.',
    'Risco Baixo',
    'Securitizadora Prime',
    'BRL'
  ),
  (
    prod4_id,
    'FIDC Agronegócio Premium',
    'FIDC',
    'CDI + 3% a.a.',
    '18 meses',
    2500,
    'Médio',
    'Captação Aberta',
    true,
    false,
    500,
    10000,
    5,
    500,
    false,
    'Fundo de Investimento em Direitos Creditórios do setor agro. Rentabilidade atrativa com pulverização de risco.',
    'Risco Médio',
    'Agro Investimentos',
    'BRL'
  )
  ON CONFLICT (id) DO NOTHING;

END $DO$;
