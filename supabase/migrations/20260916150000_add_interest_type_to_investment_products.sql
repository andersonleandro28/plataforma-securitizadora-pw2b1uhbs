-- Adiciona coluna interest_type na tabela investment_products
-- Valores aceitos: 'simples' ou 'composto', com default 'simples' para garantir retrocompatibilidade.

ALTER TABLE public.investment_products
  ADD COLUMN IF NOT EXISTS interest_type TEXT NOT NULL DEFAULT 'simples';

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.investment_products.interest_type IS 'Tipo de rentabilidade: simples (juro simples) ou composto (juro composto)';
