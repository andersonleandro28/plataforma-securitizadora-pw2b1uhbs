-- Migration: 20260925180000_add_commission_rate_applied_to_operations.sql
-- Adiciona o percentual de comissão aplicado na data de cada operação (histórico perene)

ALTER TABLE public.credit_operations
  ADD COLUMN IF NOT EXISTS commission_rate_applied NUMERIC;

ALTER TABLE public.recebiveis_ccb
  ADD COLUMN IF NOT EXISTS commission_rate_applied NUMERIC;
