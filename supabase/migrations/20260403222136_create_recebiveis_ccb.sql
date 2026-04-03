CREATE TABLE IF NOT EXISTS public.recebiveis_ccb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccb_id UUID REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
  acquisition_value NUMERIC NOT NULL,
  boleto_count INTEGER NOT NULL,
  boleto_unit_value NUMERIC NOT NULL,
  gross_profit NUMERIC,
  tir_effective NUMERIC,
  provision_amount NUMERIC,
  payment_receipt_url TEXT,
  boletos_list_url TEXT,
  boletos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_recebiveis_ccb" ON public.recebiveis_ccb;
CREATE POLICY "auth_all_recebiveis_ccb" ON public.recebiveis_ccb FOR ALL TO authenticated USING (true) WITH CHECK (true);
