-- 20261118110000_fix_rls_recebiveis_treasury.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FECHA ESCRITA INDISCRIMINADA EM DADOS FINANCEIROS
-- ─────────────────────────────────────────────────────────────────────────────
-- Achado na auditoria de 18/11/2026:
--
--   recebiveis_ccb        → "FOR ALL TO authenticated USING (true) WITH CHECK (true)"
--   treasury_transactions → "FOR ALL TO authenticated USING (true) WITH CHECK (true)"
--
-- Ou seja: QUALQUER usuário autenticado — inclusive um tomador recém-cadastrado
-- pelo portal — podia INSERT, UPDATE e DELETE nessas duas tabelas direto pela
-- API do Supabase, sem passar por tela nenhuma.
--
-- O que isso permitia, na prática:
--   • apagar ou reescrever os boletos de um recebível (é de onde sai a base da
--     quitação: `boletos[].unit_value` e o status de cada parcela — trocar o
--     status para "Pago" faz a parcela sumir do saldo devedor);
--   • lançar entrada fictícia no caixa (treasury_transactions é a origem do
--     fluxo de caixa e do DRE);
--   • alterar o histórico financeiro sem deixar rastro distinto.
--
-- Não havia nenhum indício de uso indevido nos dados — isto é correção de
-- superfície de ataque, não de incidente.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUEM PRECISA DE CADA ACESSO (verificado no código, não presumido)
-- ─────────────────────────────────────────────────────────────────────────────
-- recebiveis_ccb:
--   • ESCRITA: apenas o painel admin (src/pages/admin/CcbPurchases.tsx faz
--     insert/update/delete direto — precisa continuar funcionando).
--   • LEITURA: admin/staff/accountant E o próprio tomador, para a tela
--     "Minhas parcelas" (src/pages/borrower/MyCcbInstallments.tsx), que lê os
--     boletos das CCBs dele. Vínculo: recebiveis_ccb.ccb_id → ccb_solicitacoes.user_id.
--
-- treasury_transactions:
--   • ESCRITA: admin/staff/accountant.
--   • LEITURA: admin/staff/accountant, mais o próprio criador do lançamento.
--
-- A função public.is_admin() já existe no sistema e é o critério usado nas
-- políticas vizinhas (ccb_solicitacoes.admin_all_ccb). Reutilizo ela para não
-- criar um segundo conceito de "quem é admin".

-- ============================================================================
-- 1. recebiveis_ccb
-- ============================================================================
ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_recebiveis_ccb" ON public.recebiveis_ccb;

-- Leitura: administração ou o dono da CCB
DROP POLICY IF EXISTS "recebiveis_ccb_select" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_select" ON public.recebiveis_ccb
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
    OR EXISTS (
      SELECT 1 FROM public.ccb_solicitacoes c
      WHERE c.id = public.recebiveis_ccb.ccb_id
        AND c.user_id = auth.uid()
    )
  );

-- Escrita: somente administração
DROP POLICY IF EXISTS "recebiveis_ccb_insert" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_insert" ON public.recebiveis_ccb
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

DROP POLICY IF EXISTS "recebiveis_ccb_update" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_update" ON public.recebiveis_ccb
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

DROP POLICY IF EXISTS "recebiveis_ccb_delete" ON public.recebiveis_ccb;
CREATE POLICY "recebiveis_ccb_delete" ON public.recebiveis_ccb
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

-- ============================================================================
-- 2. treasury_transactions
-- ============================================================================
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_treasury_transactions" ON public.treasury_transactions;

DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_select" ON public.treasury_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

DROP POLICY IF EXISTS "treasury_transactions_insert" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_insert" ON public.treasury_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

DROP POLICY IF EXISTS "treasury_transactions_update" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_update" ON public.treasury_transactions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );

DROP POLICY IF EXISTS "treasury_transactions_delete" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_delete" ON public.treasury_transactions
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_staff = true OR p.role::text IN ('admin', 'staff', 'accountant'))
    )
  );
