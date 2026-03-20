-- Enable RLS for profiles if not already
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Create Policies to allow Admins to read and update any profile
DO $BODY$
BEGIN
    DROP POLICY IF EXISTS "admin_select_profiles" ON public.profiles;
    CREATE POLICY "admin_select_profiles" ON public.profiles
      FOR SELECT TO authenticated
      USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::app_role );

    DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
    CREATE POLICY "admin_update_profiles" ON public.profiles
      FOR UPDATE TO authenticated
      USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::app_role )
      WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::app_role );
END $BODY$;

-- 2. Add helper columns for backoffice management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 3. Backfill existing profiles with data from auth.users
UPDATE public.profiles p
SET 
  email = u.email,
  created_at = u.created_at
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.created_at IS NULL);

-- 4. Update the trigger to automatically capture email and creation date on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, created_at)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
