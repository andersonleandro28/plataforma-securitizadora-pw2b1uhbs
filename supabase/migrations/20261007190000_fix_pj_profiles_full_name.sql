-- Saneamento de profiles com full_name em branco e razão social presente
UPDATE public.profiles
SET full_name = COALESCE(NULLIF(trim(full_name), ''), pj_company_name, pj_trade_name)
WHERE (full_name IS NULL OR trim(full_name) = '')
  AND (pj_company_name IS NOT NULL OR pj_trade_name IS NOT NULL);

-- Função trigger para garantir que ao inserir ou atualizar profiles PJ sem full_name preenchido,
-- o full_name receba automaticamente pj_company_name (ou pj_trade_name)
CREATE OR REPLACE FUNCTION public.handle_profile_pj_fullname_fallback()
RETURNS trigger AS $$
BEGIN
  IF (NEW.entity_type = 'pj' OR (NEW.entity_type IS NULL AND NEW.pj_company_name IS NOT NULL)) THEN
    IF (NEW.full_name IS NULL OR trim(NEW.full_name) = '') THEN
      NEW.full_name := COALESCE(NULLIF(trim(NEW.pj_company_name), ''), NULLIF(trim(NEW.pj_trade_name), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_pj_full_name ON public.profiles;
CREATE TRIGGER trigger_ensure_pj_full_name
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_pj_fullname_fallback();
