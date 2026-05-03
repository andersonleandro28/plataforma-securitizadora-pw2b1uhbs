DO $$
BEGIN
  -- 1. Deletar tabela movimentacoes_caixa (inteira)
  DROP TABLE IF EXISTS public.movimentacoes_caixa CASCADE;
  
  -- 2. Deletar tabela saldo_caixa (inteira)
  DROP TABLE IF EXISTS public.saldo_caixa CASCADE;
  
  -- 3. Deletar tabela mapeamento_movimentacoes (inteira)
  DROP TABLE IF EXISTS public.mapeamento_movimentacoes CASCADE;
  
  -- 4. Deletar tabela auditoria_limpeza (se existir)
  DROP TABLE IF EXISTS public.auditoria_limpeza CASCADE;
  
  -- Remover funções e triggers associados que podem ter ficado órfãos
  DROP FUNCTION IF EXISTS public.processa_movimentacao_caixa() CASCADE;
  DROP FUNCTION IF EXISTS public.protect_movimentacao_core_fields() CASCADE;
  DROP FUNCTION IF EXISTS public.check_duplicidade_mapeamento() CASCADE;
  DROP FUNCTION IF EXISTS public.migrar_dados_historicos(numeric) CASCADE;
  DROP FUNCTION IF EXISTS public.recalcular_saldo_caixa(numeric) CASCADE;

END $$;
