-- Setup buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('operation-docs', 'operation-docs', false) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload and read
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operation-docs');

DROP POLICY IF EXISTS "Auth View" ON storage.objects;
CREATE POLICY "Auth View" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'operation-docs');

-- Create Tables
CREATE TABLE IF NOT EXISTS public.financial_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_type TEXT NOT NULL UNIQUE,
  interest_rate_monthly NUMERIC DEFAULT 0,
  discount_rate_monthly NUMERIC DEFAULT 0,
  ad_valorem_rate NUMERIC DEFAULT 0,
  ad_valorem_base TEXT DEFAULT 'face_value',
  structuring_fee NUMERIC DEFAULT 0,
  structuring_fee_type TEXT DEFAULT 'fixed',
  analysis_fee NUMERIC DEFAULT 0,
  analysis_fee_type TEXT DEFAULT 'fixed',
  collection_fee NUMERIC DEFAULT 0,
  penalty_rate NUMERIC DEFAULT 0,
  default_interest_rate NUMERIC DEFAULT 0,
  iof_fixed_rate NUMERIC DEFAULT 0,
  iof_daily_rate NUMERIC DEFAULT 0,
  min_operation_value NUMERIC DEFAULT 0,
  max_operation_value NUMERIC DEFAULT 0,
  min_term_days INTEGER DEFAULT 0,
  max_term_days INTEGER DEFAULT 0,
  grace_period_days INTEGER DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parameter_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id UUID REFERENCES public.financial_parameters(id) ON DELETE CASCADE,
  changes JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES auth.users(id) NOT NULL,
  receivable_type TEXT NOT NULL,
  receivable_type_other TEXT,
  cedente TEXT NOT NULL,
  sacado TEXT NOT NULL,
  document_number TEXT NOT NULL,
  face_value NUMERIC NOT NULL,
  requested_value NUMERIC NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  installments INTEGER DEFAULT 1,
  observations TEXT,
  status TEXT DEFAULT 'enviado',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES public.credit_operations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  category TEXT DEFAULT 'comprobatorio',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES public.credit_operations(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  internal_observation TEXT,
  borrower_observation TEXT
);

CREATE TABLE IF NOT EXISTS public.operation_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES public.credit_operations(id) ON DELETE CASCADE UNIQUE,
  term_days INTEGER,
  discount_value NUMERIC,
  interest_value NUMERIC,
  ad_valorem_value NUMERIC,
  structuring_value NUMERIC,
  analysis_value NUMERIC,
  iof_fixed_value NUMERIC,
  iof_daily_value NUMERIC,
  total_discounts NUMERIC,
  net_value NUMERIC,
  effective_cost_rate NUMERIC,
  calculation_memory JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS
ALTER TABLE public.financial_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parameter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_financial_parameters" ON public.financial_parameters;
CREATE POLICY "auth_all_financial_parameters" ON public.financial_parameters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_parameter_history" ON public.parameter_history;
CREATE POLICY "auth_all_parameter_history" ON public.parameter_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_credit_operations" ON public.credit_operations;
CREATE POLICY "auth_all_credit_operations" ON public.credit_operations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_operation_documents" ON public.operation_documents;
CREATE POLICY "auth_all_operation_documents" ON public.operation_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_operation_status_history" ON public.operation_status_history;
CREATE POLICY "auth_all_operation_status_history" ON public.operation_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_operation_calculations" ON public.operation_calculations;
CREATE POLICY "auth_all_operation_calculations" ON public.operation_calculations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_audit_logs" ON public.audit_logs;
CREATE POLICY "auth_all_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert global params seed
INSERT INTO public.financial_parameters (receivable_type, interest_rate_monthly, discount_rate_monthly, ad_valorem_rate, structuring_fee, analysis_fee, iof_fixed_rate, iof_daily_rate)
VALUES ('global', 2.5, 1.5, 0.5, 100, 50, 0.38, 0.0082)
ON CONFLICT (receivable_type) DO NOTHING;

-- Create trigger for operation status history
CREATE OR REPLACE FUNCTION public.log_operation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.operation_status_history (operation_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_operation_status_change ON public.credit_operations;
CREATE TRIGGER on_operation_status_change
  AFTER UPDATE ON public.credit_operations
  FOR EACH ROW EXECUTE FUNCTION public.log_operation_status_change();
