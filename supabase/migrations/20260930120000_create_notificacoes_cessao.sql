-- Migration: Notificações de Cessão de Crédito ao Sacado
-- Cria a tabela notificacoes_cessao para rastrear notificações de cessão geradas,
-- tokens de ciência pública, status de envio de e-mail e registro de aceite do sacado.

CREATE TABLE IF NOT EXISTS public.notificacoes_cessao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.credit_operations(id) ON DELETE CASCADE,
  sacado_nome TEXT NOT NULL,
  sacado_documento TEXT,
  sacado_email TEXT,
  sacado_telefone TEXT,
  pdf_file_path TEXT,
  pdf_url TEXT,
  token TEXT NOT NULL UNIQUE,
  status_envio TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'enviado', 'falha_envio', 'sem_email'
  email_enviado_em TIMESTAMPTZ,
  email_erro TEXT,
  status_aceite TEXT NOT NULL DEFAULT 'aguardando', -- 'aguardando', 'aceito', 'expirado'
  aceito_em TIMESTAMPTZ,
  aceito_ip TEXT,
  aceito_user_agent TEXT,
  aceito_hash TEXT,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_notificacoes_cessao_operation_id ON public.notificacoes_cessao(operation_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_cessao_token ON public.notificacoes_cessao(token);
CREATE INDEX IF NOT EXISTS idx_notificacoes_cessao_status_aceite ON public.notificacoes_cessao(status_aceite);

-- Habilita RLS
ALTER TABLE public.notificacoes_cessao ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Usuários autenticados (Admin e Tomador dono da operação) podem ler
DROP POLICY IF EXISTS "auth_select_notificacoes_cessao" ON public.notificacoes_cessao;
CREATE POLICY "auth_select_notificacoes_cessao" ON public.notificacoes_cessao
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'staff', 'accountant') OR p.is_admin = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.credit_operations co
      WHERE co.id = notificacoes_cessao.operation_id AND co.borrower_id = auth.uid()
    )
  );

-- 2. Administradores/Staff podem inserir/atualizar/excluir
DROP POLICY IF EXISTS "auth_admin_write_notificacoes_cessao" ON public.notificacoes_cessao;
CREATE POLICY "auth_admin_write_notificacoes_cessao" ON public.notificacoes_cessao
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'staff') OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'staff') OR p.is_admin = true)
    )
  );

-- 3. Acesso público (anon) para leitura do token na página de ciência
DROP POLICY IF EXISTS "anon_select_by_token" ON public.notificacoes_cessao;
CREATE POLICY "anon_select_by_token" ON public.notificacoes_cessao
  FOR SELECT TO anon
  USING (true);

-- Assegurar colunas na tabela credit_operations caso ainda não existam
ALTER TABLE public.credit_operations
  ADD COLUMN IF NOT EXISTS sacado_document TEXT,
  ADD COLUMN IF NOT EXISTS sacado_email TEXT,
  ADD COLUMN IF NOT EXISTS sacado_phone TEXT;
