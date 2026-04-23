ALTER TABLE public.credit_operations 
ADD COLUMN IF NOT EXISTS sacado_document TEXT,
ADD COLUMN IF NOT EXISTS sacado_email TEXT,
ADD COLUMN IF NOT EXISTS sacado_phone TEXT;
