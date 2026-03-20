-- Create the serasa consultations table safely
CREATE TABLE IF NOT EXISTS public.serasa_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_number TEXT NOT NULL,
    score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    raw_response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure RLS is enabled
ALTER TABLE public.serasa_consultations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to remain idempotent
DROP POLICY IF EXISTS "authenticated_select" ON public.serasa_consultations;
DROP POLICY IF EXISTS "authenticated_insert" ON public.serasa_consultations;

-- Recreate policies limiting access to the owner
CREATE POLICY "authenticated_select" ON public.serasa_consultations
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "authenticated_insert" ON public.serasa_consultations
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Seed a test user to ensure the Auth component can be bypassed easily during tests
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'test@example.com') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id, '00000000-0000-0000-0000-000000000000', 'test@example.com',
      crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}', '{"name": "Test User"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );
  END IF;
END $$;
