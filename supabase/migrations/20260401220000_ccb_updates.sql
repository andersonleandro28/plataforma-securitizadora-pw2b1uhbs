-- 1. Add fixed_emission_cost to config_ccb
ALTER TABLE public.config_ccb ADD COLUMN IF NOT EXISTS fixed_emission_cost numeric NOT NULL DEFAULT 0;

-- 2. Create ccb_avalistas_documentos table
CREATE TABLE IF NOT EXISTS public.ccb_avalistas_documentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ccb_id uuid REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
    nome_arquivo text NOT NULL,
    url text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- RLS for ccb_avalistas_documentos
ALTER TABLE public.ccb_avalistas_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_ccb_avalistas_docs" ON public.ccb_avalistas_documentos;
CREATE POLICY "auth_all_ccb_avalistas_docs" ON public.ccb_avalistas_documentos FOR ALL TO authenticated USING (true);

-- 3. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('ccb_conjuges_docs', 'ccb_conjuges_docs', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ccb_avalistas_docs', 'ccb_avalistas_docs', false) ON CONFLICT (id) DO NOTHING;

-- 4. Storage Policies for new buckets
-- Conjuges
DROP POLICY IF EXISTS "auth_upload_conjuges" ON storage.objects;
CREATE POLICY "auth_upload_conjuges" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ccb_conjuges_docs');
DROP POLICY IF EXISTS "auth_select_conjuges" ON storage.objects;
CREATE POLICY "auth_select_conjuges" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ccb_conjuges_docs');

-- Avalistas
DROP POLICY IF EXISTS "auth_upload_avalistas" ON storage.objects;
CREATE POLICY "auth_upload_avalistas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ccb_avalistas_docs');
DROP POLICY IF EXISTS "auth_select_avalistas" ON storage.objects;
CREATE POLICY "auth_select_avalistas" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ccb_avalistas_docs');
