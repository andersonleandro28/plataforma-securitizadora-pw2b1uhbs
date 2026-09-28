-- Migration: Trigger de invalidação de cache de contratos de debêntures
-- Ao atualizar dados da escritura (numero_escritura, orgao_registro, data_registro, numero_arquivamento),
-- invalida o contract_url dos investimentos correspondentes (ou atualiza updated_at) para que a próxima
-- visualização ou download gere com os dados mais recentes.

CREATE OR REPLACE FUNCTION public.invalidate_debenture_contracts_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Se qualquer dado da escritura ou registro foi alterado
  IF (OLD.numero_escritura IS DISTINCT FROM NEW.numero_escritura OR
      OLD.numero_emissao IS DISTINCT FROM NEW.numero_emissao OR
      OLD.orgao_registro IS DISTINCT FROM NEW.orgao_registro OR
      OLD.data_registro IS DISTINCT FROM NEW.data_registro OR
      OLD.numero_arquivamento IS DISTINCT FROM NEW.numero_arquivamento) THEN

    -- Opcionalmente reseta o contract_url para NULL nos investimentos vinculados
    -- garantindo que qualquer clique em "Ver Contrato" force a regeneração com os dados novos
    UPDATE public.investments inv
    SET contract_url = NULL,
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

DROP TRIGGER IF EXISTS trigger_invalidate_debenture_contracts ON public.debentures;

CREATE TRIGGER trigger_invalidate_debenture_contracts
AFTER UPDATE ON public.debentures
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_debenture_contracts_cache();
