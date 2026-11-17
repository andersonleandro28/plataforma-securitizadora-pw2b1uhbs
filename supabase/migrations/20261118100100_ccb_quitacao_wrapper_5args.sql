-- 20261118100100_ccb_quitacao_wrapper_5args.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURA A ASSINATURA DE 5 PARÂMETROS (compatibilidade com o front publicado)
-- ─────────────────────────────────────────────────────────────────────────────
-- A migration 20261118100000 criou quit_ccb_solicitacao com 6 parâmetros e
-- removeu a versão de 5. Problema: o frontend que está no ar hoje chama a RPC
-- apenas com 5 argumentos nomeados (sem p_taxas_modo), e o PostgREST não
-- encontra função com essa lista — a quitação passaria a falhar com erro de
-- "function not found" em produção, entre o deploy do banco e o deploy do app.
--
-- Esta função delega para a implementação real, fixando p_taxas_modo = NULL
-- (que resolve para 'cobrar', preservando o comportamento atual). Assim:
--   * o front antigo continua funcionando;
--   * o front novo usa a versão de 6 parâmetros e escolhe o modo;
--   * existe UMA única implementação do cálculo.
--
-- Quando o front novo estiver publicado há tempo suficiente, este wrapper pode
-- ser removido numa próxima migration.

CREATE OR REPLACE FUNCTION public.quit_ccb_solicitacao(
  p_ccb_id UUID,
  p_payment_date DATE DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_discount_pct NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.quit_ccb_solicitacao(
    p_ccb_id,
    p_payment_date,
    p_bank_account_id,
    p_notes,
    p_discount_pct,
    NULL::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quit_ccb_solicitacao(UUID, DATE, UUID, TEXT, NUMERIC) TO authenticated;
