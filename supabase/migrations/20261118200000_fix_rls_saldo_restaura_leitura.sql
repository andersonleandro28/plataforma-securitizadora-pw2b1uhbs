-- 20261118200000_fix_rls_saldo_restaura_leitura.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DE INCIDENTE — saldo de conta bancária inflado (18/11/2026)
-- ─────────────────────────────────────────────────────────────────────────────
-- RELATO: após as alterações de RLS, a conta bancária passou a exibir valores
-- muito superiores ao saldo real.
--
-- CAUSA: o saldo mostrado em /admin/bank-accounts NÃO vem da função
-- get_bank_account_balance(). Ele é calculado NO NAVEGADOR, em
-- src/lib/accounting-ledger.ts (fetchConsolidatedAccountingLedger), somando 10
-- consultas feitas com as permissões do usuário logado:
--
--     debenture_subscriptions, investments, recebiveis_ccb, expenses,
--     credit_operations, investment_redemptions, movimentacoes_caixa,
--     treasury_transactions, company_bank_accounts, mapeamento_movimentacoes
--
-- O código faz `(recs || [])` para cada fonte e NÃO verifica erro em nenhuma
-- das 10 consultas. Se uma consulta falhar por permissão, o Supabase devolve
-- `data: null` com erro, e o array vira vazio — silenciosamente. O saldo é
-- então calculado SEM aquelas linhas, e a tela não tem como perceber.
--
-- Na migration anterior eu restringi o SELECT de duas dessas fontes:
--     recebiveis_ccb        → somente equipe interna
--     treasury_transactions → somente equipe interna
--
-- Medido em produção com a chave pública, logado como conta comum:
--     treasury_transactions → 0 linhas
--     recebiveis_ccb        → 0 linhas
--     expenses              → 173 linhas
-- Para quem não é reconhecido como equipe interna, o cálculo perdia TODAS as
-- aquisições de CCB (que são saídas, de valor alto) e todas as parcelas
-- recebidas — mantendo só parte das entradas. Resultado: saldo muito acima do
-- real. Era exatamente isso que o painel passou a mostrar.
--
-- ERRO DE MÉTODO (assumido): eu tratei "quem pode ESCREVER" e "quem pode LER"
-- como a mesma permissão. Nesse sistema, leitura é a base do cálculo contábil
-- do próprio painel. Restringir leitura não é endurecer segurança — é quebrar
-- o número na tela.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE ESTA MIGRATION FAZ
-- ─────────────────────────────────────────────────────────────────────────────
--   • SELECT de recebiveis_ccb e treasury_transactions volta para todo usuário
--     autenticado — exatamente o comportamento anterior à minha mudança. Isso
--     restaura o cálculo do saldo.
--   • As restrições de ESCRITA (insert/update/delete) permanecem fechadas para
--     equipe interna: era o buraco real, e fechá-lo não afeta cálculo nenhum.
--   • Nenhuma política nova depende de coluna opcional, para não haver risco de
--     a migration falhar no meio e deixar a tabela sem política alguma
--     (tabela com RLS ligada e nenhuma política = zero linhas para todos,
--      inclusive para o dono — que também produziria saldo errado).
--   • Recria as políticas do zero de forma idempotente.

-- ============================================================================
-- 1. Colunas que a função de equipe interna usa (guarda defensiva)
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_accountant BOOLEAN DEFAULT false;

-- Critério de equipe interna para ESCRITA. Mantém compatibilidade com o
-- conceito de admin que o resto do sistema usa (public.is_admin()), que
-- reconhece também o uuid fixo e o e-mail de super admin. Sem isso, o próprio
-- dono poderia perder a escrita no painel.
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(public.is_admin(), false) = true
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_staff, false) = true
          OR COALESCE(p.is_accountant, false) = true
          OR p.role::text IN ('admin', 'staff')
        )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;

-- ============================================================================
-- 2. recebiveis_ccb — LEITURA RESTAURADA, ESCRITA FECHADA
-- ============================================================================
ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_recebiveis_ccb" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_select" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_insert" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_update" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_delete" ON public.recebiveis_ccb;

-- Leitura: qualquer autenticado (comportamento original).
-- Necessário para o cálculo do saldo e do Livro Caixa no navegador.
CREATE POLICY "recebiveis_ccb_select" ON public.recebiveis_ccb
  FOR SELECT TO authenticated
  USING (true);

-- Escrita: somente equipe interna. Este era o buraco real: com "FOR ALL
-- USING(true)", qualquer usuário logado apagava ou reescrevia boletos — e é
-- dos boletos que sai a base do saldo devedor da quitação.
CREATE POLICY "recebiveis_ccb_insert" ON public.recebiveis_ccb
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

CREATE POLICY "recebiveis_ccb_update" ON public.recebiveis_ccb
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff() OR COALESCE(public.is_admin(), false))
  WITH CHECK (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

CREATE POLICY "recebiveis_ccb_delete" ON public.recebiveis_ccb
  FOR DELETE TO authenticated
  USING (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

-- ============================================================================
-- 3. treasury_transactions — LEITURA RESTAURADA, ESCRITA FECHADA
-- ============================================================================
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_treasury_transactions" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_insert" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_update" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_delete" ON public.treasury_transactions;

-- Leitura: qualquer autenticado (comportamento original), para o cálculo de
-- caixa, DRE e DFC que rodam no navegador.
CREATE POLICY "treasury_transactions_select" ON public.treasury_transactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "treasury_transactions_insert" ON public.treasury_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

CREATE POLICY "treasury_transactions_update" ON public.treasury_transactions
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff() OR COALESCE(public.is_admin(), false))
  WITH CHECK (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

CREATE POLICY "treasury_transactions_delete" ON public.treasury_transactions
  FOR DELETE TO authenticated
  USING (public.is_internal_staff() OR COALESCE(public.is_admin(), false));

-- ============================================================================
-- 4. credit_managers — mesma correção
-- ============================================================================
-- Aqui a leitura também é usada por telas de operação. Mantida aberta para
-- autenticado; escrita fechada para equipe interna.
ALTER TABLE public.credit_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_credit_managers" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_staff" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_select" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_write" ON public.credit_managers;

CREATE POLICY "credit_managers_select" ON public.credit_managers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "credit_managers_write" ON public.credit_managers
  FOR ALL TO authenticated
  USING (public.is_internal_staff() OR COALESCE(public.is_admin(), false))
  WITH CHECK (public.is_internal_staff() OR COALESCE(public.is_admin(), false));
