-- Add signature tracking fields to credit_operations
ALTER TABLE public.credit_operations 
ADD COLUMN IF NOT EXISTS signature_envelope_id TEXT,
ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'pending';

-- Create contract_versions table for audit trail
CREATE TABLE IF NOT EXISTS public.contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES public.credit_operations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and setup policies for contract_versions
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_contract_versions" ON public.contract_versions;
CREATE POLICY "auth_all_contract_versions" ON public.contract_versions 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
