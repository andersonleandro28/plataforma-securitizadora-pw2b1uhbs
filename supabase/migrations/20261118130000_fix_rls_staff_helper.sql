-- 20261118130000_fix_rls_staff_helper.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- UM ÚNICO CRITÉRIO DE "EQUIPE INTERNA" (evita divergência entre políticas)
-- ─────────────────────────────────────────────────────────────────────────────
-- As políticas deste sistema foram escritas em épocas diferentes e comparam
-- papéis de formas distintas:
--
--   • algumas usam `role::text IN ('admin','staff','accountant')`
--   • outras usam `is_staff = true OR role IN ('admin','staff')`
--
-- E existe uma inconsistência real: o enum `app_role` é
--     ('admin','investor','borrower','staff')
-- — NÃO tem 'accountant'. O frontend, porém, trata contador por um booleano
-- separado (`profiles.is_accountant`, ver src/hooks/use-auth.tsx). Portanto,
-- TODA política que testa `role = 'accountant'` nunca casa: o contador dependia
-- de `is_admin` para enxergar contabilidade.
--
-- Esta função unifica o critério num só lugar, para as políticas novas não
-- repetirem a divergência. Ela é SECURITY DEFINER para ler profiles sem entrar
-- em recursão de RLS (chamar profiles de dentro de uma política de profiles
-- estoura "infinite recursion detected", problema que este projeto já teve —
-- ver 20260320070000_fix_profiles_rls_recursion.sql).

-- Garante a coluna antes de referenciá-la: o frontend já usa
-- `profile.is_accountant` (use-auth.tsx), mas nenhuma migration deste
-- repositório a criava. Se ela não existir no banco, a função abaixo falharia
-- em execução e derrubaria TODA leitura de recebíveis e tesouraria — inclusive
-- o painel do cliente.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_accountant BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_admin, false) = true
        OR COALESCE(p.is_staff, false) = true
        OR COALESCE(p.is_accountant, false) = true
        OR p.role::text IN ('admin', 'staff')
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;

-- ============================================================================
-- Reaplica as políticas financeiras usando o critério único
-- ============================================================================
ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recebiveis_ccb_select" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_select" ON public.recebiveis_ccb
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff()
    OR EXISTS (
      SELECT 1 FROM public.ccb_solicitacoes c
      WHERE c.id = public.recebiveis_ccb.ccb_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "recebiveis_ccb_insert" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_insert" ON public.recebiveis_ccb
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "recebiveis_ccb_update" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_update" ON public.recebiveis_ccb
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "recebiveis_ccb_delete" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_delete" ON public.recebiveis_ccb
  FOR DELETE TO authenticated
  USING (public.is_internal_staff());

ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_select" ON public.treasury_transactions
  FOR SELECT TO authenticated
  USING (public.is_internal_staff() OR created_by = auth.uid());

DROP POLICY IF EXISTS "treasury_transactions_insert" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_insert" ON public.treasury_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "treasury_transactions_update" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_update" ON public.treasury_transactions
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "treasury_transactions_delete" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_delete" ON public.treasury_transactions
  FOR DELETE TO authenticated
  USING (public.is_internal_staff());

-- ============================================================================
-- credit_managers: contém CPF, telefone e e-mail de pessoas físicas.
-- Estava "FOR ALL TO authenticated USING (true)" — qualquer usuário logado
-- (inclusive tomador) lia, criava e apagava gerentes de crédito.
-- Escrita é do painel admin; leitura acompanha a operação, então fica com a
-- equipe interna.
-- ============================================================================
ALTER TABLE public.credit_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_credit_managers" ON public.credit_managers;

DROP POLICY IF EXISTS "credit_managers_staff" ON public.credit_managers;
CREATE POLICY "credit_managers_staff" ON public.credit_managers
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

-- ---------------------------------------------------------------------------
-- NOTA DELIBERADA: as tabelas de contabilidade (movimentacoes_caixa,
-- saldo_caixa, mapeamento_movimentacoes) ficaram como estão — já usam
-- `user_id = auth.uid() OR <papel administrativo>`, e reescrevê-las agora
-- exigiria presumir como cada tela grava. Está registrado como pendência.
-- ---------------------------------------------------------------------------
