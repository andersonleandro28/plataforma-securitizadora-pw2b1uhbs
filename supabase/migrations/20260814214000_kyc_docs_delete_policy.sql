-- Permite que um usuário autenticado exclua seus próprios documentos KYC.
-- (Até então existiam apenas policies de SELECT e INSERT para o próprio usuário,
-- além da policy total de admin — sem DELETE o investidor não consegue remover docs.)

DROP POLICY IF EXISTS "kyc_docs_delete_own" ON public.kyc_documents;
CREATE POLICY "kyc_docs_delete_own" ON public.kyc_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Permite que o próprio usuário atualize registros de seus docs (ex.: renomear tipo).
DROP POLICY IF EXISTS "kyc_docs_update_own" ON public.kyc_documents;
CREATE POLICY "kyc_docs_update_own" ON public.kyc_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Permite que o usuário remova seus próprios arquivos do bucket kyc-documents.
DROP POLICY IF EXISTS "Allow user to delete their own kyc docs" ON storage.objects;
CREATE POLICY "Allow user to delete their own kyc docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-documents' AND name LIKE auth.uid()::text || '/%');
