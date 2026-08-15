-- Cria a tabela mapeamento_movimentacoes que mapeia movimentações de caixa
-- às suas origens (ex.: integrações contábeis / sincronização).

CREATE TABLE IF NOT EXISTS public.mapeamento_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_caixa_id UUID NOT NULL REFERENCES public.movimentacoes_caixa(id) ON DELETE CASCADE,
  origem_tabela TEXT,
  origem_id UUID,
  sincronizado BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mapeamento_movimentacoes_movimentacao_caixa_id
  ON public.mapeamento_movimentacoes (movimentacao_caixa_id);

CREATE INDEX IF NOT EXISTS idx_mapeamento_movimentacoes_user_id
  ON public.mapeamento_movimentacoes (user_id);

-- Habilita RLS
ALTER TABLE public.mapeamento_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "admin_all_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes;
CREATE POLICY "admin_all_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Usuários autenticados veem apenas seus próprios registros (SELECT)
DROP POLICY IF EXISTS "own_select_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes;
CREATE POLICY "own_select_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Usuários autenticados inserem apenas seus próprios registros
DROP POLICY IF EXISTS "own_insert_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes;
CREATE POLICY "own_insert_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuários autenticados atualizam apenas seus próprios registros
DROP POLICY IF EXISTS "own_update_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes;
CREATE POLICY "own_update_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Usuários autenticados excluem apenas seus próprios registros
DROP POLICY IF EXISTS "own_delete_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes;
CREATE POLICY "own_delete_mapeamento_movimentacoes" ON public.mapeamento_movimentacoes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
