-- Migration to integrate CCB module with Treasury automatically
-- 1. Add external_ref to treasury_transactions to idempotently track JSON array elements
ALTER TABLE public.treasury_transactions ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS treasury_transactions_external_ref_key ON public.treasury_transactions(external_ref) WHERE external_ref IS NOT NULL;

-- 2. Ensure categories exist
INSERT INTO public.transaction_categories (name, type) VALUES
  ('Aquisição de Ativos - CCB', 'out'),
  ('Recebimento de Parcelas - CCB', 'in')
ON CONFLICT (name) DO NOTHING;

-- 3. Trigger for recebiveis_ccb (Registro de Aquisição / Saída de Caixa)
CREATE OR REPLACE FUNCTION public.sync_recebiveis_to_treasury()
RETURNS trigger AS $BODY$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_desc TEXT;
BEGIN
  -- Get category ID
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Aquisição de Ativos - CCB' LIMIT 1;

  -- Resolve borrower name
  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome FROM public.profiles WHERE id = NEW.tomador_id;
  
  -- Format description
  v_desc := 'Aquisição de CCB nº ' || substr(NEW.ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
    VALUES ('out', NEW.acquisition_value, COALESCE(NEW.created_at, NOW())::date, v_desc, 'Aquisição de Ativos - CCB', v_cat_id, NEW.id, true, 'acq-' || NEW.id)
    ON CONFLICT (external_ref) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.treasury_transactions 
    SET amount = NEW.acquisition_value, date = COALESCE(NEW.created_at, NOW())::date, description = v_desc
    WHERE external_ref = 'acq-' || NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = 'acq-' || OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_recebiveis_ccb_change ON public.recebiveis_ccb;
CREATE TRIGGER on_recebiveis_ccb_change
AFTER INSERT OR UPDATE OR DELETE ON public.recebiveis_ccb
FOR EACH ROW EXECUTE FUNCTION public.sync_recebiveis_to_treasury();

-- 4. Trigger for operacoes_antecipacao (Registro de Recebimento de Parcelas / Entrada de Caixa)
CREATE OR REPLACE FUNCTION public.sync_ccb_installments_to_treasury()
RETURNS trigger AS $BODY$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_inst JSONB;
  v_ext_ref TEXT;
  v_desc TEXT;
  v_ccb_id UUID;
BEGIN
  -- Get category ID
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  -- Resolve CCB details and borrower name
  SELECT c.id, COALESCE(p.pj_company_name, p.full_name, 'Desconhecido') 
  INTO v_ccb_id, v_tomador_nome 
  FROM public.ccb_solicitacoes c 
  LEFT JOIN public.profiles p ON p.id = c.user_id 
  WHERE c.id = NEW.ccb_id;

  -- Iterate over JSON installments
  IF NEW.installments IS NOT NULL THEN
    FOR v_inst IN SELECT * FROM jsonb_array_elements(NEW.installments)
    LOOP
      v_ext_ref := 'inst-' || (v_inst->>'id');
      
      IF v_inst->>'status' = 'paga' THEN
        v_desc := 'Recebimento Parcela ' || (v_inst->>'number') || ' - CCB nº ' || substr(v_ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        -- Upsert entry to treasury
        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
        VALUES ('in', (v_inst->>'value')::numeric, COALESCE((v_inst->>'payment_date')::date, NOW()::date), v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref)
        ON CONFLICT (external_ref) DO UPDATE 
        SET amount = EXCLUDED.amount, date = EXCLUDED.date, description = EXCLUDED.description;
      ELSE
        -- Automatically remove or cancel entry if not 'paga' anymore (handles estornos/reversals)
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_operacoes_antecipacao_change ON public.operacoes_antecipacao;
CREATE TRIGGER on_operacoes_antecipacao_change
AFTER INSERT OR UPDATE ON public.operacoes_antecipacao
FOR EACH ROW EXECUTE FUNCTION public.sync_ccb_installments_to_treasury();
