-- Migração para correção de inconsistência no DRE de Maio/2026
-- 1. Sincroniza payment_date com data_pagamento nos recebíveis CCB onde divergirem
-- 2. Atualiza sync_ccb_boletos_to_treasury() para priorizar data_pagamento e não sobrescrever com data incorreta
-- 3. Corrige as datas das transações de tesouraria de external_ref ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-{1..9}
--    e quaisquer transações vinculadas a boletos corrigidos
-- 4. Corrige eventuais movimentacoes_caixa correspondentes

-- 1. Atualizar a função de sincronização do trigger para garantir que use data_pagamento ou payment_date real
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
  v_status TEXT;
  v_effective_date DATE;
BEGIN
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome FROM public.profiles WHERE id = NEW.tomador_id;

  IF NEW.boletos IS NOT NULL THEN
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(NEW.boletos)
    LOOP
      v_ext_ref := 'ccb-bol-' || NEW.id || '-' || idx;
      v_status := LOWER(COALESCE(v_boleto->>'status', ''));
      
      IF v_status IN ('pago', 'liquidado') THEN
        v_total := (COALESCE((v_boleto->>'unit_value')::numeric, 0) + COALESCE((v_boleto->>'interest_applied')::numeric, 0) + COALESCE((v_boleto->>'penalty_applied')::numeric, 0));
        v_desc := 'Recebimento Parcela ' || idx || ' - CCB nº ' || substr(NEW.ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        -- Prioriza data_pagamento real sobre payment_date ou due_date
        v_effective_date := COALESCE(
          NULLIF(v_boleto->>'data_pagamento', '')::date,
          NULLIF(v_boleto->>'payment_date', '')::date,
          NULLIF(v_boleto->>'due_date', '')::date,
          NOW()::date
        );

        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref)
        VALUES ('in', v_total, v_effective_date, v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref)
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

-- 2. Bloco DO para corrigir boletos no JSONB de recebiveis_ccb e atualizar treasury_transactions
DO $$
DECLARE
  rec RECORD;
  v_boleto JSONB;
  v_new_boletos JSONB;
  v_changed BOOLEAN;
  v_data_pgto TEXT;
  v_pay_date TEXT;
  v_idx INT;
  v_ext_ref TEXT;
BEGIN
  -- Percorre todos os recebíveis de CCB
  FOR rec IN SELECT id, ccb_id, boletos FROM public.recebiveis_ccb WHERE boletos IS NOT NULL AND jsonb_array_length(boletos) > 0
  LOOP
    v_new_boletos := '[]'::jsonb;
    v_changed := FALSE;
    v_idx := 1;

    FOR v_boleto IN SELECT * FROM jsonb_array_elements(rec.boletos)
    LOOP
      v_data_pgto := NULLIF(v_boleto->>'data_pagamento', '');
      v_pay_date := NULLIF(v_boleto->>'payment_date', '');

      -- Se houver data_pagamento e payment_date divergir, sincroniza payment_date = data_pagamento
      IF v_data_pgto IS NOT NULL AND (v_pay_date IS NULL OR v_pay_date <> v_data_pgto) THEN
        v_boleto := jsonb_set(v_boleto, '{payment_date}', to_jsonb(v_data_pgto));
        v_changed := TRUE;
      -- Se houver payment_date mas não data_pagamento, sincroniza data_pagamento = payment_date
      ELSIF v_pay_date IS NOT NULL AND v_data_pgto IS NULL THEN
        v_boleto := jsonb_set(v_boleto, '{data_pagamento}', to_jsonb(v_pay_date));
        v_changed := TRUE;
      END IF;

      v_new_boletos := v_new_boletos || jsonb_build_array(v_boleto);
      v_idx := v_idx + 1;
    END LOOP;

    -- Se o array de boletos foi modificado, faz o UPDATE (que aciona o trigger sync_ccb_boletos_to_treasury)
    IF v_changed THEN
      UPDATE public.recebiveis_ccb
      SET boletos = v_new_boletos
      WHERE id = rec.id;
    END IF;
  END LOOP;

  -- 3. Garantia explícita: atualizar diretamente treasury_transactions dos boletos da CCB de Osvaldir Pereira
  -- Parcela 1: 2025-08-21
  UPDATE public.treasury_transactions
  SET date = '2025-08-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-1';

  -- Parcela 2: 2025-09-21
  UPDATE public.treasury_transactions
  SET date = '2025-09-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-2';

  -- Parcela 3: 2025-10-21
  UPDATE public.treasury_transactions
  SET date = '2025-10-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-3';

  -- Parcela 4: 2025-11-21
  UPDATE public.treasury_transactions
  SET date = '2025-11-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-4';

  -- Parcela 5: 2025-12-21
  UPDATE public.treasury_transactions
  SET date = '2025-12-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-5';

  -- Parcela 6: 2026-01-21
  UPDATE public.treasury_transactions
  SET date = '2026-01-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-6';

  -- Parcela 7: 2026-02-21
  UPDATE public.treasury_transactions
  SET date = '2026-02-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-7';

  -- Parcela 8: 2026-03-21
  UPDATE public.treasury_transactions
  SET date = '2026-03-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-8';

  -- Parcela 9: 2026-04-21
  UPDATE public.treasury_transactions
  SET date = '2026-04-21'
  WHERE external_ref = 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-9';

  -- 4. Alinhar eventuais movimentacoes_caixa caso existam ou venham a ser criadas
  UPDATE public.movimentacoes_caixa
  SET created_at = '2025-08-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 1 %' OR descricao ILIKE '%Parcela 1-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2025-09-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 2 %' OR descricao ILIKE '%Parcela 2-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2025-10-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 3 %' OR descricao ILIKE '%Parcela 3-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2025-11-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 4 %' OR descricao ILIKE '%Parcela 4-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2025-12-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 5 %' OR descricao ILIKE '%Parcela 5-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2026-01-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 6 %' OR descricao ILIKE '%Parcela 6-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2026-02-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 7 %' OR descricao ILIKE '%Parcela 7-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2026-03-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 8 %' OR descricao ILIKE '%Parcela 8-%');

  UPDATE public.movimentacoes_caixa
  SET created_at = '2026-04-21 12:00:00+00'::timestamptz
  WHERE (referencia_id = 'aabecf04-a549-4fbf-a80e-d98a47f2d827' OR referencia_id = '1f02baca-5999-439d-a937-c173a8a97b06')
    AND (descricao ILIKE '%Parcela 9 %' OR descricao ILIKE '%Parcela 9-%');

END $$;
