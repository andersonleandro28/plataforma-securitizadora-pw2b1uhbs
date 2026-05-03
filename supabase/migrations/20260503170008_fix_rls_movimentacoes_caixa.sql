DO $$
BEGIN
  -- 1. Table: movimentacoes_caixa
  DROP POLICY IF EXISTS "admin_movimentacoes_caixa_insert" ON public.movimentacoes_caixa;
  DROP POLICY IF EXISTS "admin_movimentacoes_caixa_select" ON public.movimentacoes_caixa;
  DROP POLICY IF EXISTS "admin_movimentacoes_caixa_update" ON public.movimentacoes_caixa;
  DROP POLICY IF EXISTS "auth_movimentacoes_caixa_all" ON public.movimentacoes_caixa;

  CREATE POLICY "auth_movimentacoes_caixa_all" ON public.movimentacoes_caixa
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  );

  -- 2. Table: saldo_caixa
  DROP POLICY IF EXISTS "admin_saldo_caixa_insert" ON public.saldo_caixa;
  DROP POLICY IF EXISTS "admin_saldo_caixa_select" ON public.saldo_caixa;
  DROP POLICY IF EXISTS "admin_saldo_caixa_update" ON public.saldo_caixa;
  DROP POLICY IF EXISTS "auth_saldo_caixa_all" ON public.saldo_caixa;

  CREATE POLICY "auth_saldo_caixa_all" ON public.saldo_caixa
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  );

  -- 3. Table: mapeamento_movimentacoes
  DROP POLICY IF EXISTS "admin_mapeamento_insert" ON public.mapeamento_movimentacoes;
  DROP POLICY IF EXISTS "admin_mapeamento_select" ON public.mapeamento_movimentacoes;
  DROP POLICY IF EXISTS "admin_mapeamento_update" ON public.mapeamento_movimentacoes;
  DROP POLICY IF EXISTS "auth_mapeamento_all" ON public.mapeamento_movimentacoes;

  CREATE POLICY "auth_mapeamento_all" ON public.mapeamento_movimentacoes
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'staff', 'accountant') OR is_admin = true))
  );

END $$;
