-- Criar tabela de solicitações CCB
CREATE TABLE IF NOT EXISTS public.ccb_solicitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente',
    requested_value NUMERIC NOT NULL,
    term_months INTEGER NOT NULL,
    borrower_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    operation_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    guarantees_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    docs_paths JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_file_path TEXT,
    bdigital_response_file TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.ccb_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "borrower_select_own" ON public.ccb_solicitacoes;
CREATE POLICY "borrower_select_own" ON public.ccb_solicitacoes 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "borrower_insert_own" ON public.ccb_solicitacoes;
CREATE POLICY "borrower_insert_own" ON public.ccb_solicitacoes 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_ccb" ON public.ccb_solicitacoes;
CREATE POLICY "admin_all_ccb" ON public.ccb_solicitacoes 
  FOR ALL TO authenticated 
  USING (is_admin() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'staff'));

-- Storage Bucket for CCB docs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ccb-docs', 'ccb-docs', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "ccb_docs_select" ON storage.objects;
CREATE POLICY "ccb_docs_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (
    bucket_id = 'ccb-docs' AND 
    (auth.uid()::text = (string_to_array(name, '/'))[1] OR public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'))
  );

DROP POLICY IF EXISTS "ccb_docs_insert" ON storage.objects;
CREATE POLICY "ccb_docs_insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'ccb-docs' AND 
    (auth.uid()::text = (string_to_array(name, '/'))[1] OR public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'))
  );
  
DROP POLICY IF EXISTS "ccb_docs_update" ON storage.objects;
CREATE POLICY "ccb_docs_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (
    bucket_id = 'ccb-docs' AND 
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'))
  );
