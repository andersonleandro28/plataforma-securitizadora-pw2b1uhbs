-- Migration: 20260924120000_fix_get_bank_account_balance_deduplications.sql
-- Recria/corrige a RPC get_bank_account_balance para aplicar as MESMAS deduplicações do Livro Caixa oficial:
-- (i) descontar lançamentos de movimentacoes_caixa já representados na tabela oficial expenses;
-- (ii) deduplicar resgates de investment_redemptions contra referências externas em treasury_transactions;
-- (iii) excluir provisões de IRRF sobre resgates (só contam no DARF efetivo pago em expenses);
-- (iv) excluir lançamentos com soft-delete (deleted_at IS NOT NULL).

CREATE OR REPLACE FUNCTION public.get_bank_account_balance(p_bank_account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_balance NUMERIC := 0;
  v_active_id UUID;
  v_is_target_active BOOLEAN := FALSE;
BEGIN
  -- Identifica a conta bancária principal/ativa padrão
  SELECT id INTO v_active_id
  FROM public.company_bank_accounts
  WHERE is_active = TRUE
  LIMIT 1;

  IF v_active_id IS NULL THEN
    SELECT id INTO v_active_id
    FROM public.company_bank_accounts
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  v_is_target_active := (p_bank_account_id = v_active_id);

  -- Calcula o saldo contábil real do Livro Caixa para a conta alvo com as deduplicações vigentes
  WITH deduped_caixa AS (
    SELECT 
      mc.id,
      mc.valor,
      mc.tipo,
      mc.categoria,
      mc.descricao,
      mc.referencia_id,
      mc.referencia_tipo,
      mc.bank_account_id
    FROM public.movimentacoes_caixa mc
    WHERE mc.deleted_at IS NULL
      -- Filtragem por conta bancária alvo (com fallback de conta ativa para lançamentos sem bank_account_id)
      AND (
        mc.bank_account_id = p_bank_account_id
        OR (mc.bank_account_id IS NULL AND v_is_target_active)
      )
      -- DEDUPLICAÇÃO (i): Se o lançamento em movimentacoes_caixa já está representado
      -- na tabela oficial expenses (status 'paid'), exclui a duplicata do caixa
      -- (pois a despesa oficial é a fonte da verdade de pagamento de fornecedor/despesa).
      AND NOT EXISTS (
        SELECT 1 
        FROM public.mapeamento_movimentacoes mm
        JOIN public.expenses e ON e.id = mm.origem_id
        WHERE mm.movimentacao_caixa_id = mc.id
          AND mm.origem_tabela IN ('fornecedores', 'despesas')
          AND e.status = 'paid'
      )
      AND NOT (
        (lower(trim(coalesce(mc.categoria, ''))) IN ('fornecedor', 'despesa') OR lower(trim(coalesce(mc.referencia_tipo, ''))) = 'despesa')
        AND EXISTS (
          SELECT 1 
          FROM public.expenses e
          WHERE e.id = mc.referencia_id 
            AND e.status = 'paid'
        )
      )
      -- DEDUPLICAÇÃO (ii): Se for resgate já processado e liquidado em investment_redemptions (status 'paid'),
      -- ou duplicado em treasury_transactions (external_ref = 'redemption-...'),
      -- garante que só conte uma única vez.
      AND NOT (
        lower(trim(coalesce(mc.referencia_tipo, ''))) = 'resgate_investimento'
        AND mc.referencia_id IS NOT NULL
        AND EXISTS (
          SELECT 1 
          FROM public.treasury_transactions tt
          WHERE tt.deleted_at IS NULL
            AND (tt.status = 'Confirmado' OR tt.status IS NULL)
            AND tt.external_ref = ('redemption-' || mc.referencia_id::TEXT)
        )
      )
      -- DEDUPLICAÇÃO (iii): Excluir provisões de IRRF sobre resgates
      -- (não são saídas reais de caixa imediatas; o desembolso só ocorre na DARF paga via expenses)
      AND NOT (
        lower(trim(coalesce(mc.categoria, ''))) ILIKE '%imposto%'
        AND (
          lower(trim(coalesce(mc.descricao, ''))) ILIKE '%imposto a recolher%'
          OR lower(trim(coalesce(mc.descricao, ''))) ILIKE '%irrf%'
        )
      )
  )
  SELECT COALESCE(SUM(
    CASE 
      WHEN lower(trim(tipo)) = 'entrada' THEN COALESCE(valor, 0)
      ELSE -COALESCE(valor, 0)
    END
  ), 0) INTO v_balance
  FROM deduped_caixa;

  RETURN v_balance;
END;
$$;
