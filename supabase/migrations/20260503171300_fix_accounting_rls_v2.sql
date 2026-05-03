-- Make sure superadmin has proper flags to pass RLS
DO $$
BEGIN
  UPDATE public.profiles
  SET is_admin = true, role = 'admin'
  WHERE email = 'andersonleandro28@gmail.com';
END $$;

-- Drop existing policies on Accounting tables to ensure no restrictive policy limits access
DROP POLICY IF EXISTS "auth_movimentacoes_caixa_all" ON public.movimentacoes_caixa;
DROP POLICY IF EXISTS "movimentacoes_caixa_insert_own" ON public.movimentacoes_caixa;
DROP POLICY IF EXISTS "movimentacoes_caixa_select_own" ON public.movimentacoes_caixa;

DROP POLICY IF EXISTS "auth_saldo_caixa_all" ON public.saldo_caixa;
DROP POLICY IF EXISTS "saldo_caixa_insert_own" ON public.saldo_caixa;
DROP POLICY IF EXISTS "saldo_caixa_select_own" ON public.saldo_caixa;

DROP POLICY IF EXISTS "auth_mapeamento_all" ON public.mapeamento_movimentacoes;
DROP POLICY IF EXISTS "mapeamento_movimentacoes_insert_own" ON public.mapeamento_movimentacoes;
DROP POLICY IF EXISTS "mapeamento_movimentacoes_select_own" ON public.mapeamento_movimentacoes;

-- Create explicit global access policies for movimentacoes_caixa
CREATE POLICY "movimentacoes_caixa_access_policy" 
ON public.movimentacoes_caixa 
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
)
WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
);

-- Create explicit global access policies for saldo_caixa
CREATE POLICY "saldo_caixa_access_policy" 
ON public.saldo_caixa 
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
)
WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
);

-- Create explicit global access policies for mapeamento_movimentacoes
CREATE POLICY "mapeamento_movimentacoes_access_policy" 
ON public.mapeamento_movimentacoes 
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
)
WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true)
  )
);
