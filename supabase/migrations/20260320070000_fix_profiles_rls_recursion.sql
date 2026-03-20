-- Fix infinite recursion in RLS policies for profiles

-- Create a security definer function to check if the current user is an admin
-- This avoids querying the profiles table with RLS enabled, preventing recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::app_role
  );
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "admin_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;

-- Recreate them using the security definer function
CREATE POLICY "admin_select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ( public.is_admin() );

CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

