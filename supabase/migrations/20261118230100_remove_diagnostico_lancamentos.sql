-- 20261118230100_remove_diagnostico_lancamentos.sql
--
-- Remove a função de diagnóstico temporária criada pela migration
-- 20261118230000. O banco retorna exatamente ao estado anterior: nenhuma
-- função extra, nenhum grant extra. Os dois arquivos ficam no repositório
-- como registro auditável do diagnóstico feito pelo suporte.

DROP FUNCTION IF EXISTS public.diagnostico_lancamentos_incidente(TIMESTAMPTZ);
