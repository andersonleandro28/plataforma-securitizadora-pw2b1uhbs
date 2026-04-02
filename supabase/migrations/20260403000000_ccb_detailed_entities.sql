DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.usuarios_conjuges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ccb_id UUID REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        document TEXT NOT NULL,
        dob DATE,
        zip TEXT,
        street TEXT,
        number TEXT,
        neighborhood TEXT,
        city TEXT,
        state TEXT,
        phone TEXT,
        email TEXT,
        docs_paths JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.usuarios_avalistas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ccb_id UUID REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        document TEXT NOT NULL,
        dob DATE,
        zip TEXT,
        street TEXT,
        number TEXT,
        neighborhood TEXT,
        city TEXT,
        state TEXT,
        phone TEXT,
        email TEXT,
        income NUMERIC,
        relationship TEXT,
        docs_paths JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.dados_bancarios_ccb (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ccb_id UUID REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        bank TEXT,
        branch TEXT,
        account TEXT,
        owner_name TEXT,
        owner_document TEXT,
        pix_key TEXT,
        docs_paths JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
END $$;

DO $$
BEGIN
    ALTER TABLE public.usuarios_conjuges ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.usuarios_avalistas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.dados_bancarios_ccb ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "auth_all_usuarios_conjuges" ON public.usuarios_conjuges;
    CREATE POLICY "auth_all_usuarios_conjuges" ON public.usuarios_conjuges
      FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_all_usuarios_avalistas" ON public.usuarios_avalistas;
    CREATE POLICY "auth_all_usuarios_avalistas" ON public.usuarios_avalistas
      FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_all_dados_bancarios_ccb" ON public.dados_bancarios_ccb;
    CREATE POLICY "auth_all_dados_bancarios_ccb" ON public.dados_bancarios_ccb
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
