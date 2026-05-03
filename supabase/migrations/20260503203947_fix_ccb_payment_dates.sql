DO $$
DECLARE
  v_rec record;
  v_new_insts jsonb;
  v_inst jsonb;
  v_updated boolean;
BEGIN
  -- Corrige os dados em operacoes_antecipacao (CCBs Digitais)
  FOR v_rec IN 
    SELECT o.id, o.installments 
    FROM public.operacoes_antecipacao o
    JOIN public.ccb_solicitacoes c ON c.id = o.ccb_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE p.full_name ILIKE '%Rafael%Kieslark%' 
       OR p.pj_company_name ILIKE '%Rafael%Kieslark%'
       OR p.full_name ILIKE '%Osvaldir%Pereira%' 
       OR p.pj_company_name ILIKE '%Osvaldir%Pereira%'
       OR p.full_name ILIKE '%Carlos%Eduardo%Garbelotti%'
       OR p.pj_company_name ILIKE '%Carlos%Eduardo%Garbelotti%'
  LOOP
    v_new_insts := '[]'::jsonb;
    v_updated := false;
    
    IF v_rec.installments IS NOT NULL THEN
      FOR v_inst IN SELECT * FROM jsonb_array_elements(v_rec.installments)
      LOOP
        -- Se a parcela constar como paga mas a data_pagamento estiver vazia
        IF (v_inst->>'status' = 'paga' OR v_inst->>'status' = 'Pago') AND (v_inst->>'payment_date' IS NULL OR v_inst->>'payment_date' = '') THEN
          IF v_inst->'due_date' IS NOT NULL THEN
            -- Define a data de pagamento com base na data de vencimento prevista no cronograma
            v_inst := jsonb_set(v_inst, '{payment_date}', v_inst->'due_date');
            v_updated := true;
          END IF;
        END IF;
        v_new_insts := v_new_insts || v_inst;
      END LOOP;
    END IF;

    -- Salvar alterações e disparar a trigger de sincronização com a tesouraria (livro caixa)
    IF v_updated THEN
      UPDATE public.operacoes_antecipacao SET installments = v_new_insts WHERE id = v_rec.id;
    END IF;
  END LOOP;

  -- Corrige os dados em recebiveis_ccb (Tabela alternativa de Aquisição CCB)
  FOR v_rec IN 
    SELECT r.id, r.boletos 
    FROM public.recebiveis_ccb r
    JOIN public.profiles p ON p.id = r.tomador_id
    WHERE p.full_name ILIKE '%Rafael%Kieslark%' 
       OR p.pj_company_name ILIKE '%Rafael%Kieslark%'
       OR p.full_name ILIKE '%Osvaldir%Pereira%' 
       OR p.pj_company_name ILIKE '%Osvaldir%Pereira%'
       OR p.full_name ILIKE '%Carlos%Eduardo%Garbelotti%'
       OR p.pj_company_name ILIKE '%Carlos%Eduardo%Garbelotti%'
  LOOP
    v_new_insts := '[]'::jsonb;
    v_updated := false;
    
    IF v_rec.boletos IS NOT NULL THEN
      FOR v_inst IN SELECT * FROM jsonb_array_elements(v_rec.boletos)
      LOOP
        IF (v_inst->>'status' = 'Pago' OR v_inst->>'status' = 'paga') AND (v_inst->>'payment_date' IS NULL OR v_inst->>'payment_date' = '') THEN
          IF v_inst->'due_date' IS NOT NULL THEN
            v_inst := jsonb_set(v_inst, '{payment_date}', v_inst->'due_date');
            v_updated := true;
          END IF;
        END IF;
        v_new_insts := v_new_insts || v_inst;
      END LOOP;
    END IF;

    IF v_updated THEN
      UPDATE public.recebiveis_ccb SET boletos = v_new_insts WHERE id = v_rec.id;
    END IF;
  END LOOP;

END $$;
