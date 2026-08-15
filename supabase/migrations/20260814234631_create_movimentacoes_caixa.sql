-- Recria a tabela public.movimentacoes_caixa (removida pela migração de limpeza),
-- necessária para o fluxo de liquidação de recebíveis na página /operations.

CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT,
  categoria TEXT,
  descricao TEXT,
  valor NUMERIC(15, 6),
  saldo_anterior NUMERIC(15, 6),
  saldo_novo NUMERIC(15, 6),
  referencia_id UUID,
  referencia_tipo TEXT,
  referencia_numero TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- Admins podem fazer INSERT/SELECT/UPDATE/DELETE (via função is_admin())
DROP POLICY IF EXISTS "admin_all_movimentacoes_caixa" ON public.movimentacoes_caixa;
CREATE POLICY "admin_all_movimentacoes_caixa" ON public.movimentacoes_caixa
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Usuários autenticados podem SELECT apenas dos seus próprios registros
DROP POLICY IF EXISTS "own_select_movimentacoes_caixa" ON public.movimentacoes_caixa;
CREATE POLICY "own_select_movimentacoes_caixa" ON public.movimentacoes_caixa
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Índice para consultas por usuário
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_user_id
  ON public.movimentacoes_caixa (user_id);
