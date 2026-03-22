CREATE TABLE IF NOT EXISTS public.risk_analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID REFERENCES public.credit_operations(id) ON DELETE CASCADE,
    serasa_score INTEGER,
    sio_score NUMERIC,
    risk_level TEXT,
    triggers JSONB,
    raw_serasa_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.risk_analysis_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_risk_analysis_select" ON public.risk_analysis_history;
CREATE POLICY "auth_risk_analysis_select" ON public.risk_analysis_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_risk_analysis_insert" ON public.risk_analysis_history;
CREATE POLICY "auth_risk_analysis_insert" ON public.risk_analysis_history
  FOR INSERT TO authenticated WITH CHECK (true);
