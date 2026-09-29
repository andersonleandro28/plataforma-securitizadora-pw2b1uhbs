-- Migration: 20260929030000_investor_authorization_post_launch.sql
-- Adiciona colunas para controle do fluxo de autorização/aceite pós-lançamento do investidor

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS investor_authorization_status TEXT DEFAULT 'accepted',
ADD COLUMN IF NOT EXISTS investor_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS investor_accepted_ip TEXT,
ADD COLUMN IF NOT EXISTS investor_accepted_note TEXT;

-- Atualizar registros existentes:
-- Se is_internal_admin = true e investor_authorization_status ainda não foi definido especificamente,
-- podemos garantir que internos fiquem 'pending' se ainda não foram aceitos.
UPDATE public.investments
SET investor_authorization_status = 'pending'
WHERE is_internal_admin = true
  AND (investor_authorization_status IS NULL OR investor_authorization_status = 'accepted')
  AND investor_accepted_at IS NULL;

-- Atualizar view investments_view para incluir os novos campos
CREATE OR REPLACE VIEW public.investments_view AS
SELECT * FROM public.investments WHERE user_id = auth.uid();

GRANT SELECT ON public.investments_view TO authenticated;

-- RLS policies para investments:
-- Garantir que o investidor pode atualizar APENAS os campos de autorização
-- Criação de uma função RPC segura para o investidor submeter aceite ou solicitar revisão
CREATE OR REPLACE FUNCTION public.respond_investment_authorization(
  p_investment_id UUID,
  p_action TEXT, -- 'accept' ou 'request_revision'
  p_client_ip TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.investments%ROWTYPE;
  v_user_id UUID;
  v_profile public.profiles%ROWTYPE;
  v_admin_record RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_inv
  FROM public.investments
  WHERE id = p_investment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aporte não encontrado.';
  END IF;

  -- Apenas o próprio investidor titular do aporte pode autorizar/solicitar revisão
  IF v_inv.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Você não tem permissão para responder a este aporte.';
  END IF;

  IF v_inv.is_internal_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Este aporte não requer autorização pós-lançamento.';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF p_action = 'accept' THEN
    UPDATE public.investments
    SET investor_authorization_status = 'accepted',
        investor_accepted_at = NOW(),
        investor_accepted_ip = COALESCE(NULLIF(p_client_ip, ''), 'Conexão Autenticada via Plataforma Web/SSL'),
        updated_at = NOW()
    WHERE id = p_investment_id;

    -- Log de auditoria
    INSERT INTO public.audit_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      details
    ) VALUES (
      v_user_id,
      'investments',
      p_investment_id,
      'investor_accepted_internal_investment',
      jsonb_build_object(
        'investment_id', p_investment_id,
        'investor_id', v_user_id,
        'investor_name', COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'),
        'accepted_at', NOW(),
        'ip', COALESCE(NULLIF(p_client_ip, ''), 'Conexão Autenticada via Plataforma Web/SSL'),
        'quotas', v_inv.quotas,
        'total_value', v_inv.total_value
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'accepted',
      'message', 'Aporte confirmado com sucesso pelo investidor.'
    );

  ELSIF p_action = 'request_revision' THEN
    UPDATE public.investments
    SET investor_authorization_status = 'revision_requested',
        investor_accepted_note = p_note,
        updated_at = NOW()
    WHERE id = p_investment_id;

    -- Notificar os administradores
    FOR v_admin_record IN
      SELECT id FROM public.profiles
      WHERE (role = 'admin'::app_role OR is_admin = true) AND is_blocked IS NOT TRUE
    LOOP
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        link,
        metadata
      ) VALUES (
        v_admin_record.id,
        'Revisão Solicitada pelo Investidor',
        format('O investidor %s solicitou revisão sobre o aporte interno ID %s (%s cotas). Observação: %s',
          COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'),
          p_investment_id,
          v_inv.quotas,
          COALESCE(p_note, 'Sem observações adicionais.')
        ),
        'warning',
        '/admin/investments',
        jsonb_build_object(
          'investment_id', p_investment_id,
          'investor_id', v_user_id,
          'note', p_note,
          'action', 'revision_requested'
        )
      );
    END LOOP;

    -- Log de auditoria
    INSERT INTO public.audit_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      details
    ) VALUES (
      v_user_id,
      'investments',
      p_investment_id,
      'investor_requested_revision_internal_investment',
      jsonb_build_object(
        'investment_id', p_investment_id,
        'investor_id', v_user_id,
        'investor_name', COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor'),
        'requested_at', NOW(),
        'note', p_note,
        'ip', COALESCE(NULLIF(p_client_ip, ''), 'Conexão Autenticada via Plataforma Web/SSL')
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'revision_requested',
      'message', 'Solicitação de revisão registrada com sucesso. A administração foi notificada.'
    );
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_investment_authorization(UUID, TEXT, TEXT, TEXT) TO authenticated;
