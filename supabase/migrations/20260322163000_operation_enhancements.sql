-- Update global financial parameters with requested default IOF rates
UPDATE public.financial_parameters
SET 
  iof_fixed_rate = 0.38,
  iof_daily_rate = 0.0041
WHERE receivable_type = 'global';

-- Create Edge Function trigger for email notifications on status change
CREATE OR REPLACE FUNCTION public.invoke_operation_email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  req_id bigint;
BEGIN
  -- Invokes the edge function. Fails silently if net extension is unavailable.
  SELECT net.http_post(
      url := 'https://misoqvscsydxqcsfjaux.supabase.co/functions/v1/send-operation-email',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD))
  ) INTO req_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_operation_status_change_email ON public.credit_operations;
CREATE TRIGGER on_operation_status_change_email
  AFTER UPDATE ON public.credit_operations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.invoke_operation_email_notification();
