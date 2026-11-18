-- Permitir que o ADMINISTRADOR solicite um resgate para um cliente (investidor),
-- informando os dados bancários de depósito no momento do pedido.
-- Reutiliza a tabela existente public.investment_redemptions (não cria entidade nova).

-- 1) Colunas de dados bancários + origem do pedido
ALTER TABLE public.investment_redemptions
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text
    CHECK (bank_account_type IS NULL OR bank_account_type IN ('corrente', 'poupanca')),
  ADD COLUMN IF NOT EXISTS bank_holder_name text,
  ADD COLUMN IF NOT EXISTS bank_holder_document text,
  ADD COLUMN IF NOT EXISTS requested_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 2) RLS: política específica de inserção por admin/staff
DROP POLICY IF EXISTS admin_insert_redemption_for_client ON public.investment_redemptions;
CREATE POLICY admin_insert_redemption_for_client
  ON public.investment_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 3) Validação de saldo no backend: impede que o resgate (cotas solicitadas,
--    somadas às já pendentes/aprovadas do mesmo investimento) exceda as cotas disponíveis.
CREATE OR REPLACE FUNCTION public.validate_redemption_quota_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quota_count INTEGER;
  v_investment RECORD;
  v_pending INTEGER;
  v_available INTEGER;
BEGIN
  -- Só valida resgates de principal (cotas > 0)
  IF NEW.requested_quotas IS NULL OR NEW.requested_quotas <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.investment_id IS NULL THEN
    RAISE EXCEPTION 'Resgate sem investimento vinculado.';
  END IF;

  SELECT * INTO v_investment FROM public.investments WHERE id = NEW.investment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento vinculado não encontrado (%).', NEW.investment_id;
  END IF;

  IF COALESCE(v_investment.status, 'aprovado') NOT IN ('aprovado', 'approved') THEN
    RAISE EXCEPTION 'Investimento não está ativo (status: %). Resgate só é permitido em investimentos aprovados.', v_investment.status;
  END IF;

  SELECT COALESCE(SUM(requested_quotas), 0)
    INTO v_pending
    FROM public.investment_redemptions
   WHERE investment_id = NEW.investment_id
     AND status IN ('pending', 'approved')
     AND id IS DISTINCT FROM NEW.id;

  v_quota_count := COALESCE(v_investment.quotas, 0);
  v_available := v_quota_count - COALESCE(v_investment.redeemed_quotas, 0) - v_pending;

  IF NEW.requested_quotas > v_available THEN
    RAISE EXCEPTION 'Saldo insuficiente: solicitação de % cota(s), disponível % cota(s) no investimento.', NEW.requested_quotas, v_available;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_redemption_quota_limit ON public.investment_redemptions;
CREATE TRIGGER trg_validate_redemption_quota_limit
  BEFORE INSERT ON public.investment_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_redemption_quota_limit();
