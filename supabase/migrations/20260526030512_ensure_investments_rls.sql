-- Ensure RLS is enabled on investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Policy for investments
DROP POLICY IF EXISTS "investments_select_policy" ON public.investments;
CREATE POLICY "investments_select_policy" ON public.investments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'accountant'))
  );

-- Ensure RLS is enabled on investment_products
ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;

-- Policy for investment_products
DROP POLICY IF EXISTS "auth_all_investment_products" ON public.investment_products;
CREATE POLICY "auth_all_investment_products" ON public.investment_products
  FOR SELECT TO authenticated USING (true);
