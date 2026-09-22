-- Permitir que administradores e staff criem solicitações de CCB em nome de qualquer tomador
DROP POLICY IF EXISTS "admin_insert_ccb" ON public.ccb_solicitacoes;
CREATE POLICY "admin_insert_ccb" ON public.ccb_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff')
  );
