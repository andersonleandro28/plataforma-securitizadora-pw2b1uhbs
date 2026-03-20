-- Add multi-role boolean flags
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_investor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_borrower BOOLEAN DEFAULT false;

-- Migrate existing roles to boolean flags
UPDATE public.profiles SET is_admin = true WHERE role = 'admin'::app_role;
UPDATE public.profiles SET is_staff = true WHERE role = 'staff'::app_role;
UPDATE public.profiles SET is_investor = true WHERE role = 'investor'::app_role;
UPDATE public.profiles SET is_borrower = true WHERE role = 'borrower'::app_role;

-- Update is_admin function to use the boolean flag
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin'::app_role OR is_admin = true)
  );
$function$;

-- Add KYC fields for PF and PJ
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pf_mother_name TEXT,
ADD COLUMN IF NOT EXISTS pf_father_name TEXT,
ADD COLUMN IF NOT EXISTS pf_marital_status TEXT,
ADD COLUMN IF NOT EXISTS pf_occupation TEXT,
ADD COLUMN IF NOT EXISTS pf_nationality TEXT DEFAULT 'Brasileira',
ADD COLUMN IF NOT EXISTS pf_birth_city TEXT,
ADD COLUMN IF NOT EXISTS pf_rg TEXT,
ADD COLUMN IF NOT EXISTS pj_company_name TEXT,
ADD COLUMN IF NOT EXISTS pj_trade_name TEXT,
ADD COLUMN IF NOT EXISTS pj_tax_regime TEXT,
ADD COLUMN IF NOT EXISTS pj_annual_revenue NUMERIC,
ADD COLUMN IF NOT EXISTS pj_cnae TEXT,
ADD COLUMN IF NOT EXISTS pj_foundation_date DATE,
ADD COLUMN IF NOT EXISTS pj_rep_name TEXT,
ADD COLUMN IF NOT EXISTS pj_rep_cpf TEXT,
ADD COLUMN IF NOT EXISTS pj_rep_rg TEXT,
ADD COLUMN IF NOT EXISTS pj_rep_role TEXT;
