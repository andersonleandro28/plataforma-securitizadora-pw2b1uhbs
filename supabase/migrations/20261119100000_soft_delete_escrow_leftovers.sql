-- Migration: soft_delete_escrow_leftovers
-- Exclusão suave (deleted_at) dos 84 resquícios órfãos em treasury_transactions
-- com is_escrow = true. A função escrow foi REMOVIDA do sistema; esses
-- lançamentos são o registro duplicado/órfão do fluxo antigo — o mesmo fluxo
-- financeiro já é registrado em paralelo por parcelas ccb-bol/op-bol legítimas
-- (e hoje o saldo JÁ os exclui via filtro is_escrow de get_bank_account_balance).
-- A exclusão suave NÃO altera saldo algum: apenas deixa o estado da tabela
-- coerente com o que o motor contábil (accounting-ledger.ts) já exibe.
-- Idempotente: só toca linhas vivas (deleted_at IS NULL) do fluxo escrow.

UPDATE public.treasury_transactions
SET
  deleted_at = now(),
  deleted_by = NULL
WHERE is_escrow = TRUE
  AND deleted_at IS NULL
  AND bank_account_id = '97c394bd-6334-43ab-9db5-b8717581ae61';
