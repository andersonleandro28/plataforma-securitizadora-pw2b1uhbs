-- 20261118120000_aceite_ccb_rpc.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ACEITE DA PROPOSTA PELO TOMADOR: deixa de ser UPDATE direto
-- ─────────────────────────────────────────────────────────────────────────────
-- Achado na auditoria: src/pages/borrower/CcbDigital.tsx fazia
--
--     supabase.from('ccb_solicitacoes').update({ status: 'aceite_tomador' }).eq('id', id)
--
-- Um UPDATE direto na tabela não permite restringir QUAL campo muda. Se a
-- política de RLS liberasse o update da própria linha (o que é necessário para
-- o aceite), o tomador passaria a poder escrever qualquer coluna da própria
-- CCB: requested_value, term_months, operation_data, admin_notes — inclusive
-- saltando etapas do fluxo para status posteriores (aprovado, liquidado).
--
-- RLS não limita coluna. A solução correta é uma função que valida o estado e
-- muda só o que deve mudar. É o que esta migration cria.
--
-- Regras da função:
--   • só o próprio tomador da CCB;
--   • a CCB não pode estar excluída;
--   • só aceita se o status atual for 'revisada' ou 'pendente_aceite'
--     (o comitê revisou e devolveu a proposta ao tomador);
--   • muda exclusivamente `status` e `updated_at`;
--   • registra em audit_logs.

CREATE OR REPLACE FUNCTION public.aceitar_proposta_ccb(p_ccb_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ccb RECORD;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_ccb
  FROM public.ccb_solicitacoes
  WHERE id = p_ccb_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de CCB não encontrada';
  END IF;

  IF v_ccb.user_id <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão para aceitar esta proposta';
  END IF;

  IF v_ccb.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta solicitação foi excluída';
  END IF;

  v_status := LOWER(COALESCE(v_ccb.status, ''));

  IF v_status = 'aceite_tomador' THEN
    -- Idempotente: aceitar duas vezes não é erro para o usuário.
    RETURN jsonb_build_object('success', true, 'status', 'aceite_tomador', 'repetido', true);
  END IF;

  IF v_status NOT IN ('revisada', 'pendente_aceite', 'ajustada') THEN
    RAISE EXCEPTION
      'Esta CCB não está disponível para aceite (status atual: %)', v_ccb.status;
  END IF;

  UPDATE public.ccb_solicitacoes
  SET status = 'aceite_tomador',
      updated_at = NOW()
  WHERE id = p_ccb_id;

  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'ccb_solicitacoes',
    p_ccb_id,
    v_uid,
    'ccb_aceite_tomador',
    jsonb_build_object('previous_status', v_ccb.status, 'new_status', 'aceite_tomador')
  );

  RETURN jsonb_build_object('success', true, 'status', 'aceite_tomador');
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_proposta_ccb(UUID) TO authenticated;
