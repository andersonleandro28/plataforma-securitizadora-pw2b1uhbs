-- Fix foreign key to reference profiles instead of auth.users for PostgREST joins

DO $$
BEGIN
  ALTER TABLE public.investment_redemptions DROP CONSTRAINT IF EXISTS investment_redemptions_user_id_fkey;
EXCEPTION WHEN undefined_object THEN
  -- Do nothing
END $$;

ALTER TABLE public.investment_redemptions
  ADD CONSTRAINT investment_redemptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
