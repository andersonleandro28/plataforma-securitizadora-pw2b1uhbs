-- Migration: Cria tabela de lançamentos manuais do Fluxo de Caixa Projetado
-- Permite ao admin prever recebíveis futuros adicionais (entradas) e pagamentos futuros adicionais (saídas).
-- Isolada de Livro Caixa, DRE e DFC. Acesso restrito a administradores e equipe financeira.

CREATE TABLE IF NOT EXISTS public.projected_cashflow_manual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('in', 'out')), -- 'in' = recebível futuro manual, 'out' = pagamento futuro manual
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  projected_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimização de consultas por data e tipo
CREATE INDEX IF NOT EXISTS idx_proj_cashflow_date ON public.projected_cashflow_manual_entries (projected_date);
CREATE INDEX IF NOT EXISTS idx_proj_cashflow_type ON public.projected_cashflow_manual_entries (type);

-- Habilitar RLS
ALTER TABLE public.projected_cashflow_manual_entries ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Apenas administradores e staff podem visualizar e gerenciar
DROP POLICY IF EXISTS "admin_select_proj_cashflow" ON public.projected_cashflow_manual_entries;
CREATE POLICY "admin_select_proj_cashflow" ON public.projected_cashflow_manual_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role IN ('admin'::app_role, 'staff'::app_role, 'accountant'::app_role))
    )
  );

DROP POLICY IF EXISTS "admin_insert_proj_cashflow" ON public.projected_cashflow_manual_entries;
CREATE POLICY "admin_insert_proj_cashflow" ON public.projected_cashflow_manual_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role IN ('admin'::app_role, 'staff'::app_role, 'accountant'::app_role))
    )
  );

DROP POLICY IF EXISTS "admin_update_proj_cashflow" ON public.projected_cashflow_manual_entries;
CREATE POLICY "admin_update_proj_cashflow" ON public.projected_cashflow_manual_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role IN ('admin'::app_role, 'staff'::app_role, 'accountant'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role IN ('admin'::app_role, 'staff'::app_role, 'accountant'::app_role))
    )
  );

DROP POLICY IF EXISTS "admin_delete_proj_cashflow" ON public.projected_cashflow_manual_entries;
CREATE POLICY "admin_delete_proj_cashflow" ON public.projected_cashflow_manual_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role IN ('admin'::app_role, 'staff'::app_role, 'accountant'::app_role))
    )
  );
