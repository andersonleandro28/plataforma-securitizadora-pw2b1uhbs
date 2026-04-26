-- 1. Create the trigger function to sync dates
CREATE OR REPLACE FUNCTION public.sync_subscription_date_to_investment()
RETURNS trigger
AS $$
BEGIN
  IF NEW.investment_id IS NOT NULL AND NEW.subscription_date IS DISTINCT FROM OLD.subscription_date THEN
    -- Update the investment transfer_date
    UPDATE public.investments
    SET transfer_date = NEW.subscription_date,
        updated_at = NOW()
    WHERE id = NEW.investment_id
      AND transfer_date IS DISTINCT FROM NEW.subscription_date;

    -- Log the automatic sync
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
      'investments',
      NEW.investment_id,
      'auto_sync_transfer_date',
      auth.uid(),
      jsonb_build_object(
        'message', 'Data de transferência sincronizada automaticamente a partir da subscrição.',
        'old_date', OLD.subscription_date,
        'new_date', NEW.subscription_date,
        'source_subscription_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop if exists and create trigger
DROP TRIGGER IF EXISTS on_subscription_date_changed ON public.debenture_subscriptions;
CREATE TRIGGER on_subscription_date_changed
  AFTER UPDATE OF subscription_date ON public.debenture_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subscription_date_to_investment();

-- 3. Sanitization (Corrective Sweep)
DO $$
DECLARE
  rec RECORD;
  affected_count INT := 0;
BEGIN
  FOR rec IN 
    SELECT s.id as sub_id, s.investment_id, s.subscription_date, i.transfer_date 
    FROM public.debenture_subscriptions s
    JOIN public.investments i ON s.investment_id = i.id
    WHERE s.subscription_date IS NOT NULL 
      AND s.subscription_date IS DISTINCT FROM i.transfer_date
  LOOP
    -- Update the investment
    UPDATE public.investments
    SET transfer_date = rec.subscription_date,
        updated_at = NOW()
    WHERE id = rec.investment_id;

    -- Log the sanitization
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
      'investments',
      rec.investment_id,
      'sanitization_sync_transfer_date',
      NULL,
      jsonb_build_object(
        'message', 'Saneamento: Data de transferência corrigida para coincidir com a data da subscrição.',
        'old_transfer_date', rec.transfer_date,
        'new_transfer_date', rec.subscription_date,
        'source_subscription_id', rec.sub_id
      )
    );
    
    affected_count := affected_count + 1;
  END LOOP;
END $$;
