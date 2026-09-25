-- Migration: Adicionar campos de número de escritura e emissão
-- Adiciona numero_escritura e numero_emissao em debentures
ALTER TABLE public.debentures
ADD COLUMN IF NOT EXISTS numero_escritura TEXT DEFAULT '1ª Emissão Pública',
ADD COLUMN IF NOT EXISTS numero_emissao TEXT DEFAULT '1ª Emissão';

-- Adiciona campos de fallback em company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS debenture_numero_escritura_padrao TEXT DEFAULT '1ª Escritura de Emissão Pública',
ADD COLUMN IF NOT EXISTS debenture_serie_padrao TEXT DEFAULT '1ª Série';

-- Atualiza dados retroativos na tabela debentures para que nenhuma fique sem número de escritura
UPDATE public.debentures
SET numero_escritura = COALESCE(numero_escritura, '1ª Escritura de Emissão Pública de Debêntures'),
    numero_emissao = COALESCE(numero_emissao, '1ª Emissão')
WHERE numero_escritura IS NULL OR numero_emissao IS NULL;

-- Garante que storage bucket 'investment-docs' exista e tenha RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('investment-docs', 'investment-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso ao storage investment-docs
DO $$
BEGIN
  -- Permite select público para leitura de contratos gerados
  DROP POLICY IF EXISTS "Public Select Investment Docs" ON storage.objects;
  CREATE POLICY "Public Select Investment Docs" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'investment-docs');

  -- Permite upload por usuários autenticados
  DROP POLICY IF EXISTS "Authenticated Upload Investment Docs" ON storage.objects;
  CREATE POLICY "Authenticated Upload Investment Docs" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'investment-docs');

  -- Permite update por usuários autenticados
  DROP POLICY IF EXISTS "Authenticated Update Investment Docs" ON storage.objects;
  CREATE POLICY "Authenticated Update Investment Docs" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'investment-docs');
END $$;
