-- Fix foreign key relationship to allow querying profiles from ccb_solicitacoes
ALTER TABLE public.ccb_solicitacoes DROP CONSTRAINT IF EXISTS ccb_solicitacoes_user_id_fkey;
ALTER TABLE public.ccb_solicitacoes ADD CONSTRAINT ccb_solicitacoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
