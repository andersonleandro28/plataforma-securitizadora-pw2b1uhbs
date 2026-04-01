-- Create config_ccb table
CREATE TABLE IF NOT EXISTS public.config_ccb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL DEFAULT 'BDIGITAL',
  interest_rate_monthly numeric NOT NULL DEFAULT 2.5,
  interest_rate_annual numeric NOT NULL DEFAULT 34.49,
  iof_rate numeric NOT NULL DEFAULT 0.38,
  irrf_rate numeric NOT NULL DEFAULT 1.5,
  multiplier_factor numeric NOT NULL DEFAULT 1.0,
  max_term_months integer NOT NULL DEFAULT 36,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.config_ccb (id, partner_name) 
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'BDIGITAL') 
ON CONFLICT (id) DO NOTHING;

-- Create operacoes_antecipacao table
CREATE TABLE IF NOT EXISTS public.operacoes_antecipacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ccb_id uuid UNIQUE REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  net_value numeric NOT NULL DEFAULT 0,
  installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  partner_bank text NOT NULL DEFAULT 'BDIGITAL',
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Set up Row Level Security
ALTER TABLE public.config_ccb ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_config_ccb" ON public.config_ccb;
CREATE POLICY "auth_all_config_ccb" ON public.config_ccb FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.operacoes_antecipacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_operacoes_antecipacao" ON public.operacoes_antecipacao;
CREATE POLICY "auth_all_operacoes_antecipacao" ON public.operacoes_antecipacao FOR ALL TO authenticated USING (true) WITH CHECK (true);
