-- Migração para sincronizar valor e data de resgate/saque (investment_redemptions)
-- com tesouraria (treasury_transactions) e livro caixa (movimentacoes_caixa),
-- espelhando o comportamento implementado para aportes em 20261006220000_sync_investment_manual_value.sql.
--
-- ATENÇÃO:
-- 1. Resgates interest_only (juros mensais): cotas e principal permanecem intocados;
--    apenas os registros monetários de tesouraria/caixa e o próprio resgate são sincronizados.
-- 2. Resgates pendentes: sincroniza dados de preparação quando aplicável.
-- 3. Resgates liquidados (paid): atualiza a movimentação de caixa e tesouraria vinculadas.

CREATE OR REPLACE FUNCTION public.sync_redemption_manual_value()
RETURNS trigger AS $$
DECLARE
  v_ext_ref TEXT;
  v_inv_name TEXT;
  v_desc TEXT;
  v_date_eff DATE;
  v_ts_eff TIMESTAMPTZ;
  v_is_interest_only BOOLEAN;
BEGIN
  -- Disparar se net_value, gross_value, tax_amount ou updated_at forem alterados
  IF NEW.net_value IS DISTINCT FROM OLD.net_value OR
     NEW.gross_value IS DISTINCT FROM OLD.gross_value OR
     NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
     NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN

    v_ext_ref := 'redemption-' || NEW.id::text;
    v_is_interest_only := (COALESCE(NEW.redemption_type, 'total') = 'interest_only');

    -- Data de competência/efetiva
    v_ts_eff := COALESCE(NEW.updated_at, NEW.created_at, NOW());
    v_date_eff := v_ts_eff::date;

    -- Obter nome do investidor
    SELECT COALESCE(p.full_name, p.pj_company_name, 'Investidor')
    INTO v_inv_name
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    IF v_inv_name IS NULL THEN
      v_inv_name := 'Investidor';
    END IF;

    -- Montar descrição coerente com o tipo de resgate
    IF v_is_interest_only THEN
      v_desc := 'Pagamento de Juros Mensais — ' || v_inv_name || ' — Competência ' || COALESCE(NEW.period_month, TO_CHAR(v_date_eff, 'YYYY-MM'));
    ELSE
      v_desc := 'Resgate de investimento — ' || v_inv_name || ' — ' || COALESCE(NEW.requested_quotas, 0) || ' cotas';
    END IF;

    -- Apenas resgates que já tenham movimentação financeira lançada (status 'paid' ou com registros existentes)
    -- Atualizar Tesouraria (saída do valor líquido)
    UPDATE public.treasury_transactions
    SET amount = NEW.net_value,
        date = v_date_eff,
        description = v_desc
    WHERE external_ref = v_ext_ref
      AND (amount IS DISTINCT FROM NEW.net_value OR date IS DISTINCT FROM v_date_eff OR description IS DISTINCT FROM v_desc);

    -- Atualizar Tesouraria para imposto retido se houver registro vinculado (tax-redemption-)
    IF NEW.tax_amount IS NOT NULL THEN
      UPDATE public.treasury_transactions
      SET amount = NEW.tax_amount,
          date = v_date_eff
      WHERE external_ref = 'tax-' || v_ext_ref
        AND (amount IS DISTINCT FROM NEW.tax_amount OR date IS DISTINCT FROM v_date_eff);
    END IF;

    -- Atualizar Livro Caixa (movimentacoes_caixa)
    UPDATE public.movimentacoes_caixa
    SET valor = NEW.net_value,
        descricao = v_desc,
        created_at = v_ts_eff
    WHERE referencia_id = NEW.id
      AND referencia_tipo = 'resgate_investimento'
      AND (valor IS DISTINCT FROM NEW.net_value OR descricao IS DISTINCT FROM v_desc OR created_at IS DISTINCT FROM v_ts_eff);

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_redemption_manual_value_changed ON public.investment_redemptions;
CREATE TRIGGER on_redemption_manual_value_changed
  AFTER UPDATE OF net_value, gross_value, tax_amount, updated_at ON public.investment_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_redemption_manual_value();
