-- 20260427161500_fix_date_discrepancies.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DE SINTAXE (aplicada em 18/11/2026)
-- ─────────────────────────────────────────────────────────────────────────────
-- Este arquivo tinha `DO $` ... `END $;` em vez de `DO $$` ... `END $$;`.
-- Isso é erro de sintaxe: a migration NUNCA foi aplicada com sucesso e, como
-- o pipeline para no primeiro erro, ela bloqueava a aplicação de TODAS as
-- migrations posteriores.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE O CONTEÚDO FOI NEUTRALIZADO (e não apenas corrigido)
-- ─────────────────────────────────────────────────────────────────────────────
-- O corpo original fazia:
--
--   UPDATE ... SET created_at = date_trunc('day', created_at) + interval '15 hours'
--   WHERE EXTRACT(HOUR FROM created_at) < 12
--
-- em investments, debenture_subscriptions, ccb_solicitacoes, credit_operations
-- e recebiveis_ccb. Isso reescreve o timestamp de criação de TODOS os registros
-- criados antes do meio-dia UTC — em produção, com dados reais, possivelmente
-- metade das linhas de cada tabela.
--
-- created_at é dado de auditoria. Alterá-lo em massa, meses depois, apaga a
-- informação de quando o registro realmente entrou no sistema, e é irreversível
-- (o valor original não fica guardado em lugar nenhum).
--
-- O problema que essa migration queria resolver — datas aparecendo um dia
-- antes por causa do fuso UTC-3 — já está tratado na exibição, com o
-- parseLocalDate do frontend e as migrations 20260503203000 /
-- 20260503203947 / 20260503204500. E o sistema opera normalmente há meses sem
-- essa reescrita, justamente porque ela nunca rodou.
--
-- Portanto: a migration passa a ser válida e vazia. Ela desbloqueia o pipeline
-- sem tocar em nenhum dado. Se o dono quiser de fato normalizar os horários,
-- isso deve ser decidido explicitamente, com backup e uma janela combinada —
-- não como efeito colateral de um deploy.

DO $$
BEGIN
  RAISE NOTICE 'fix_date_discrepancies: neutralizada (reescrita de created_at em dados reais exige decisão do dono)';
END $$;
