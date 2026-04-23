DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'recebiveis_ccb'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recebiveis_ccb;
  END IF;
END $$;
