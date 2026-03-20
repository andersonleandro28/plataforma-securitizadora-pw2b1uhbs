-- Adiciona a coluna pj_rep_is_procurator na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pj_rep_is_procurator boolean DEFAULT false;
