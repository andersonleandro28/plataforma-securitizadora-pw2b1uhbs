-- Adicionar coluna installments_data (JSONB) para suporte a múltiplas parcelas com vencimentos e valores individuais
ALTER TABLE public.credit_operations
  ADD COLUMN IF NOT EXISTS installments_data JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.credit_operations.installments_data IS 'Lista detalhada de parcelas com numero, due_date, value e document_name/document_path';
