-- Migration: RPC send_notification_admin e reforço das políticas RLS em notifications
-- Solução definitiva em camadas para envio de notificações por administradores/sistema

-- 1. Criação da RPC SECURITY DEFINER para envio de notificações por admin/staff ou chamador autenticado autorizado
CREATE OR REPLACE FUNCTION public.send_notification_admin(
    p_user_id uuid,
    p_title text,
    p_message text,
    p_type text DEFAULT 'info',
    p_link text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
    v_is_authorized boolean := false;
    v_notification public.notifications;
BEGIN
    v_caller_id := auth.uid();
    
    -- Se chamado sem auth.uid() (ex: service_role ou internal trigger), permite
    IF v_caller_id IS NULL THEN
        v_is_authorized := true;
    ELSE
        -- Valida se o usuário autenticado é admin ou staff
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_caller_id
              AND (
                  is_admin = true
                  OR is_staff = true
                  OR role IN ('admin'::app_role, 'staff'::app_role)
              )
        ) INTO v_is_authorized;

        -- Fallback: também autoriza se o usuário estiver enviando para si mesmo
        IF NOT v_is_authorized AND v_caller_id = p_user_id THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores ou o próprio usuário podem enviar notificações.'
            USING ERRCODE = '42501';
    END IF;

    -- Inserção com bypass de RLS por ser SECURITY DEFINER
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        link,
        metadata
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        COALESCE(p_type, 'info'),
        p_link,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_notification;

    RETURN v_notification;
END;
$$;

-- Permissões de execução para a RPC
REVOKE ALL ON FUNCTION public.send_notification_admin(uuid, text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification_admin(uuid, text, text, text, text, jsonb) TO authenticated, service_role;

-- 2. Recriação/atualização explícita das políticas RLS da tabela notifications
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_admin_or_own" ON public.notifications;

CREATE POLICY "notifications_insert_admin_or_own" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR (
            SELECT COALESCE(p.is_admin, false) OR COALESCE(p.is_staff, false) OR p.role IN ('admin'::app_role, 'staff'::app_role)
            FROM public.profiles p
            WHERE p.id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;

CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR (
            SELECT COALESCE(p.is_admin, false) OR COALESCE(p.is_staff, false) OR p.role IN ('admin'::app_role, 'staff'::app_role)
            FROM public.profiles p
            WHERE p.id = auth.uid()
        )
        OR public.is_admin()
    );

-- 3. Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
