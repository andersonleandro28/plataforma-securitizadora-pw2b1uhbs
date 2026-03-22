-- Fix foreign key for contract_versions to point to profiles instead of auth.users
-- This resolves PostgREST schema cache and join issues when querying contract_versions with profiles

ALTER TABLE public.contract_versions
  DROP CONSTRAINT IF EXISTS contract_versions_created_by_fkey;

ALTER TABLE public.contract_versions
  ADD CONSTRAINT contract_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;
