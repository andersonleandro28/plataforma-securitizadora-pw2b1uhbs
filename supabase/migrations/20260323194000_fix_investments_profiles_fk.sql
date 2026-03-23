-- Fix foreign key relationship between investments and profiles for PostgREST
-- This allows querying `investments` and joining with `profiles`
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

ALTER TABLE public.investments 
  ADD CONSTRAINT investments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
