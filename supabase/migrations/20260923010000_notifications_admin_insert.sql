-- Migration: Permitir que administradores e equipe enviem notificações a qualquer usuário
-- Mantém a regra de que usuários comuns só inserem/leem/editam/excluem notificações para si mesmos

-- 1. Remover a policy antiga de INSERT
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_admin_or_own" ON public.notifications;

-- 2. Criar política de INSERT permitindo que:
--    a) Usuários comuns criem notificações para si mesmos (user_id = auth.uid())
--    b) Administradores (is_admin() ou profiles.is_admin = true ou role IN ('admin', 'staff')) criem para qualquer usuário
CREATE POLICY "notifications_insert_admin_or_own" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (is_admin = true OR role = ANY (ARRAY['admin'::app_role, 'staff'::app_role]))
        )
    );

-- 3. Atualizar política de SELECT para permitir que administradores também possam auditar/visualizar notificações se necessário
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;

CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (is_admin = true OR role = ANY (ARRAY['admin'::app_role, 'staff'::app_role]))
        )
    );
