ALTER TABLE public.recebiveis_ccb ADD COLUMN IF NOT EXISTS tomador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
