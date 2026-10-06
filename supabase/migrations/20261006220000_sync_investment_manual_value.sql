-- Migração para aprimorar trigger sync_investment_transfer_date suportando transfer_value
-- e garantindo que alterações manuais ou recalculadas de total_value e transfer_value reflitam na Tesouraria e debenture_subscriptions

CREATE OR REPLACE FUNCTION public.sync_investment_transfer_date()
RETURNS trigger AS $$
BEGIN
  -- Se transfer_date, total_value, transfer_value, quotas ou unit_price foram alterados
  IF NEW.transfer_date IS DISTINCT FROM OLD.transfer_date OR
     NEW.total_value IS DISTINCT FROM OLD.total_value OR
     NEW.transfer_value IS DISTINCT FROM OLD.transfer_value OR
     NEW.quotas IS DISTINCT FROM OLD.quotas OR
     NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN

    -- O valor efetivo a ser refletido no contrato / subscrição e na tesouraria
    -- Se total_value estiver preenchido usa ele; fallback para transfer_value
    DECLARE
      v_effective_amount numeric := COALESCE(NEW.total_value, NEW.transfer_value);
    BEGIN
      -- Replicar para Subscrições vinculadas por investment_id
      UPDATE public.debenture_subscriptions
      SET subscription_date = COALESCE(NEW.transfer_date, subscription_date),
          total_amount = COALESCE(v_effective_amount, total_amount),
          quantity = COALESCE(NEW.quotas, quantity),
          unit_price = COALESCE(NEW.unit_price, unit_price)
      WHERE investment_id = NEW.id;

      -- Fallback: Se não encontrou pelo investment_id, tenta casar por series_id do produto + documento do investidor
      IF NOT FOUND THEN
        UPDATE public.debenture_subscriptions ds
        SET investment_id = NEW.id,
            subscription_date = COALESCE(NEW.transfer_date, ds.subscription_date),
            total_amount = COALESCE(v_effective_amount, ds.total_amount),
            quantity = COALESCE(NEW.quotas, ds.quantity),
            unit_price = COALESCE(NEW.unit_price, ds.unit_price)
        FROM public.investment_products ip, public.profiles p
        WHERE ip.id = NEW.product_id
          AND p.id = NEW.user_id
          AND ds.series_id = ip.series_id
          AND ds.investment_id IS NULL
          AND regexp_replace(COALESCE(p.document_number, ''), '\D', '', 'g') = regexp_replace(COALESCE(ds.document_number, ''), '\D', '', 'g')
          AND regexp_replace(COALESCE(p.document_number, ''), '\D', '', 'g') != '';
      END IF;

      -- Replicar para a Tesouraria (lançamentos vinculados ao aporte)
      IF NEW.transfer_date IS NOT NULL THEN
        UPDATE public.treasury_transactions
        SET date = NEW.transfer_date,
            amount = COALESCE(v_effective_amount, amount)
        WHERE reference_id = NEW.id
          AND (date IS DISTINCT FROM NEW.transfer_date OR amount IS DISTINCT FROM v_effective_amount);
      ELSIF v_effective_amount IS NOT NULL THEN
        UPDATE public.treasury_transactions
        SET amount = v_effective_amount
        WHERE reference_id = NEW.id
          AND amount IS DISTINCT FROM v_effective_amount;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_investment_transfer_date_changed ON public.investments;
CREATE TRIGGER on_investment_transfer_date_changed
  AFTER UPDATE OF transfer_date, total_value, transfer_value, quotas, unit_price ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.sync_investment_transfer_date();
