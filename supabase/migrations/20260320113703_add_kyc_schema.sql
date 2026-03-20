DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('pf', 'pj')),
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS is_pep BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lgpd_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lgpd_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_status kyc_status DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_docs_select_own" ON public.kyc_documents;
CREATE POLICY "kyc_docs_select_own" ON public.kyc_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc_docs_insert_own" ON public.kyc_documents;
CREATE POLICY "kyc_docs_insert_own" ON public.kyc_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_kyc_docs" ON public.kyc_documents;
CREATE POLICY "admin_all_kyc_docs" ON public.kyc_documents FOR ALL TO authenticated USING (public.is_admin());

INSERT INTO storage.buckets (id, name, public) 
VALUES ('kyc-documents', 'kyc-documents', false) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow user to insert their own kyc docs" ON storage.objects;
CREATE POLICY "Allow user to insert their own kyc docs" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'kyc-documents' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "Allow user to read their own kyc docs" ON storage.objects;
CREATE POLICY "Allow user to read their own kyc docs" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'kyc-documents' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "Allow admins to read all kyc docs" ON storage.objects;
CREATE POLICY "Allow admins to read all kyc docs" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'kyc-documents' AND public.is_admin());
