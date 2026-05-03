DO $$
BEGIN
  -- Garantir que o usuário administrador principal tenha todas as flags de permissão necessárias ativadas
  UPDATE public.profiles
  SET 
    role = 'admin', 
    is_admin = true,
    is_staff = true,
    is_accountant = true
  WHERE email = 'andersonleandro28@gmail.com' 
     OR id IN (SELECT id FROM auth.users WHERE email = 'andersonleandro28@gmail.com');
END $$;

-- Atualizar Políticas RLS para as tabelas da Tesouraria/Contabilidade
-- Isso garante que administradores e contadores consigam ler todas as movimentações, independentemente do usuário criador.

DROP POLICY IF EXISTS "auth_movimentacoes_caixa_all" ON public.movimentacoes_caixa;
CREATE POLICY "auth_movimentacoes_caixa_all" ON public.movimentacoes_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "auth_saldo_caixa_all" ON public.saldo_caixa;
CREATE POLICY "auth_saldo_caixa_all" ON public.saldo_caixa
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "auth_mapeamento_all" ON public.mapeamento_movimentacoes;
CREATE POLICY "auth_mapeamento_all" ON public.mapeamento_movimentacoes
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (profiles.role::text IN ('admin', 'staff', 'accountant') OR profiles.is_admin = true)
    )
  );
