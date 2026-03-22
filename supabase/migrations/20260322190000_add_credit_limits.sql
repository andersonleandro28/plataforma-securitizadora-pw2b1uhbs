-- Adiciona limite de crédito aos perfis (aplicável principalmente aos tomadores/cedentes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 100000;

-- Atualiza limites de usuários existentes para o valor padrão caso estejam nulos
UPDATE public.profiles SET credit_limit = 100000 WHERE credit_limit IS NULL;
