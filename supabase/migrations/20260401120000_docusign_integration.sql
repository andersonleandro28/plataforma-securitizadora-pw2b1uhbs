DO $$ 
BEGIN
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('kyc-docs', 'kyc-docs', true) 
  ON CONFLICT (id) DO NOTHING;
END $$;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_signature_envelope_id TEXT,
ADD COLUMN IF NOT EXISTS kyc_signature_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS kyc_signature_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_consolidated_pdf TEXT;

ALTER TABLE public.credit_operations
ADD COLUMN IF NOT EXISTS signature_url TEXT;
