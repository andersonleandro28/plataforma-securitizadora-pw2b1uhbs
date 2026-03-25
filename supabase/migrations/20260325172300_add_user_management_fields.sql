-- Adiciona flag de bloqueio à tabela de perfis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Garante que logs de auditoria tenham flexibilidade para novos tipos de ações administrativas
