-- Migration: Adicionar campos de registro da escritura nas tabelas debentures e company_settings
-- Permite salvar órgão de registro (Junta Comercial), data de registro/arquivamento e número de arquivamento.

ALTER TABLE public.debentures
ADD COLUMN IF NOT EXISTS orgao_registro TEXT DEFAULT 'Junta Comercial do Estado de Santa Catarina',
ADD COLUMN IF NOT EXISTS data_registro DATE DEFAULT '2025-06-05',
ADD COLUMN IF NOT EXISTS numero_arquivamento TEXT DEFAULT 'ED009857000';

-- Também adicionamos fallbacks opcionais em company_settings para escrituras padrão
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS debenture_orgao_registro_padrao TEXT DEFAULT 'Junta Comercial do Estado de Santa Catarina',
ADD COLUMN IF NOT EXISTS debenture_data_registro_padrao DATE DEFAULT '2025-06-05',
ADD COLUMN IF NOT EXISTS debenture_numero_arquivamento_padrao TEXT DEFAULT 'ED009857000';

-- Popula os registros existentes com as informações normativas fornecidas pelo usuário
UPDATE public.debentures
SET 
  numero_escritura = COALESCE(NULLIF(numero_escritura, ''), '1ª Escritura de Emissão Pública de Debêntures'),
  orgao_registro = COALESCE(NULLIF(orgao_registro, ''), 'Junta Comercial do Estado de Santa Catarina'),
  data_registro = COALESCE(data_registro, '2025-06-05'::date),
  numero_arquivamento = COALESCE(NULLIF(numero_arquivamento, ''), 'ED009857000')
WHERE orgao_registro IS NULL 
   OR data_registro IS NULL 
   OR numero_arquivamento IS NULL
   OR numero_escritura = '1ª Emissão Pública';
