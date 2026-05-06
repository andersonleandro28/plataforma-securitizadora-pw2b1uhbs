-- View de fallback solicitada para leitura direta caso a RLS falhe
CREATE OR REPLACE VIEW public.investments_view AS
SELECT * FROM public.investments WHERE user_id = auth.uid();

-- Garante que todos usuários autenticados consigam acessar
GRANT SELECT ON public.investments_view TO authenticated;
