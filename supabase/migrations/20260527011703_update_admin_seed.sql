DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Insert or update user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'andersonleandro28@gmail.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_user_id,
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
      v_user_id,
      v_user_id::text,
      format('{"sub": "%s", "email": "%s"}', v_user_id, 'andersonleandro28@gmail.com')::jsonb,
      'email',
      NOW(), NOW(), NOW()
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'andersonleandro28@gmail.com';
    UPDATE auth.users 
    SET encrypted_password = crypt('Skip@Pass', gen_salt('bf'))
    WHERE id = v_user_id;
  END IF;

  -- Ensure it's in public.profiles with role = admin
  INSERT INTO public.profiles (id, email, full_name, role, is_admin)
  VALUES (v_user_id, 'andersonleandro28@gmail.com', 'Anderson Leandro', 'admin', true)
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', is_admin = true;

END $$;
