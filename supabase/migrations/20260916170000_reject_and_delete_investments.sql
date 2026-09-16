-- Migration: Adiciona funções RPC para reprovar e excluir aportes não aprovados
-- 20260916170000_reject_and_delete_investments.sql

-- 1. Função RPC para reprovar um aporte
CREATE OR REPLACE FUNCTION public.reject_investment(
    p_investment_id uuid,
    p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;
    
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Aporte não encontrado.';
    END IF;

    -- Não permitir reprovar aporte já aprovado
    IF v_inv.status = 'approved' THEN
        RAISE EXCEPTION 'Não é possível reprovar um aporte que já foi aprovado.';
    END IF;

    -- Atualiza status e motivo de recusa do aporte
    UPDATE public.investments
    SET status = 'rejected',
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        updated_at = NOW()
    WHERE id = p_investment_id;

    -- Se houver subscrição vinculada (ainda que pendente/inativa), atualiza para Inativo/Reprovado
    UPDATE public.debenture_subscriptions
    SET status = 'Reprovado',
        deleted_at = NOW()
    WHERE investment_id = p_investment_id;

    -- Registra auditoria
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
        'investments',
        p_investment_id,
        'admin_rejected_investment',
        auth.uid(),
        jsonb_build_object(
            'message', 'Aporte ' || p_investment_id || ' reprovado.',
            'rejection_reason', p_rejection_reason,
            'previous_status', v_inv.status
        )
    );
END;
$$;

-- 2. Função RPC para excluir permanentemente um aporte não aprovado
CREATE OR REPLACE FUNCTION public.delete_unapproved_investment(
    p_investment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Aporte não encontrado.';
    END IF;

    -- Bloqueio estrito: JAMAIS excluir aporte já aprovado
    IF v_inv.status = 'approved' THEN
        RAISE EXCEPTION 'Aportes aprovados não podem ser excluídos.';
    END IF;

    -- Limpar / Desvincular transações da tesouraria caso existam com esse reference_id
    DELETE FROM public.treasury_transactions
    WHERE reference_id = p_investment_id;

    -- Deletar comprovantes de investimento vinculados
    DELETE FROM public.investment_proofs
    WHERE investment_id = p_investment_id;

    -- Deletar solicitações de resgate se porventura existissem
    DELETE FROM public.investment_redemptions
    WHERE investment_id = p_investment_id;

    -- Deletar subscrições vinculadas de debêntures
    DELETE FROM public.debenture_subscriptions
    WHERE investment_id = p_investment_id;

    -- Registrar auditoria ANTES de apagar o aporte
    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
        'investments',
        p_investment_id,
        'admin_permanently_deleted_investment',
        auth.uid(),
        jsonb_build_object(
            'message', 'Aporte ' || p_investment_id || ' excluído permanentemente.',
            'user_id', v_inv.user_id,
            'product_id', v_inv.product_id,
            'total_value', v_inv.total_value,
            'quotas', v_inv.quotas,
            'status', v_inv.status
        )
    );

    -- Finalmente, deletar o registro em investments
    DELETE FROM public.investments
    WHERE id = p_investment_id;
END;
$$;

-- Conceder permissão de execução aos usuários autenticados (a segurança e checagem de role admin são validadas pelas funções e RLS)
GRANT EXECUTE ON FUNCTION public.reject_investment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_unapproved_investment(uuid) TO authenticated;
