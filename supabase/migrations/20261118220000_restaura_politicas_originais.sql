-- 20261118220000_restaura_politicas_originais.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- VOLTA AS POLÍTICAS DE ACESSO AO ESTADO ORIGINAL
-- ─────────────────────────────────────────────────────────────────────────────
-- A pedido do dono ("vamos voltar a versão anterior antes de você começar a
-- mexer antes a coisa fique pior"), esta migration devolve as três tabelas
-- exatamente ao estado em que estavam antes das minhas alterações:
--
--   recebiveis_ccb        → FOR ALL TO authenticated USING(true) WITH CHECK(true)
--   treasury_transactions → FOR ALL TO authenticated USING(true) WITH CHECK(true)
--   credit_managers       → FOR ALL TO authenticated USING(true) WITH CHECK(true)
--
-- Não fica nenhuma política minha no banco. A função is_internal_staff() é
-- removida junto, para não sobrar conceito meu circulando no sistema.
--
-- O QUE ISSO REABRE (registro honesto, para decisão futura do dono):
-- qualquer usuário autenticado — inclusive um tomador recém-cadastrado no
-- portal — volta a poder INSERT/UPDATE/DELETE nessas três tabelas direto pela
-- API do Supabase, sem passar por tela. Em recebiveis_ccb isso significa poder
-- reescrever os boletos que servem de base para o saldo devedor da quitação.
-- NÃO corrigi por conta própria: fica documentado e à disposição para quando o
-- dono quiser tratar isso com calma.

-- ============================================================================
-- 1. recebiveis_ccb
-- ============================================================================
ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recebiveis_ccb_select" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_insert" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_update" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_delete" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "auth_all_recebiveis_ccb" ON public.recebiveis_ccb;

CREATE POLICY "auth_all_recebiveis_ccb" ON public.recebiveis_ccb
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. treasury_transactions
-- ============================================================================
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_insert" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_update" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_delete" ON public.treasury_transactions;
DROP POLICY IF EXISTS "auth_all_treasury_transactions" ON public.treasury_transactions;

CREATE POLICY "auth_all_treasury_transactions" ON public.treasury_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. credit_managers
-- ============================================================================
ALTER TABLE public.credit_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_managers_select" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_write" ON public.credit_managers;
DROP POLICY IF EXISTS "auth_all_credit_managers" ON public.credit_managers;

CREATE POLICY "auth_all_credit_managers" ON public.credit_managers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. Remove o conceito que eu introduzi
-- ============================================================================
DROP FUNCTION IF EXISTS public.is_internal_staff();

-- A RPC de aceite que eu criei não é mais usada (a tela voltou ao update
-- direto). Removida para não sobrar caminho meu esquecido no sistema.
DROP FUNCTION IF EXISTS public.aceitar_proposta_ccb(UUID);

-- A coluna is_accountant fica: o frontend já a usa (use-auth.tsx) e removê-la
-- quebraria a leitura do perfil. Ela é inofensiva e não é política de acesso.
