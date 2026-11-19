-- Exclusão de pedidos de resgate REJEITADOS na Fila de Resgates (/admin/investments).
-- A tabela public.investment_redemptions não possui coluna deleted_at, então a exclusão
-- é física (hard delete). Pedidos rejeitados nunca tiveram lançamento financeiro:
-- os lançamentos em treasury_transactions/movimentacoes_caixa só são criados quando o
-- resgate é liquidado (RPC process_redemption_payment). Portanto excluir um pedido
-- com status 'rejected' não afeta o fluxo financeiro nem o saldo contábil.
-- Regra do projeto: resgates 'paid' (Liquidado) e 'liquidado' NUNCA podem ser excluídos.
-- Exposição: a ação de excluir existe apenas na UI para status 'rejected'.

-- 1) RPC que só exclui pedidos rejeitados (defesa no banco)
CREATE OR REPLACE FUNCTION public.delete_rejected_redemption(p_redemption_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem excluir pedidos de resgate.';
  END IF;

  IF p_redemption_id IS NULL THEN
    RAISE EXCEPTION 'Pedido de resgate não informado.';
  END IF;

  SELECT status INTO v_status
  FROM public.investment_redemptions
  WHERE id = p_redemption_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de resgate não encontrado.';
  END IF;

  -- Hard stop: status que NUNCA podem ser excluídos (regra de limite de crédito do projeto)
  IF v_status IN ('paid', 'liquidado', 'approved') THEN
    RAISE EXCEPTION 'Somente pedidos com status Rejeitado podem ser excluídos. Status atual: %.', v_status;
  END IF;

  -- Segurança extra: exclui somente se ainda estiver rejeitado (proteção contra corrida)
  DELETE FROM public.investment_redemptions
  WHERE id = p_redemption_id
    AND status = 'rejected';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não está mais com status Rejeitado. Exclusão cancelada.';
  END IF;

  RETURN jsonb_build_object('deleted', true, 'redemption_id', p_redemption_id);
END;
$$;
