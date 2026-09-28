-- Migration: Adiciona cautela_url na tabela investments e atualiza trigger de invalidação
-- Migration: 20260928150000_add_cautela_to_investments.sql

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS cautela_url TEXT;

-- Atualizar a view investments_view para incluir cautela_url
CREATE OR REPLACE VIEW public.investments_view AS
SELECT * FROM public.investments WHERE user_id = auth.uid();

GRANT SELECT ON public.investments_view TO authenticated;

-- Atualizar a função de invalidação de contratos para também invalidar cautela_url
CREATE OR REPLACE FUNCTION public.invalidate_debenture_contracts_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Se qualquer dado da escritura ou registro foi alterado
  IF (OLD.numero_escritura IS DISTINCT FROM NEW.numero_escritura OR
      OLD.numero_emissao IS DISTINCT FROM NEW.numero_emissao OR
      OLD.orgao_registro IS DISTINCT FROM NEW.orgao_registro OR
      OLD.data_registro IS DISTINCT FROM NEW.data_registro OR
      OLD.numero_arquivamento IS DISTINCT FROM NEW.numero_arquivamento) THEN

    -- Reseta contract_url e cautela_url para NULL nos investimentos vinculados
    -- garantindo que qualquer visualização ou download force a regeneração com os dados novos
    UPDATE public.investments inv
    SET contract_url = NULL,
        cautela_url = NULL,
        updated_at = NOW()
    WHERE inv.product_id IN (
      SELECT p.id 
      FROM public.investment_products p
      JOIN public.debenture_series s ON p.series_id = s.id
      WHERE s.debenture_id = NEW.id
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reassocia o trigger
DROP TRIGGER IF EXISTS trigger_invalidate_debenture_contracts ON public.debentures;

CREATE TRIGGER trigger_invalidate_debenture_contracts
AFTER UPDATE ON public.debentures
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_debenture_contracts_cache();
