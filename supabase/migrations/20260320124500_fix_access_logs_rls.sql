-- Fix access_logs RLS to allow inserts during signup (anon role or pending session)
DROP POLICY IF EXISTS "access_logs_insert_own" ON public.access_logs;

CREATE POLICY "access_logs_insert_own" ON public.access_logs 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    auth.role() = 'anon'
  );
