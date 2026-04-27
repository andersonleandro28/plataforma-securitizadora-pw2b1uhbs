-- Fix off-by-one day display issues by standardizing created_at to 15:00 UTC
-- Only applies to records created before noon UTC (which shift to previous day in UTC-3)

DO $
BEGIN
  -- Aportes
  UPDATE public.investments
  SET created_at = date_trunc('day', created_at) + interval '15 hours'
  WHERE EXTRACT(HOUR FROM created_at) < 12;

  -- Subscrições de debêntures
  UPDATE public.debenture_subscriptions
  SET created_at = date_trunc('day', created_at) + interval '15 hours'
  WHERE EXTRACT(HOUR FROM created_at) < 12;

  -- CCBs
  UPDATE public.ccb_solicitacoes
  SET created_at = date_trunc('day', created_at) + interval '15 hours'
  WHERE EXTRACT(HOUR FROM created_at) < 12;

  -- Operações de crédito / Antecipações
  UPDATE public.credit_operations
  SET created_at = date_trunc('day', created_at) + interval '15 hours'
  WHERE EXTRACT(HOUR FROM created_at) < 12;
  
  -- Compras de recebíveis / CCB
  UPDATE public.recebiveis_ccb
  SET created_at = date_trunc('day', created_at) + interval '15 hours'
  WHERE EXTRACT(HOUR FROM created_at) < 12;
END $;
