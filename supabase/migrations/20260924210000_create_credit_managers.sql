-- Migration: 20260924210000_create_credit_managers.sql
-- Tabela para Gerentes de Crédito e configuração individual de comissionamento sobre deságio

CREATE TABLE IF NOT EXISTS public.credit_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  commission_anticipation_pct NUMERIC NOT NULL DEFAULT 0,
  commission_ccb_pct NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para credit_managers
CREATE INDEX IF NOT EXISTS idx_credit_managers_active ON public.credit_managers(is_active);
CREATE INDEX IF NOT EXISTS idx_credit_managers_cpf ON public.credit_managers(cpf);

-- Vincular gerente nas operações de antecipação (credit_operations)
ALTER TABLE public.credit_operations
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.credit_managers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_operations_manager_id ON public.credit_operations(manager_id);

-- Vincular gerente nas compras de CCB (recebiveis_ccb)
ALTER TABLE public.recebiveis_ccb
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.credit_managers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recebiveis_ccb_manager_id ON public.recebiveis_ccb(manager_id);

-- Habilitar RLS na tabela credit_managers
ALTER TABLE public.credit_managers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para credit_managers (usuários autenticados no padrão do sistema)
DROP POLICY IF EXISTS "auth_all_credit_managers" ON public.credit_managers;
CREATE POLICY "auth_all_credit_managers" ON public.credit_managers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
