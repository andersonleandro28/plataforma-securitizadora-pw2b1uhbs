DO $$
DECLARE
  v_op_id UUID;
  v_installments JSONB;
  
  v_rec_id UUID;
  v_boletos JSONB;
BEGIN
  -- 1. Tentativa na tabela operacoes_antecipacao
  SELECT oa.id, oa.installments 
  INTO v_op_id, v_installments
  FROM public.operacoes_antecipacao oa
  LEFT JOIN public.ccb_solicitacoes ccb ON ccb.id = oa.ccb_id
  LEFT JOIN public.profiles p ON p.id = oa.user_id OR p.id = ccb.user_id
  WHERE p.full_name ILIKE '%Rafael da Silva Kieslark%' OR p.pj_company_name ILIKE '%Rafael da Silva Kieslark%'
  LIMIT 1;

  IF v_op_id IS NOT NULL AND jsonb_typeof(v_installments) = 'array' AND jsonb_array_length(v_installments) >= 6 THEN
    v_installments := jsonb_set(v_installments, '{0,payment_date}', '"2024-03-15"', true);
    v_installments := jsonb_set(v_installments, '{0,data_pagamento}', '"2024-03-15"', true);
    v_installments := jsonb_set(v_installments, '{5,payment_date}', '"2024-06-20"', true);
    v_installments := jsonb_set(v_installments, '{5,data_pagamento}', '"2024-06-20"', true);
    
    UPDATE public.operacoes_antecipacao 
    SET installments = v_installments 
    WHERE id = v_op_id;
  END IF;

  -- 2. Tentativa na tabela recebiveis_ccb (boletos)
  SELECT rc.id, rc.boletos 
  INTO v_rec_id, v_boletos
  FROM public.recebiveis_ccb rc
  LEFT JOIN public.ccb_solicitacoes ccb ON ccb.id = rc.ccb_id
  LEFT JOIN public.profiles p ON p.id = rc.tomador_id OR p.id = ccb.user_id
  WHERE p.full_name ILIKE '%Rafael da Silva Kieslark%' OR p.pj_company_name ILIKE '%Rafael da Silva Kieslark%'
  LIMIT 1;

  IF v_rec_id IS NOT NULL AND jsonb_typeof(v_boletos) = 'array' AND jsonb_array_length(v_boletos) >= 6 THEN
    v_boletos := jsonb_set(v_boletos, '{0,payment_date}', '"2024-03-15"', true);
    v_boletos := jsonb_set(v_boletos, '{0,data_pagamento}', '"2024-03-15"', true);
    v_boletos := jsonb_set(v_boletos, '{5,payment_date}', '"2024-06-20"', true);
    v_boletos := jsonb_set(v_boletos, '{5,data_pagamento}', '"2024-06-20"', true);
    
    UPDATE public.recebiveis_ccb 
    SET boletos = v_boletos 
    WHERE id = v_rec_id;
  END IF;

  -- 3. Atualiza caso as datas de pagamento constem em um payload json na tabela credit_operations
  -- A tabela armazena installments como JSON em algumas migrações e Int em outras
  BEGIN
    UPDATE public.credit_operations 
    SET installments = jsonb_set(
      jsonb_set(
        installments::jsonb,
        '{0,payment_date}',
        '"2024-03-15"'
      ),
      '{5,payment_date}',
      '"2024-06-20"'
    )
    WHERE id IN (
      SELECT co.id FROM public.credit_operations co
      JOIN public.profiles p ON p.id = co.borrower_id
      WHERE (p.full_name ILIKE '%Rafael da Silva Kieslark%' OR p.pj_company_name ILIKE '%Rafael da Silva Kieslark%')
      AND jsonb_typeof(co.installments::jsonb) = 'array'
      AND jsonb_array_length(co.installments::jsonb) >= 6
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignora silenciosamente se installments for apenas integer como na estrutura base
  END;
END $$;
