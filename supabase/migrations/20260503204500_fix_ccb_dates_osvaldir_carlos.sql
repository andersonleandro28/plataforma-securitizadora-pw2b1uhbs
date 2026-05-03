DO $block$
DECLARE
  rec RECORD;
  inst JSONB;
  new_array JSONB;
  due_date TEXT;
  changed BOOLEAN;
BEGIN
  -- 1. operacoes_antecipacao (installments)
  FOR rec IN 
    SELECT o.id, o.installments
    FROM public.operacoes_antecipacao o
    JOIN public.ccb_solicitacoes c ON c.id = o.ccb_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE p.full_name ILIKE '%Osvaldir%' OR p.full_name ILIKE '%Carlos Eduardo%'
  LOOP
    new_array := '[]'::JSONB;
    changed := false;
    
    IF rec.installments IS NOT NULL THEN
      FOR inst IN SELECT * FROM jsonb_array_elements(rec.installments)
      LOOP
        IF inst->>'status' IN ('paga', 'Pago', 'pago') AND (inst->>'data_pagamento' IS NULL OR inst->>'data_pagamento' = '') THEN
          due_date := COALESCE(NULLIF(inst->>'data_vencimento', ''), NULLIF(inst->>'due_date', ''), NULLIF(inst->>'dueDate', ''));
          IF due_date IS NOT NULL THEN
            inst := jsonb_set(inst, '{data_pagamento}', to_jsonb(due_date));
            changed := true;
          END IF;
        END IF;
        new_array := new_array || inst;
      END LOOP;
      
      IF changed THEN
        UPDATE public.operacoes_antecipacao SET installments = new_array WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;

  -- 2. recebiveis_ccb (boletos)
  FOR rec IN 
    SELECT r.id, r.boletos
    FROM public.recebiveis_ccb r
    JOIN public.profiles p ON p.id = r.tomador_id
    WHERE p.full_name ILIKE '%Osvaldir%' OR p.full_name ILIKE '%Carlos Eduardo%'
  LOOP
    new_array := '[]'::JSONB;
    changed := false;
    
    IF rec.boletos IS NOT NULL THEN
      FOR inst IN SELECT * FROM jsonb_array_elements(rec.boletos)
      LOOP
        IF inst->>'status' IN ('Pago', 'pago', 'liquidado') AND (inst->>'data_pagamento' IS NULL OR inst->>'data_pagamento' = '') THEN
          due_date := COALESCE(NULLIF(inst->>'data_vencimento', ''), NULLIF(inst->>'due_date', ''), NULLIF(inst->>'dueDate', ''));
          IF due_date IS NOT NULL THEN
            inst := jsonb_set(inst, '{data_pagamento}', to_jsonb(due_date));
            changed := true;
          END IF;
        END IF;
        new_array := new_array || inst;
      END LOOP;
      
      IF changed THEN
        UPDATE public.recebiveis_ccb SET boletos = new_array WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;
END $block$;
