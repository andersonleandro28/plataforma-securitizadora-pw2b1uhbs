-- Migration: 20260925193000_create_company_settings.sql
-- Tabela singleton para dados cadastrais da securitizadora para preâmbulos, contratos e documentos

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_uf TEXT,
  endereco_cep TEXT,
  telefone TEXT,
  email TEXT,
  representante_nome TEXT,
  representante_cargo TEXT DEFAULT 'Sócio-Administrador',
  representante_cpf TEXT,
  capital_social NUMERIC DEFAULT 0,
  registro_regulador TEXT, -- ex: CVM / CNSP / ANBIMA
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Ativar RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- Leitura permitida para todos os usuários autenticados (investidores, tomadores, staff, admin gerando documentos)
DROP POLICY IF EXISTS "company_settings_select_policy" ON public.company_settings;
CREATE POLICY "company_settings_select_policy" ON public.company_settings
  FOR SELECT TO authenticated USING (true);

-- Escrita/Edição permitida para admin
DROP POLICY IF EXISTS "company_settings_insert_policy" ON public.company_settings;
CREATE POLICY "company_settings_insert_policy" ON public.company_settings
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "company_settings_update_policy" ON public.company_settings;
CREATE POLICY "company_settings_update_policy" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- Inserir registro inicial padrão (singleton) caso não exista
INSERT INTO public.company_settings (
  id,
  razao_social,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  inscricao_municipal,
  endereco_logradouro,
  endereco_numero,
  endereco_complemento,
  endereco_bairro,
  endereco_cidade,
  endereco_uf,
  endereco_cep,
  telefone,
  email,
  representante_nome,
  representante_cargo,
  representante_cpf,
  capital_social,
  registro_regulador
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Nexum Securitizadora S.A.',
  'Nexum Security 360º',
  '00.000.000/0001-00',
  '',
  '',
  'Avenida Principal',
  '1000',
  'Sala 501',
  'Centro',
  'Criciúma',
  'SC',
  '88800-000',
  '(48) 3433-0000',
  'contato@nexumsecurity.com.br',
  'Anderson Leandro',
  'Diretor Presidente',
  '000.000.000-00',
  1000000.00,
  'Resolução CVM nº 60/2021'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings LIMIT 1);
