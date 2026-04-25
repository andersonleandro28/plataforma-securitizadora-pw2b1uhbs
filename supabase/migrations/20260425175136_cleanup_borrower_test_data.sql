-- 4. INTEGRIDADE E BACKUP:
-- Gere um backup de segurança chamado 'pre_producao_preserva_investimentos' antes de iniciar.
CREATE SCHEMA IF NOT EXISTS pre_producao_preserva_investimentos;

CREATE TABLE IF NOT EXISTS pre_producao_preserva_investimentos.credit_operations_bkp AS SELECT * FROM public.credit_operations;
CREATE TABLE IF NOT EXISTS pre_producao_preserva_investimentos.borders_bkp AS SELECT * FROM public.borders;
CREATE TABLE IF NOT EXISTS pre_producao_preserva_investimentos.recebiveis_ccb_bkp AS SELECT * FROM public.recebiveis_ccb;
CREATE TABLE IF NOT EXISTS pre_producao_preserva_investimentos.operacoes_antecipacao_bkp AS SELECT * FROM public.operacoes_antecipacao;
CREATE TABLE IF NOT EXISTS pre_producao_preserva_investimentos.ccb_solicitacoes_bkp AS SELECT * FROM public.ccb_solicitacoes;

DO $$
DECLARE
    seq_name text;
BEGIN
  -- 1. LIMPEZA EXCLUSIVA DE TOMADORES (Ativo):
  -- Deleta registros de operações de crédito e recebíveis, acionando ON DELETE CASCADE nas tabelas filhas (documentos, avalistas, etc)
  DELETE FROM public.operacoes_antecipacao;
  DELETE FROM public.recebiveis_ccb;
  DELETE FROM public.ccb_solicitacoes;
  DELETE FROM public.borders;
  DELETE FROM public.border_items;
  DELETE FROM public.operation_calculations;
  DELETE FROM public.operation_documents;
  DELETE FROM public.operation_status_history;
  DELETE FROM public.risk_analysis_history;
  DELETE FROM public.contract_versions;
  DELETE FROM public.credit_operations;

  -- 3. SANEAMENTO DA TESOURARIA E ESCROW:
  -- Removemos transações manuais órfãs associadas aos testes de operações ativas (Borderôs/CCBs)
  DELETE FROM public.treasury_transactions
  WHERE category ILIKE '%CCB%' 
     OR category ILIKE '%Border%'
     OR description ILIKE '%CCB%' 
     OR description ILIKE '%Border%'
     OR category ILIKE '%Liquida%';

  -- Reset contadores de ID (auto-incremento) caso existam sequences criadas para uso de short IDs
  FOR seq_name IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
      EXECUTE 'ALTER SEQUENCE public.' || quote_ident(seq_name) || ' RESTART WITH 1';
  END LOOP;
END $$;
