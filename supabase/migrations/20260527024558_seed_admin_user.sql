DO $$
DECLARE
  new_user_id uuid;
BEGIN
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
      crypt('Skip@Pass123!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Admin Anderson"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );

    INSERT INTO public.profiles (id, email, full_name, role, is_admin)
    VALUES (new_user_id, 'andersonleandro28@gmail.com', 'Admin Anderson', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true, role = 'admin';
  ELSE
    -- UPDATE existing profile to ensure it has admin rights
    UPDATE public.profiles 
    SET is_admin = true, role = 'admin' 
    WHERE email = 'andersonleandro28@gmail.com';
  END IF;
END $$;
