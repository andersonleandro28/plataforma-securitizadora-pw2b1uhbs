-- 20261118230000_diagnostico_lancamentos_incidente.sql
--
-- DIAGNÓSTICO SOMENTE LEITURA — incidente do agente Maestro (16-17/11/2026)
--
-- Contexto: após as alterações do agente, o saldo consolidado de caixa passou
-- a exibir ~R$ 242 mil acima do real em todos os fechamentos. Hipótese
-- verificada no código: lançamentos de tesouraria SEM conta bancária
-- (bank_account_id nulo) criados na janela do incidente, somados pela regra
-- antiga do frontend à conta ativa.
--
-- Esta migration NÃO altera nenhum registro. Cria uma função de diagnóstico
-- temporária que lista, um a um, os lançamentos criados a partir de 13/11
-- (autorização expressa do dono para auditar/remover dados dessa janela).
--
-- A função é removida pela migration seguinte
-- (20261118230100_remove_diagnostico_lancamentos.sql) após a leitura do
-- resultado pelo suporte. GRANT para anon é intencional e de curta duração:
-- permite a leitura pelo suporte sem sessão de usuário, exposta apenas à
-- lista de lançamentos da janela do incidente.

CREATE OR REPLACE FUNCTION public.diagnostico_lancamentos_incidente(
  p_since TIMESTAMPTZ DEFAULT '2026-11-13T00:00:00Z'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tt_total INTEGER;
  v_tt_sem_conta INTEGER;
  v_tt_sem_conta_in INTEGER;
  v_tt_sem_conta_out INTEGER;
  v_sem_conta_liquido NUMERIC;
  v_mov_total INTEGER;
  v_mov_desde INTEGER;
  v_exp_desde INTEGER;
  v_rec_desde INTEGER;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE bank_account_id IS NULL),
         COUNT(*) FILTER (WHERE bank_account_id IS NULL AND type = 'in'),
         COUNT(*) FILTER (WHERE bank_account_id IS NULL AND type = 'out'),
         COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END)
                  FILTER (WHERE bank_account_id IS NULL), 0)
    INTO v_tt_total, v_tt_sem_conta, v_tt_sem_conta_in, v_tt_sem_conta_out, v_sem_conta_liquido
    FROM treasury_transactions
   WHERE created_at >= p_since;

  SELECT COUNT(*) INTO v_mov_total FROM movimentacoes_caixa;
  SELECT COUNT(*) INTO v_mov_desde FROM movimentacoes_caixa WHERE created_at >= p_since;
  SELECT COUNT(*) INTO v_exp_desde FROM expenses WHERE created_at >= p_since;
  SELECT COUNT(*) INTO v_rec_desde FROM recebiveis_ccb WHERE created_at >= p_since;

  RETURN jsonb_build_object(
    'since', p_since,
    'treasury', jsonb_build_object(
      'total_desde', v_tt_total,
      'sem_conta', jsonb_build_object(
        'count', v_tt_sem_conta,
        'in_count', v_tt_sem_conta_in,
        'out_count', v_tt_sem_conta_out,
        'liquido', v_sem_conta_liquido
      ),
      'lancamentos', COALESCE((
        SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at)
        FROM (
          SELECT id, created_at, date, description, category, amount, type,
                 external_ref, bank_account_id, status, deleted_at
            FROM treasury_transactions
           WHERE created_at >= p_since
           ORDER BY created_at
        ) t
      ), '[]'::jsonb)
    ),
    'movimentacoes_caixa', jsonb_build_object(
      'total', v_mov_total,
      'desde', v_mov_desde,
      'lancamentos', COALESCE((
        SELECT jsonb_agg(row_to_json(m) ORDER BY m.created_at)
        FROM (
          SELECT id, created_at, descricao, tipo, valor, referencia_tipo,
                 referencia_id, bank_account_id, deleted_at
            FROM movimentacoes_caixa
           WHERE created_at >= p_since
           ORDER BY created_at
        ) m
      ), '[]'::jsonb)
    ),
    'expenses_desde', v_exp_desde,
    'recebiveis_ccb_desde', v_rec_desde
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnostico_lancamentos_incidente(TIMESTAMPTZ) TO anon, authenticated;
