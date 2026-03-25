-- Limpeza de dados obsoletos das sessões de investimentos e resgates para zerar a fila administrativa
DELETE FROM public.investment_redemptions;
DELETE FROM public.investments;
