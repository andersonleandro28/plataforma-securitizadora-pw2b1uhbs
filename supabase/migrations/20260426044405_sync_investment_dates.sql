DO $$
BEGIN
  -- Varredura corretiva: Sincroniza datas divergentes usando a data da aprovação (investments) como soberana
  UPDATE public.debenture_subscriptions ds
  SET subscription_date = i.transfer_date
  FROM public.investments i
  WHERE ds.investment_id = i.id
    AND i.transfer_date IS NOT NULL
    AND ds.subscription_date IS DISTINCT FROM i.transfer_date;

  -- Sincroniza tesouraria também, se aplicável
  UPDATE public.treasury_transactions tt
  SET date = i.transfer_date
  FROM public.investments i
  WHERE tt.reference_id = i.id
    AND (tt.category = 'Investimento' OR tt.category = 'Resgates e Rendimentos')
    AND i.transfer_date IS NOT NULL
    AND tt.date IS DISTINCT FROM i.transfer_date;
END $$;

-- Trigger para atualizar em cascata (Investimentos -> Subscrições & Tesouraria)
CREATE OR REPLACE FUNCTION public.sync_investment_transfer_date()
RETURNS trigger AS $$
BEGIN
  IF NEW.transfer_date IS NOT NULL AND NEW.transfer_date IS DISTINCT FROM OLD.transfer_date THEN
    -- Replicar para Subscrições (Gerenciar Subscrições / Dashboard do Investidor)
    UPDATE public.debenture_subscriptions
    SET subscription_date = NEW.transfer_date
    WHERE investment_id = NEW.id
      AND subscription_date IS DISTINCT FROM NEW.transfer_date;

    -- Replicar para a Tesouraria
    UPDATE public.treasury_transactions
    SET date = NEW.transfer_date
    WHERE reference_id = NEW.id
      AND date IS DISTINCT FROM NEW.transfer_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_investment_transfer_date_changed ON public.investments;
CREATE TRIGGER on_investment_transfer_date_changed
  AFTER UPDATE OF transfer_date ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.sync_investment_transfer_date();
