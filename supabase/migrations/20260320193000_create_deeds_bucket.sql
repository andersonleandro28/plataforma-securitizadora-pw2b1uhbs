DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('deeds', 'deeds', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload deeds" ON storage.objects;
  CREATE POLICY "Authenticated users can upload deeds" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'deeds');

  DROP POLICY IF EXISTS "Authenticated users can read deeds" ON storage.objects;
  CREATE POLICY "Authenticated users can read deeds" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'deeds');
END $$;
