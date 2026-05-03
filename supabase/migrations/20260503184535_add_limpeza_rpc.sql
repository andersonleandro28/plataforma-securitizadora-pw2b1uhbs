CREATE OR REPLACE FUNCTION public.limpar_tabelas_problematicas() RETURNS boolean AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DROP TRIGGER IF EXISTS trg_processa_movimentacao_caixa ON public.movimentacoes_caixa;
  DROP TRIGGER IF EXISTS trg_protect_movimentacao_core_fields ON public.movimentacoes_caixa;
  DROP TRIGGER IF EXISTS trg_check_duplicidade_mapeamento ON public.mapeamento_movimentacoes;

  DROP FUNCTION IF EXISTS public.processa_movimentacao_caixa() CASCADE;
  DROP FUNCTION IF EXISTS public.protect_movimentacao_core_fields() CASCADE;
  DROP FUNCTION IF EXISTS public.check_duplicidade_mapeamento() CASCADE;
  DROP FUNCTION IF EXISTS public.migrar_dados_historicos(numeric) CASCADE;
  DROP FUNCTION IF EXISTS public.recalcular_saldo_caixa(numeric) CASCADE;

  DROP TABLE IF EXISTS public.mapeamento_movimentacoes CASCADE;
  DROP TABLE IF EXISTS public.movimentacoes_caixa CASCADE;
  DROP TABLE IF EXISTS public.saldo_caixa CASCADE;
  DROP TABLE IF EXISTS public.auditoria_limpeza CASCADE;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
