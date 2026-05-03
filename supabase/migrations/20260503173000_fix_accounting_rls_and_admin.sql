-- Fix Accounting RLS policies, update admin function and super admin profile

DO $$
BEGIN
  -- Ensure super admin has proper flags in profiles table using their email
  UPDATE public.profiles
  SET is_admin = true, role = 'admin'
  WHERE email = 'andersonleandro28@gmail.com';
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role::text = 'admin' OR is_admin = true)
  );
$function$;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "movimentacoes_caixa_access_policy" ON public.movimentacoes_caixa;
DROP POLICY IF EXISTS "saldo_caixa_access_policy" ON public.saldo_caixa;
DROP POLICY IF EXISTS "mapeamento_movimentacoes_access_policy" ON public.mapeamento_movimentacoes;

-- Create new robust global policies for movimentacoes_caixa
CREATE POLICY "movimentacoes_caixa_access_policy" ON public.movimentacoes_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  );

-- Create new robust global policies for saldo_caixa
CREATE POLICY "saldo_caixa_access_policy" ON public.saldo_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  );

-- Create new robust global policies for mapeamento_movimentacoes
CREATE POLICY "mapeamento_movimentacoes_access_policy" ON public.mapeamento_movimentacoes
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role::text IN ('staff', 'accountant')
    )
  );
