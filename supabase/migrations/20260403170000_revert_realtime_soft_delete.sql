-- Revert realtime and soft delete columns
DO $DO$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'debenture_series'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE debenture_series;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'debenture_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE debenture_subscriptions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'investments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE investments;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE audit_logs;
  END IF;
END $DO$;

ALTER TABLE public.debenture_subscriptions DROP COLUMN IF EXISTS status;
ALTER TABLE public.debenture_subscriptions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.debenture_subscriptions DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE public.investments DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.investments DROP COLUMN IF EXISTS deleted_by;

NOTIFY pgrst, 'reload schema';
