DO $$ 
BEGIN
  CREATE TABLE IF NOT EXISTS public.ccb_conjuges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ccb_id UUID NOT NULL REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      document TEXT NOT NULL,
      dob DATE,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS public.ccb_avalistas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ccb_id UUID NOT NULL REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      document TEXT NOT NULL,
      income NUMERIC,
      address TEXT,
      phone TEXT,
      relationship TEXT,
      docs_paths JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.ccb_conjuges ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ccb_avalistas ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "auth_all_ccb_conjuges" ON public.ccb_conjuges;
  CREATE POLICY "auth_all_ccb_conjuges" ON public.ccb_conjuges FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "auth_all_ccb_avalistas" ON public.ccb_avalistas;
  CREATE POLICY "auth_all_ccb_avalistas" ON public.ccb_avalistas FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
