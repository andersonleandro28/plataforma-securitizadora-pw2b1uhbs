-- Migration: Add user roles for RBAC

-- 1. Create ENUM type for roles
DO $BODY$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'investor', 'borrower', 'staff');
    END IF;
END $BODY$;

-- 2. Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role app_role NOT NULL DEFAULT 'investor'::app_role;

-- 3. Set the current user to 'admin' (if they exist)
DO $BODY$
DECLARE
  target_user_id uuid;
BEGIN
  -- Change this email to the customer's email or primary admin
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'andersonleandro28@gmail.com' LIMIT 1;
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles SET role = 'admin'::app_role WHERE id = target_user_id;
  END IF;
END $BODY$;
