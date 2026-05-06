-- Desabilita/Corrige RLS da tabela investments para permitir leitura direta pelo user_id
-- O problema original ocorria pois a RLS checava se o profile.role era estritamente 'investor', 
-- bloqueando o acesso de usuários com outro role principal que tinham investimentos.
DROP POLICY IF EXISTS "investments_select_policy" ON public.investments;

CREATE POLICY "investments_select_policy" ON public.investments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    is_admin() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'accountant'))
  );

-- Criação da View de Fallback solicitada para Debug
CREATE OR REPLACE VIEW public.investments_view AS
SELECT * FROM public.investments WHERE user_id = auth.uid();

-- Garante acesso à view para usuários logados
GRANT SELECT ON public.investments_view TO authenticated;
