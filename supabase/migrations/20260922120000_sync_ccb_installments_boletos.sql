-- Migração para sincronizar recebiveis_ccb (boletos) e operacoes_antecipacao (installments)
-- Prioridade máxima: data real (due_date) e status de pagamento do BOLETO em recebiveis_ccb
-- Preserva valores adicionais (juros/multas/prorrogações) e NÃO gera novas movimentações contábeis

-- 1. Desativar a duplicação em treasury_transactions de sync_ccb_installments_to_treasury se o recebivel_ccb já existir para a CCB
CREATE OR REPLACE FUNCTION public.sync_ccb_installments_to_treasury()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_inst JSONB;
  v_ext_ref TEXT;
  v_desc TEXT;
  v_ccb_id UUID;
  v_has_recebivel BOOLEAN := FALSE;
BEGIN
  -- Se já existir registro em recebiveis_ccb para esta CCB, a tesouraria é gerida via recebiveis_ccb (evita duplicação)
  SELECT EXISTS (SELECT 1 FROM public.recebiveis_ccb WHERE ccb_id = NEW.ccb_id) INTO v_has_recebivel;
  IF v_has_recebivel THEN
    -- Limpa quaisquer registros legados inst-% para esta operação se houverem
    IF NEW.installments IS NOT NULL THEN
      FOR v_inst IN SELECT * FROM jsonb_array_elements(NEW.installments)
      LOOP
        v_ext_ref := 'inst-' || (v_inst->>'id');
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  -- Se não existir recebiveis_ccb, mantém comportamento legado
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  SELECT c.id, COALESCE(p.pj_company_name, p.full_name, 'Desconhecido') 
  INTO v_ccb_id, v_tomador_nome 
  FROM public.ccb_solicitacoes c 
  LEFT JOIN public.profiles p ON p.id = c.user_id 
  WHERE c.id = NEW.ccb_id;

  IF NEW.installments IS NOT NULL THEN
    FOR v_inst IN SELECT * FROM jsonb_array_elements(NEW.installments)
    LOOP
      v_ext_ref := 'inst-' || (v_inst->>'id');
      
      IF v_inst->>'status' = 'paga' THEN
        v_desc := 'Recebimento Parcela ' || (v_inst->>'number') || ' - CCB nº ' || substr(v_ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
        VALUES ('in', (v_inst->>'value')::numeric, COALESCE((v_inst->>'payment_date')::date, NOW()::date), v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref)
        ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
        SET amount = EXCLUDED.amount, date = EXCLUDED.date, description = EXCLUDED.description;
      ELSE
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Função para espelhar boletos de recebiveis_ccb em operacoes_antecipacao.installments
CREATE OR REPLACE FUNCTION public.sync_recebiveis_boletos_to_operacoes_antecipacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op RECORD;
  v_new_insts JSONB := '[]'::jsonb;
  v_old_insts JSONB;
  v_old_inst JSONB;
  v_boleto JSONB;
  v_idx INT := 0;
  v_due_date TEXT;
  v_status_boleto TEXT;
  v_stat_inst TEXT;
  v_val NUMERIC;
  v_inst_id TEXT;
  v_pay_date TEXT;
  v_data_pgto TEXT;
  v_interest NUMERIC;
  v_penalty NUMERIC;
  v_boleto_url TEXT;
  v_receipt_url TEXT;
  v_extended_due_date TEXT;
  v_extended_fee NUMERIC;
  v_extended_at TEXT;
  v_item JSONB;
BEGIN
  IF NEW.ccb_id IS NULL OR NEW.boletos IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_op FROM public.operacoes_antecipacao WHERE ccb_id = NEW.ccb_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_old_insts := COALESCE(v_op.installments, '[]'::jsonb);

  FOR v_idx IN 0..(jsonb_array_length(NEW.boletos) - 1)
  LOOP
    v_boleto := NEW.boletos->v_idx;
    
    IF jsonb_array_length(v_old_insts) > v_idx THEN
      v_old_inst := v_old_insts->v_idx;
    ELSE
      v_old_inst := NULL;
    END IF;

    -- ID único estável da parcela
    v_inst_id := COALESCE(v_old_inst->>'id', gen_random_uuid()::text);

    -- Vencimento real da aba Compras CCB BDIGITAL (recebiveis_ccb.boletos)
    v_due_date := COALESCE(v_boleto->>'due_date', v_old_inst->>'due_date');

    -- Valor
    v_val := COALESCE(
      (v_boleto->>'unit_value')::numeric,
      (v_old_inst->>'value')::numeric,
      (NEW.acquisition_value / NULLIF(jsonb_array_length(NEW.boletos), 0))::numeric
    );

    -- Status do boleto
    v_status_boleto := LOWER(COALESCE(v_boleto->>'status', ''));
    IF v_status_boleto IN ('pago', 'liquidado') THEN
      v_stat_inst := 'paga';
    ELSIF v_status_boleto IN ('prorrogada', 'prorrogado') THEN
      v_stat_inst := 'prorrogada';
    ELSIF v_status_boleto IN ('vencida', 'vencido') THEN
      v_stat_inst := 'vencida';
    ELSE
      v_stat_inst := 'aberta';
    END IF;

    -- Datas de pagamento
    v_pay_date := COALESCE(v_boleto->>'payment_date', v_boleto->>'data_pagamento', v_old_inst->>'payment_date', v_old_inst->>'data_pagamento');
    v_data_pgto := COALESCE(v_boleto->>'data_pagamento', v_boleto->>'payment_date', v_old_inst->>'data_pagamento', v_old_inst->>'payment_date');

    -- Juros e Multas
    v_interest := COALESCE((v_boleto->>'interest_applied')::numeric, (v_old_inst->>'interest_applied')::numeric, 0);
    v_penalty := COALESCE((v_boleto->>'penalty_applied')::numeric, (v_old_inst->>'penalty_applied')::numeric, 0);

    -- Arquivos e URLs
    v_boleto_url := COALESCE(v_boleto->>'file_url', v_old_inst->>'boleto_url');
    v_receipt_url := v_old_inst->>'receipt_url';

    -- Prorrogações existentes preservadas
    v_extended_due_date := COALESCE(v_boleto->>'extended_due_date', v_old_inst->>'extended_due_date');
    v_extended_fee := COALESCE((v_boleto->>'extended_fee')::numeric, (v_old_inst->>'extended_fee')::numeric);
    v_extended_at := COALESCE(v_boleto->>'extended_at', v_old_inst->>'extended_at');

    v_item := jsonb_build_object(
      'id', v_inst_id,
      'number', v_idx + 1,
      'due_date', v_due_date,
      'value', v_val,
      'status', v_stat_inst
    );

    IF v_stat_inst = 'paga' THEN
      v_item := v_item || jsonb_build_object(
        'payment_date', v_pay_date,
        'data_pagamento', v_data_pgto,
        'interest_applied', v_interest,
        'penalty_applied', v_penalty
      );
    END IF;

    IF v_boleto_url IS NOT NULL THEN
      v_item := v_item || jsonb_build_object('boleto_url', v_boleto_url);
    END IF;

    IF v_receipt_url IS NOT NULL THEN
      v_item := v_item || jsonb_build_object('receipt_url', v_receipt_url);
    END IF;

    IF v_extended_due_date IS NOT NULL THEN
      v_item := v_item || jsonb_build_object(
        'extended_due_date', v_extended_due_date,
        'extended_fee', v_extended_fee,
        'extended_at', v_extended_at
      );
    END IF;

    v_new_insts := v_new_insts || jsonb_build_array(v_item);
  END LOOP;

  UPDATE public.operacoes_antecipacao
  SET installments = v_new_insts,
      updated_at = NOW()
  WHERE id = v_op.id
    AND installments IS DISTINCT FROM v_new_insts;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_recebiveis_boletos_to_antecipacao ON public.recebiveis_ccb;
CREATE TRIGGER trg_sync_recebiveis_boletos_to_antecipacao
AFTER INSERT OR UPDATE OF boletos ON public.recebiveis_ccb
FOR EACH ROW
EXECUTE FUNCTION public.sync_recebiveis_boletos_to_operacoes_antecipacao();

-- 3. Função para caso haja alteração de installments em operacoes_antecipacao
CREATE OR REPLACE FUNCTION public.sync_operacoes_antecipacao_to_recebiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_new_boletos JSONB := '[]'::jsonb;
  v_old_boletos JSONB;
  v_old_boleto JSONB;
  v_inst JSONB;
  v_idx INT := 0;
  v_status_inst TEXT;
  v_status_boleto TEXT;
  v_due_date TEXT;
  v_item JSONB;
BEGIN
  IF NEW.ccb_id IS NULL OR NEW.installments IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rec FROM public.recebiveis_ccb WHERE ccb_id = NEW.ccb_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_old_boletos := COALESCE(v_rec.boletos, '[]'::jsonb);

  FOR v_idx IN 0..(jsonb_array_length(NEW.installments) - 1)
  LOOP
    v_inst := NEW.installments->v_idx;
    IF jsonb_array_length(v_old_boletos) > v_idx THEN
      v_old_boleto := v_old_boletos->v_idx;
    ELSE
      v_old_boleto := jsonb_build_object();
    END IF;

    -- Prioriza expressamente o due_date real que já estiver no boleto da recebiveis_ccb
    v_due_date := COALESCE(v_old_boleto->>'due_date', v_inst->>'due_date');

    v_status_inst := LOWER(COALESCE(v_inst->>'status', ''));
    IF v_status_inst = 'paga' THEN
      v_status_boleto := 'Pago';
    ELSIF v_status_inst = 'prorrogada' THEN
      v_status_boleto := 'Prorrogada';
    ELSIF v_status_inst = 'vencida' THEN
      v_status_boleto := 'Vencida';
    ELSE
      IF LOWER(COALESCE(v_old_boleto->>'status', '')) IN ('pago', 'liquidado') AND v_status_inst = 'aberta' THEN
        v_status_boleto := 'Pendente';
      ELSE
        v_status_boleto := COALESCE(v_old_boleto->>'status', 'Pendente');
      END IF;
    END IF;

    v_item := v_old_boleto || jsonb_build_object(
      'due_date', v_due_date,
      'unit_value', COALESCE((v_old_boleto->>'unit_value')::numeric, (v_inst->>'value')::numeric),
      'status', v_status_boleto
    );

    IF v_status_boleto = 'Pago' THEN
      v_item := v_item || jsonb_build_object(
        'payment_date', COALESCE(v_old_boleto->>'payment_date', v_old_boleto->>'data_pagamento', v_inst->>'payment_date', v_inst->>'data_pagamento'),
        'data_pagamento', COALESCE(v_old_boleto->>'data_pagamento', v_old_boleto->>'payment_date', v_inst->>'data_pagamento', v_inst->>'payment_date'),
        'interest_applied', COALESCE((v_old_boleto->>'interest_applied')::numeric, (v_inst->>'interest_applied')::numeric, 0),
        'penalty_applied', COALESCE((v_old_boleto->>'penalty_applied')::numeric, (v_inst->>'penalty_applied')::numeric, 0)
      );
    ELSIF v_status_boleto = 'Pendente' THEN
      v_item := v_item - 'payment_date' - 'data_pagamento' - 'data_liquidacao' - 'interest_applied' - 'penalty_applied';
    END IF;

    IF v_inst->>'receipt_url' IS NOT NULL THEN
      v_item := v_item || jsonb_build_object('receipt_url', v_inst->>'receipt_url');
    END IF;

    v_new_boletos := v_new_boletos || jsonb_build_array(v_item);
  END LOOP;

  UPDATE public.recebiveis_ccb
  SET boletos = v_new_boletos
  WHERE id = v_rec.id
    AND boletos IS DISTINCT FROM v_new_boletos;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_operacoes_antecipacao_to_recebiveis ON public.operacoes_antecipacao;
CREATE TRIGGER trg_sync_operacoes_antecipacao_to_recebiveis
AFTER UPDATE OF installments ON public.operacoes_antecipacao
FOR EACH ROW
EXECUTE FUNCTION public.sync_operacoes_antecipacao_to_recebiveis();

-- 4. Migração de Backfill: Alinha todos os 6 contratos existentes imediatamente
DO $$
DECLARE
  rec RECORD;
  v_op RECORD;
  v_new_insts JSONB;
  v_old_insts JSONB;
  v_old_inst JSONB;
  v_boleto JSONB;
  v_idx INT;
  v_due_date TEXT;
  v_status_boleto TEXT;
  v_stat_inst TEXT;
  v_val NUMERIC;
  v_inst_id TEXT;
  v_pay_date TEXT;
  v_data_pgto TEXT;
  v_interest NUMERIC;
  v_penalty NUMERIC;
  v_boleto_url TEXT;
  v_receipt_url TEXT;
  v_item JSONB;
BEGIN
  FOR rec IN SELECT * FROM public.recebiveis_ccb WHERE boletos IS NOT NULL AND jsonb_array_length(boletos) > 0
  LOOP
    SELECT * INTO v_op FROM public.operacoes_antecipacao WHERE ccb_id = rec.ccb_id;
    IF FOUND THEN
      v_new_insts := '[]'::jsonb;
      v_old_insts := COALESCE(v_op.installments, '[]'::jsonb);

      FOR v_idx IN 0..(jsonb_array_length(rec.boletos) - 1)
      LOOP
        v_boleto := rec.boletos->v_idx;

        IF jsonb_array_length(v_old_insts) > v_idx THEN
          v_old_inst := v_old_insts->v_idx;
        ELSE
          v_old_inst := NULL;
        END IF;

        v_inst_id := COALESCE(v_old_inst->>'id', gen_random_uuid()::text);
        v_due_date := COALESCE(v_boleto->>'due_date', v_old_inst->>'due_date');
        v_val := COALESCE((v_boleto->>'unit_value')::numeric, (v_old_inst->>'value')::numeric);

        v_status_boleto := LOWER(COALESCE(v_boleto->>'status', ''));
        IF v_status_boleto IN ('pago', 'liquidado') THEN
          v_stat_inst := 'paga';
        ELSIF v_status_boleto IN ('prorrogada', 'prorrogado') THEN
          v_stat_inst := 'prorrogada';
        ELSIF v_status_boleto IN ('vencida', 'vencido') THEN
          v_stat_inst := 'vencida';
        ELSE
          v_stat_inst := 'aberta';
        END IF;

        v_pay_date := COALESCE(v_boleto->>'payment_date', v_boleto->>'data_pagamento', v_old_inst->>'payment_date');
        v_data_pgto := COALESCE(v_boleto->>'data_pagamento', v_boleto->>'payment_date', v_old_inst->>'data_pagamento');
        v_interest := COALESCE((v_boleto->>'interest_applied')::numeric, 0);
        v_penalty := COALESCE((v_boleto->>'penalty_applied')::numeric, 0);
        v_boleto_url := COALESCE(v_boleto->>'file_url', v_old_inst->>'boleto_url');
        v_receipt_url := v_old_inst->>'receipt_url';

        v_item := jsonb_build_object(
          'id', v_inst_id,
          'number', v_idx + 1,
          'due_date', v_due_date,
          'value', v_val,
          'status', v_stat_inst
        );

        IF v_stat_inst = 'paga' THEN
          v_item := v_item || jsonb_build_object(
            'payment_date', v_pay_date,
            'data_pagamento', v_data_pgto,
            'interest_applied', v_interest,
            'penalty_applied', v_penalty
          );
        END IF;

        IF v_boleto_url IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('boleto_url', v_boleto_url);
        END IF;

        IF v_receipt_url IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('receipt_url', v_receipt_url);
        END IF;

        v_new_insts := v_new_insts || jsonb_build_array(v_item);
      END LOOP;

      UPDATE public.operacoes_antecipacao
      SET installments = v_new_insts,
          updated_at = NOW()
      WHERE id = v_op.id;
    END IF;
  END LOOP;
END $$;
