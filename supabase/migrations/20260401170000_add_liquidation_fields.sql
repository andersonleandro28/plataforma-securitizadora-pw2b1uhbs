-- Add fields to credit_operations for liquidation tracking
ALTER TABLE public.credit_operations ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE public.credit_operations ADD COLUMN IF NOT EXISTS liquidation_date DATE;
ALTER TABLE public.credit_operations ADD COLUMN IF NOT EXISTS liquidation_value NUMERIC;

-- Create bucket for comprovantes safely
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprovantes_liquidacao', 'comprovantes_liquidacao', false) 
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any to recreate them safely
DROP POLICY IF EXISTS "Auth users can read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can insert comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update comprovantes" ON storage.objects;

-- Create policies for the new bucket
CREATE POLICY "Auth users can read comprovantes" ON storage.objects 
  FOR SELECT TO authenticated USING (bucket_id = 'comprovantes_liquidacao');

CREATE POLICY "Auth users can insert comprovantes" ON storage.objects 
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovantes_liquidacao');

CREATE POLICY "Auth users can update comprovantes" ON storage.objects 
  FOR UPDATE TO authenticated USING (bucket_id = 'comprovantes_liquidacao');
