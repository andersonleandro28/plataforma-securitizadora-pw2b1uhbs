ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- Create bucket for investment docs if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('investment-docs', 'investment-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for investment-docs
DROP POLICY IF EXISTS "public_read_investment_docs" ON storage.objects;
CREATE POLICY "public_read_investment_docs" ON storage.objects FOR SELECT USING (bucket_id = 'investment-docs');

DROP POLICY IF EXISTS "auth_insert_investment_docs" ON storage.objects;
CREATE POLICY "auth_insert_investment_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'investment-docs');
