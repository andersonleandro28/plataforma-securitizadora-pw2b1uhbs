DO $$
BEGIN
  -- Fix JSONB boletos (recebiveis_ccb) to force midday, avoiding -3 timezone shifts to previous day
  UPDATE public.recebiveis_ccb
  SET boletos = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'due_date') LIKE '%T00:00:00%' THEN
          jsonb_set(elem, '{due_date}', to_jsonb(replace(elem->>'due_date', 'T00:00:00', 'T12:00:00')))
        WHEN (elem->>'due_date') LIKE '%T00:00:00.000Z%' THEN
          jsonb_set(elem, '{due_date}', to_jsonb(replace(elem->>'due_date', 'T00:00:00.000Z', 'T12:00:00.000Z')))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(boletos) AS elem
  )
  WHERE boletos::text LIKE '%T00:00:00%';

  -- Fix JSONB installments (operacoes_antecipacao) to force midday
  UPDATE public.operacoes_antecipacao
  SET installments = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'due_date') LIKE '%T00:00:00%' THEN
          jsonb_set(elem, '{due_date}', to_jsonb(replace(elem->>'due_date', 'T00:00:00', 'T12:00:00')))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(installments) AS elem
  )
  WHERE installments::text LIKE '%T00:00:00%';

  -- Fix any potential legacy timestamptz that landed exactly on UTC 00:00:00
  UPDATE public.ccb_solicitacoes 
  SET created_at = created_at + interval '12 hours'
  WHERE extract(hour from created_at AT TIME ZONE 'UTC') = 0 
    AND extract(minute from created_at AT TIME ZONE 'UTC') = 0;

  UPDATE public.investments 
  SET created_at = created_at + interval '12 hours'
  WHERE extract(hour from created_at AT TIME ZONE 'UTC') = 0 
    AND extract(minute from created_at AT TIME ZONE 'UTC') = 0;
    
END $$;
