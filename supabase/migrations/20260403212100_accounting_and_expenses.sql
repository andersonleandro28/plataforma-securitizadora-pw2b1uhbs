DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'accountant'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'accountant';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    document_number TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    status TEXT DEFAULT 'pending',
    invoice_file_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_accountant BOOLEAN DEFAULT false;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_suppliers" ON public.suppliers;
CREATE POLICY "auth_all_suppliers" ON public.suppliers FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_all_expenses" ON public.expenses;
CREATE POLICY "auth_all_expenses" ON public.expenses FOR ALL TO authenticated USING (true);
