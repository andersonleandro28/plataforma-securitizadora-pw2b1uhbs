DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'requires_password_change') THEN
    ALTER TABLE public.profiles RENAME COLUMN requires_password_change TO force_password_change;
  ELSE
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
  END IF;
END $$;
