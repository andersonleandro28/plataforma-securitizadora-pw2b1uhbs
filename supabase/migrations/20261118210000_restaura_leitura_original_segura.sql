-- 20261118210000_restaura_leitura_original_segura.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURA O COMPORTAMENTO QUE FUNCIONAVA ANTES DA MINHA INTERVENÇÃO
-- ─────────────────────────────────────────────────────────────────────────────
-- O dono relatou que, após minhas alterações de RLS, o saldo da conta bancária
-- apareceu inflado e o sistema deixou de se comportar como antes. O pedido é
-- claro: voltar ao que funcionava.
--
-- Esta migration devolve a LEITURA ao estado original, sem reabrir o único
-- buraco que realmente existia — a escrita indiscriminada.
--
-- Estado final de cada tabela:
--
--   recebiveis_ccb
--     SELECT  → true para authenticated  (ORIGINAL)
--     INSERT/UPDATE/DELETE → equipe interna (era true para authenticated)
--
--   treasury_transactions
--     SELECT  → true para authenticated  (ORIGINAL)
--     INSERT/UPDATE/DELETE → equipe interna (era true para authenticated)
--
--   credit_managers
--     SELECT  → true para authenticated  (ORIGINAL)
--     INSERT/UPDATE/DELETE → equipe interna (era true para authenticated)
--
-- POR QUE MANTER A ESCRITA FECHADA:
-- com `FOR ALL USING(true)`, qualquer usuário logado — inclusive um tomador
-- recém-cadastrado no portal — apagava ou reescrevia boletos de recebíveis pela
-- API, sem passar por tela. Os boletos são a base do saldo devedor usado na
-- quitação. Fechar a escrita não altera nenhum cálculo nem nenhuma tela: todas
-- as telas que escrevem nessas tabelas são do painel administrativo.
--
-- SE QUALQUER TELA DO PAINEL PASSAR A RECUSAR UMA GRAVAÇÃO, o problema está
-- aqui e a correção é incluir o papel dessa pessoa em is_internal_staff() —
-- NUNCA reabrir o SELECT.

-- ============================================================================
-- Colunas usadas pelo critério de equipe (garantia de existência)
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_accountant BOOLEAN DEFAULT false;

-- Critério de escrita: reaproveita public.is_admin(), que é o conceito que o
-- sistema já usa e que reconhece o uuid fixo e o e-mail do super admin.
-- Não cria um segundo conceito de administrador.
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
-- recebiveis_ccb
-- ============================================================================
ALTER TABLE public.recebiveis_ccb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_recebiveis_ccb" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_select" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_insert" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_update" ON public.recebiveis_ccb;
DROP POLICY IF EXISTS "recebiveis_ccb_delete" ON public.recebiveis_ccb;

CREATE POLICY "recebiveis_ccb_select" ON public.recebiveis_ccb
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recebiveis_ccb_insert" ON public.recebiveis_ccb
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff());

CREATE POLICY "recebiveis_ccb_update" ON public.recebiveis_ccb
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff()) WITH CHECK (public.is_internal_staff());

CREATE POLICY "recebiveis_ccb_delete" ON public.recebiveis_ccb
  FOR DELETE TO authenticated USING (public.is_internal_staff());

-- ============================================================================
-- treasury_transactions
-- ============================================================================
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_treasury_transactions" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_insert" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_update" ON public.treasury_transactions;
DROP POLICY IF EXISTS "treasury_transactions_delete" ON public.treasury_transactions;

CREATE POLICY "treasury_transactions_select" ON public.treasury_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "treasury_transactions_insert" ON public.treasury_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff());

CREATE POLICY "treasury_transactions_update" ON public.treasury_transactions
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff()) WITH CHECK (public.is_internal_staff());

CREATE POLICY "treasury_transactions_delete" ON public.treasury_transactions
  FOR DELETE TO authenticated USING (public.is_internal_staff());

-- ============================================================================
-- credit_managers
-- ============================================================================
ALTER TABLE public.credit_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_credit_managers" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_select" ON public.credit_managers;
DROP POLICY IF EXISTS "credit_managers_write" ON public.credit_managers;

CREATE POLICY "credit_managers_select" ON public.credit_managers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "credit_managers_write" ON public.credit_managers
  FOR ALL TO authenticated
  USING (public.is_internal_staff()) WITH CHECK (public.is_internal_staff());
