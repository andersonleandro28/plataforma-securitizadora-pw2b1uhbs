DO $$
BEGIN
  -- Force admin role for the specific user UUID requested by the customer
  UPDATE public.profiles 
  SET role = 'admin', is_admin = true, is_staff = true, is_accountant = true
  WHERE id = '07d94d7e-a7af-46e4-9ebf-1d53f43f6742'::uuid;
  
  -- Force admin role for the default super admin email to guarantee fallback
  UPDATE public.profiles 
  SET role = 'admin', is_admin = true, is_staff = true, is_accountant = true
  WHERE email = 'andersonleandro28@gmail.com';
END $$;

-- Override the is_admin function to strictly allow the user UUID and bypass row-level lookup constraints
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    auth.uid() = '07d94d7e-a7af-46e4-9ebf-1d53f43f6742'::uuid 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role::text = 'admin' OR is_admin = true OR email = 'andersonleandro28@gmail.com')
    );
$function$;

-- Update the RLS policies for movimentacoes_caixa to guarantee admin access to ALL rows
DROP POLICY IF EXISTS "movimentacoes_caixa_access_policy" ON public.movimentacoes_caixa;
CREATE POLICY "movimentacoes_caixa_access_policy" ON public.movimentacoes_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  );

-- Update the RLS policies for saldo_caixa to guarantee admin access to ALL rows
DROP POLICY IF EXISTS "saldo_caixa_access_policy" ON public.saldo_caixa;
CREATE POLICY "saldo_caixa_access_policy" ON public.saldo_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  );

-- Update the RLS policies for mapeamento_movimentacoes to guarantee admin access to ALL rows
DROP POLICY IF EXISTS "mapeamento_movimentacoes_access_policy" ON public.mapeamento_movimentacoes;
CREATE POLICY "mapeamento_movimentacoes_access_policy" ON public.mapeamento_movimentacoes
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('staff', 'accountant'))
  );
