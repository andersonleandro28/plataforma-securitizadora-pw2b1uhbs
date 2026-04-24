DO $$
BEGIN
  -- Create buckets if they don't exist or update their visibility to public
  INSERT INTO storage.buckets (id, name, public) 
  VALUES 
    ('boletos_ccb', 'boletos_ccb', true),
    ('documentos_operacoes', 'documentos_operacoes', true),
    ('notas_fiscais', 'notas_fiscais', true),
    ('operation-docs', 'operation-docs', true),
    ('kyc-docs', 'kyc-docs', true),
    ('ccb-docs', 'ccb-docs', true),
    ('deeds', 'deeds', false)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Public Access" ON storage.objects;
  DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
  DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
  DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

  -- Create generic policies for all these buckets
  CREATE POLICY "Allow public read access" ON storage.objects
    FOR SELECT USING (bucket_id IN ('boletos_ccb', 'documentos_operacoes', 'notas_fiscais', 'operation-docs', 'kyc-docs', 'ccb-docs'));

  CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (true);

  CREATE POLICY "Allow authenticated updates" ON storage.objects
    FOR UPDATE TO authenticated USING (true);

  CREATE POLICY "Allow authenticated deletes" ON storage.objects
    FOR DELETE TO authenticated USING (true);

END $$;
