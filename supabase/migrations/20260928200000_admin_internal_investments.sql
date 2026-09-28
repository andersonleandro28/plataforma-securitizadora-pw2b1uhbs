-- Migration: Adicionar suporte para investimentos internos lançados pelo admin
-- Migration: 20260928200000_admin_internal_investments.sql

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS is_internal_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES public.profiles(id);

-- Atualiza a view investments_view para incluir os novos campos e manter integridade para o investidor
CREATE OR REPLACE VIEW public.investments_view AS
SELECT * FROM public.investments WHERE user_id = auth.uid();

GRANT SELECT ON public.investments_view TO authenticated;
