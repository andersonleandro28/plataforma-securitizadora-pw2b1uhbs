DO $$
BEGIN
  -- Drop the policy if it exists to ensure idempotency
  DROP POLICY IF EXISTS "investment_products_admin_write" ON public.investment_products;
  
  -- Create new policy to allow administrators and staff to perform all actions
  CREATE POLICY "investment_products_admin_write" ON public.investment_products
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('admin'::app_role, 'staff'::app_role) OR profiles.is_admin = true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('admin'::app_role, 'staff'::app_role) OR profiles.is_admin = true)
      )
    );
END $$;
