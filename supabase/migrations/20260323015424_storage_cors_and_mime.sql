-- CONFIGURAÇÃO DE CORS (SUPABASE):
-- 1. Verifique e ajuste as configurações de CORS no painel do Supabase Storage.
-- 2. Permita explicitamente a origem 'https://plataforma-securitizadora-a4720.goskip.app' nos cabeçalhos 'Access-Control-Allow-Origin'.
-- 3. Adicione suporte aos métodos GET, POST, PUT e OPTIONS.

-- Update bucket settings to ensure proper mime types and ensure it's not fully public
UPDATE storage.buckets
SET 
  public = false,
  allowed_mime_types = ARRAY[
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'application/xml', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
WHERE id = 'operation-docs';
