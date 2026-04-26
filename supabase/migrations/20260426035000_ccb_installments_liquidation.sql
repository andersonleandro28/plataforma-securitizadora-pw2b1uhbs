DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Recebimento de Parcelas - CCB', 'in');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_ccb_boletos_to_treasury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_boleto JSONB;
  v_ext_ref TEXT;
  v_desc TEXT;
  idx INT := 1;
  v_total NUMERIC;
BEGIN
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome FROM public.profiles WHERE id = NEW.tomador_id;

  IF NEW.boletos IS NOT NULL THEN
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(NEW.boletos)
    LOOP
      v_ext_ref := 'ccb-bol-' || NEW.id || '-' || idx;
      
      IF v_boleto->>'status' = 'Pago' THEN
        v_total := (COALESCE((v_boleto->>'unit_value')::numeric, 0) + COALESCE((v_boleto->>'interest_applied')::numeric, 0) + COALESCE((v_boleto->>'penalty_applied')::numeric, 0));
        v_desc := 'Recebimento Parcela ' || idx || ' - CCB nº ' || substr(NEW.ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
        VALUES ('in', v_total, COALESCE((v_boleto->>'payment_date')::date, NOW()::date), v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref)
        ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
        SET amount = EXCLUDED.amount, date = EXCLUDED.date, description = EXCLUDED.description;
      ELSE
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END IF;
      idx := idx + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_recebiveis_ccb_boletos_change ON public.recebiveis_ccb;
CREATE TRIGGER on_recebiveis_ccb_boletos_change
  AFTER UPDATE OF boletos ON public.recebiveis_ccb
  FOR EACH ROW EXECUTE FUNCTION public.sync_ccb_boletos_to_treasury();
