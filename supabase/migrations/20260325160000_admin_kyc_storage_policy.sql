-- Adiciona permissões para admins gerenciarem documentos KYC no storage em nome dos usuários
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow admins to insert kyc docs" ON storage.objects;
  CREATE POLICY "Allow admins to insert kyc docs" 
  ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'kyc-documents' AND public.is_admin());

  DROP POLICY IF EXISTS "Allow admins to update kyc docs" ON storage.objects;
  CREATE POLICY "Allow admins to update kyc docs" 
  ON storage.objects FOR UPDATE TO authenticated 
  USING (bucket_id = 'kyc-documents' AND public.is_admin());

  DROP POLICY IF EXISTS "Allow admins to delete kyc docs" ON storage.objects;
  CREATE POLICY "Allow admins to delete kyc docs" 
  ON storage.objects FOR DELETE TO authenticated 
  USING (bucket_id = 'kyc-documents' AND public.is_admin());
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
