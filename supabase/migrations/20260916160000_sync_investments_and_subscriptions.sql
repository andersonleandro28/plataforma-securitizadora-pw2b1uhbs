-- Migration: 20260916160000_sync_investments_and_subscriptions.sql
-- Garante vínculo investment_id em debenture_subscriptions e sincronização bidirecional de datas, valores e status.

DO $$
BEGIN
  -- 1. Vincular debenture_subscriptions órfãs aos registros correspondentes em investments
  -- Match prioritário: mesmo series_id e mesmo CPF/CNPJ (limpo de pontuação)
  UPDATE public.debenture_subscriptions ds
  SET investment_id = i.id
  FROM public.investments i
  JOIN public.profiles p ON p.id = i.user_id
  JOIN public.investment_products ip ON ip.id = i.product_id
  WHERE ds.investment_id IS NULL
    AND ip.series_id = ds.series_id
    AND regexp_replace(COALESCE(p.document_number, ''), '\D', '', 'g') = regexp_replace(COALESCE(ds.document_number, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(p.document_number, ''), '\D', '', 'g') != '';

  -- Match secundário para eventuais remanescentes: por valor e data aproximada
  UPDATE public.debenture_subscriptions ds
  SET investment_id = i.id
  FROM public.investments i
  JOIN public.investment_products ip ON ip.id = i.product_id
  WHERE ds.investment_id IS NULL
    AND ip.series_id = ds.series_id
    AND ds.total_amount = i.total_value;

  -- 2. Alinhar datas divergentes onde investments.transfer_date está definido
  UPDATE public.debenture_subscriptions ds
  SET subscription_date = i.transfer_date
  FROM public.investments i
  WHERE ds.investment_id = i.id
    AND i.transfer_date IS NOT NULL
    AND (ds.subscription_date IS NULL OR ds.subscription_date IS DISTINCT FROM i.transfer_date);

  -- 3. Alinhar datas em investments onde transfer_date estava nula mas debenture_subscriptions tinha data
  UPDATE public.investments i
  SET transfer_date = ds.subscription_date
  FROM public.debenture_subscriptions ds
  WHERE ds.investment_id = i.id
    AND i.transfer_date IS NULL
    AND ds.subscription_date IS NOT NULL;

  -- 4. Alinhar Tesouraria
  UPDATE public.treasury_transactions tt
  SET date = i.transfer_date
  FROM public.investments i
  WHERE tt.reference_id = i.id
    AND i.transfer_date IS NOT NULL
    AND tt.date IS DISTINCT FROM i.transfer_date;
END $$;

-- 5. Atualizar função de aprovação de investimento para garantir preenchimento de investment_id e transfer_date
CREATE OR REPLACE FUNCTION public.approve_investment(p_investment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_inv RECORD;
    v_prod RECORD;
    v_target_date date;
BEGIN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
    IF v_inv.status != 'awaiting_review' THEN
        RAISE EXCEPTION 'Investment is not pending review';
    END IF;

    SELECT * INTO v_prod FROM public.investment_products WHERE id = v_inv.product_id FOR UPDATE;

    -- Increment sold quotas
    UPDATE public.investment_products 
    SET sold_quotas = COALESCE(sold_quotas, 0) + v_inv.quotas 
    WHERE id = v_inv.product_id;

    -- Define data alvo da transferência (se já preenchida no aporte, usa ela; senão data corrente)
    v_target_date := COALESCE(v_inv.transfer_date, CURRENT_DATE);

    -- Approve investment
    UPDATE public.investments 
    SET status = 'approved',
        transfer_date = v_target_date,
        updated_at = NOW() 
    WHERE id = p_investment_id;

    -- Sincronizar com debenture_subscriptions (incluindo investment_id e a data correta)
    IF v_prod.series_id IS NOT NULL THEN
        -- Verifica se já existe uma subscrição vinculada
        IF EXISTS (SELECT 1 FROM public.debenture_subscriptions WHERE investment_id = p_investment_id) THEN
            UPDATE public.debenture_subscriptions
            SET subscription_date = v_target_date,
                status = 'Ativo',
                total_amount = v_inv.total_value,
                quantity = v_inv.quotas,
                unit_price = v_inv.unit_price
            WHERE investment_id = p_investment_id;
        ELSE
            INSERT INTO public.debenture_subscriptions (
                investment_id,
                series_id,
                investor_name,
                document_number,
                quantity,
                unit_price,
                total_amount,
                subscription_date,
                status
            )
            SELECT 
                p_investment_id,
                v_prod.series_id,
                COALESCE(p.full_name, p.email, 'Investidor'),
                p.document_number,
                v_inv.quotas,
                v_inv.unit_price,
                v_inv.total_value,
                v_target_date,
                'Ativo'
            FROM public.profiles p WHERE p.id = v_inv.user_id;
        END IF;
    END IF;
END;
$function$;

-- 6. Aperfeiçoar o trigger de sincronização de investments -> debenture_subscriptions e tesouraria
CREATE OR REPLACE FUNCTION public.sync_investment_transfer_date()
RETURNS trigger AS $$
BEGIN
  -- Se transfer_date foi alterada ou se valor/cotas foram alterados
  IF NEW.transfer_date IS DISTINCT FROM OLD.transfer_date OR
     NEW.total_value IS DISTINCT FROM OLD.total_value OR
     NEW.quotas IS DISTINCT FROM OLD.quotas OR
     NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN

    -- Replicar para Subscrições vinculadas por investment_id
    UPDATE public.debenture_subscriptions
    SET subscription_date = COALESCE(NEW.transfer_date, subscription_date),
        total_amount = COALESCE(NEW.total_value, total_amount),
        quantity = COALESCE(NEW.quotas, quantity),
        unit_price = COALESCE(NEW.unit_price, unit_price)
    WHERE investment_id = NEW.id;

    -- Fallback: Se não encontrou pelo investment_id, tenta casar por series_id do produto + documento do investidor
    IF NOT FOUND THEN
      UPDATE public.debenture_subscriptions ds
      SET investment_id = NEW.id,
          subscription_date = COALESCE(NEW.transfer_date, ds.subscription_date),
          total_amount = COALESCE(NEW.total_value, ds.total_amount),
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

    -- Replicar para a Tesouraria
    IF NEW.transfer_date IS NOT NULL THEN
      UPDATE public.treasury_transactions
      SET date = NEW.transfer_date,
          amount = COALESCE(NEW.total_value, amount)
      WHERE reference_id = NEW.id
        AND (date IS DISTINCT FROM NEW.transfer_date OR amount IS DISTINCT FROM NEW.total_value);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_investment_transfer_date_changed ON public.investments;
CREATE TRIGGER on_investment_transfer_date_changed
  AFTER UPDATE OF transfer_date, total_value, quotas, unit_price ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.sync_investment_transfer_date();

-- 7. Aperfeiçoar o trigger inverso (debenture_subscriptions -> investments)
CREATE OR REPLACE FUNCTION public.sync_subscription_date_to_investment()
RETURNS trigger AS $$
BEGIN
  -- Se houver investment_id vinculado e a data ou valor mudaram
  IF NEW.investment_id IS NOT NULL AND (
    NEW.subscription_date IS DISTINCT FROM OLD.subscription_date OR
    NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
    NEW.quantity IS DISTINCT FROM OLD.quantity OR
    NEW.unit_price IS DISTINCT FROM OLD.unit_price
  ) THEN
    UPDATE public.investments
    SET transfer_date = COALESCE(NEW.subscription_date, transfer_date),
        total_value = COALESCE(NEW.total_amount, total_value),
        quotas = COALESCE(NEW.quantity, quotas),
        unit_price = COALESCE(NEW.unit_price, unit_price),
        updated_at = NOW()
    WHERE id = NEW.investment_id
      AND (
        transfer_date IS DISTINCT FROM NEW.subscription_date OR
        total_value IS DISTINCT FROM NEW.total_amount OR
        quotas IS DISTINCT FROM NEW.quantity OR
        unit_price IS DISTINCT FROM NEW.unit_price
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_date_changed ON public.debenture_subscriptions;
CREATE TRIGGER on_subscription_date_changed
  AFTER UPDATE OF subscription_date, total_amount, quantity, unit_price ON public.debenture_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_date_to_investment();
