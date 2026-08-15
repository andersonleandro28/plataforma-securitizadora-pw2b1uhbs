-- Adiciona a coluna `type` à tabela `expenses` para distinguir despesas
-- administrativas (sem nota fiscal / sem fornecedor) das despesas de
-- fornecedor existentes. Valores usados:
--   'despesa_administrativa' — impostos, tarifas bancárias, taxas, etc.
--   NULL ou 'fornecedor'     — despesas de fornecedor (fluxo existente).
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT;
