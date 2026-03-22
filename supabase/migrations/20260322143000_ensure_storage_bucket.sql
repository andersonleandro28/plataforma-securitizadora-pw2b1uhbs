-- Assegura que o bucket operation-docs existe para armazenar os aditivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('operation-docs', 'operation-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Garante que usuários autenticados possam ler e inserir no bucket
DROP POLICY IF EXISTS "Allow authenticated uploads on operation-docs" ON storage.objects;
CREATE POLICY "Allow authenticated uploads on operation-docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operation-docs');

DROP POLICY IF EXISTS "Allow authenticated selects on operation-docs" ON storage.objects;
CREATE POLICY "Allow authenticated selects on operation-docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'operation-docs');

DROP POLICY IF EXISTS "Allow authenticated updates on operation-docs" ON storage.objects;
CREATE POLICY "Allow authenticated updates on operation-docs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'operation-docs');
