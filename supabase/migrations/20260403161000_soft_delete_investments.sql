ALTER TABLE public.debenture_subscriptions ADD COLUMN IF NOT EXISTS status text DEFAULT 'Ativo';
ALTER TABLE public.debenture_subscriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.debenture_subscriptions ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'debenture_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debenture_subscriptions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'debenture_series'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debenture_series;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'investments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;
  END IF;
END $$;

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
