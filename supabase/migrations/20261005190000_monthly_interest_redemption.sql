-- Migration: 20261005190000_monthly_interest_redemption.sql
-- Adiciona regime de rendimento mensal para debêntures e tipos de resgate (total, parcial, interest_only)

-- 1. Colunas em investment_products
ALTER TABLE public.investment_products
ADD COLUMN IF NOT EXISTS yield_payment_regime TEXT NOT NULL DEFAULT 'accumulated',
ADD COLUMN IF NOT EXISTS monthly_payment_day INTEGER NOT NULL DEFAULT 1;

-- 2. Colunas em investment_redemptions
ALTER TABLE public.investment_redemptions
ADD COLUMN IF NOT EXISTS redemption_type TEXT NOT NULL DEFAULT 'total',
ADD COLUMN IF NOT EXISTS period_month TEXT;

-- 3. Atualizar a RPC process_redemption_payment para suportar redemption_type = 'interest_only'
CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_redemption RECORD;
  v_investment RECORD;
  v_product RECORD;
  v_profile RECORD;
  v_new_inv_id UUID;
  v_reinvest_amount NUMERIC := 0;
  v_troco NUMERIC := 0;
  v_admin_user UUID;
  v_active_bank_id UUID;
  v_cat_resgate UUID;
  v_cat_invest UUID;
  v_cat_imposto UUID;
  v_cat_juros UUID;
  v_ext_ref TEXT;
  v_desc_resgate TEXT;
  v_pay_date DATE;
  v_pay_ts TIMESTAMPTZ;
  v_mov_id UUID;
  v_investor_name TEXT;
  v_sub_id UUID;
  v_new_remaining_quotas INTEGER;
  v_new_total_value NUMERIC;
  v_is_interest_only BOOLEAN := false;
  v_period_str TEXT;
BEGIN
  v_admin_user := COALESCE(p_admin_id, auth.uid());

  -- 1. Carregar solicitação de resgate
  SELECT * INTO v_redemption 
  FROM public.investment_redemptions 
  WHERE id = p_redemption_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de resgate não encontrada (ID: %)', p_redemption_id;
  END IF;

  IF v_redemption.status = 'paid' THEN
    RAISE EXCEPTION 'Este resgate já foi pago e liquidado anteriormente.';
  END IF;

  -- 2. Carregar investimento de origem
  SELECT * INTO v_investment 
  FROM public.investments 
  WHERE id = v_redemption.investment_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento vinculado não encontrado (ID: %)', v_redemption.investment_id;
  END IF;

  -- 3. Carregar produto
  SELECT * INTO v_product 
  FROM public.investment_products 
  WHERE id = v_investment.product_id 
  FOR UPDATE;

  -- 4. Carregar perfil do investidor
  SELECT * INTO v_profile 
  FROM public.profiles 
  WHERE id = v_redemption.user_id 
  FOR UPDATE;

  v_investor_name := COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor');
  v_pay_date := CURRENT_DATE;
  v_pay_ts := NOW();
  v_ext_ref := 'redemption-' || p_redemption_id::text;
  v_is_interest_only := (COALESCE(v_redemption.redemption_type, 'total') = 'interest_only');
  v_period_str := COALESCE(v_redemption.period_month, TO_CHAR(v_pay_date, 'YYYY-MM'));

  -- Obter conta bancária da empresa para a liquidação
  SELECT id INTO v_active_bank_id
  FROM public.company_bank_accounts
  WHERE is_active = true
  LIMIT 1;

  IF v_active_bank_id IS NULL THEN
    v_active_bank_id := v_investment.bank_account_id;
  END IF;

  -- Obter categorias
  SELECT id INTO v_cat_resgate 
  FROM public.transaction_categories 
  WHERE name = 'Resgate de Investidor' OR name = 'Resgates e Rendimentos' 
  ORDER BY CASE WHEN name = 'Resgate de Investidor' THEN 1 ELSE 2 END 
  LIMIT 1;

  SELECT id INTO v_cat_juros
  FROM public.transaction_categories
  WHERE name ILIKE '%juros%' OR name ILIKE '%rendimento%' OR name = 'Resgates e Rendimentos'
  ORDER BY CASE WHEN name ILIKE '%juros%' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_cat_juros IS NULL THEN
    v_cat_juros := v_cat_resgate;
  END IF;

  SELECT id INTO v_cat_invest 
  FROM public.transaction_categories 
  WHERE name = 'Investimento' OR name = 'Aporte de Capital' 
  ORDER BY CASE WHEN name = 'Investimento' THEN 1 ELSE 2 END 
  LIMIT 1;

  SELECT id INTO v_cat_imposto 
  FROM public.transaction_categories 
  WHERE name = 'Impostos e Taxas' OR name = 'Despesa Tributária' 
  ORDER BY CASE WHEN name = 'Impostos e Taxas' THEN 1 ELSE 2 END 
  LIMIT 1;

  -- CASO 1: RESGATE EXCLUSIVO DE JUROS (interest_only)
  -- Regra: NÃO debitar cotas, NÃO alterar total_value nem sold_quotas. O principal permanece integral!
  IF v_is_interest_only THEN
    v_desc_resgate := 'Pagamento de Juros Mensais — ' || v_investor_name || ' — Competência ' || v_period_str;

    -- Tesouraria: saída do caixa
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
    ) VALUES (
      'out', v_redemption.net_value, v_desc_resgate, 'Resgate de Investidor', COALESCE(v_cat_juros, v_cat_resgate), v_pay_date, v_admin_user, false, p_redemption_id, v_ext_ref, 'Confirmado', v_active_bank_id
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado',
        bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);

    -- Lançar movimentacoes_caixa e mapeamento_movimentacoes (Livro Caixa)
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = p_redemption_id 
      AND referencia_tipo = 'resgate_investimento';

    INSERT INTO public.movimentacoes_caixa (
      tipo,
      categoria,
      descricao,
      valor,
      saldo_anterior,
      saldo_novo,
      referencia_id,
      referencia_tipo,
      referencia_numero,
      user_id,
      created_at,
      bank_account_id
    ) VALUES (
      'saida',
      'Resgate de Investidor',
      v_desc_resgate,
      v_redemption.net_value,
      0,
      0,
      p_redemption_id,
      'resgate_investimento',
      v_ext_ref,
      v_admin_user,
      v_pay_ts,
      v_active_bank_id
    )
    RETURNING id INTO v_mov_id;

    IF v_mov_id IS NOT NULL THEN
      DELETE FROM public.mapeamento_movimentacoes 
      WHERE origem_tabela = 'investment_redemptions' 
        AND origem_id = p_redemption_id;

      INSERT INTO public.mapeamento_movimentacoes (
        movimentacao_caixa_id,
        origem_tabela,
        origem_id,
        sincronizado,
        user_id,
        created_at
      ) VALUES (
        v_mov_id,
        'investment_redemptions',
        p_redemption_id,
        true,
        v_admin_user,
        v_pay_ts
      );
    END IF;

    -- IRRF a recolher sobre os juros (se houver imposto retido)
    IF COALESCE(v_redemption.tax_amount, 0) > 0 THEN
      INSERT INTO public.treasury_transactions (
        type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
      ) VALUES (
        'out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) — Pagamento de Juros Mensais ' || v_investor_name || ' (' || v_period_str || ')', 'Impostos e Taxas', v_cat_imposto, v_pay_date, v_admin_user, false, p_redemption_id, 'tax-redemption-' || p_redemption_id::text, 'Confirmado', v_active_bank_id
      )
      ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
      SET amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          description = EXCLUDED.description,
          status = 'Confirmado',
          bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);
    END IF;

    -- Atualizar apenas investment_redemptions para paid
    UPDATE public.investment_redemptions
    SET status = 'paid',
        updated_at = v_pay_ts,
        updated_by = v_admin_user
    WHERE id = p_redemption_id;

    -- Registrar em audit_logs
    INSERT INTO public.audit_logs (
      entity_type, entity_id, action, user_id, details
    ) VALUES (
      'investment_redemptions',
      p_redemption_id,
      'monthly_interest_paid',
      v_admin_user,
      jsonb_build_object(
        'redemption_type', 'interest_only',
        'period_month', v_period_str,
        'net_value', v_redemption.net_value,
        'gross_value', v_redemption.gross_value,
        'tax_amount', v_redemption.tax_amount,
        'tax_rate', v_redemption.tax_rate,
        'yield_amount', v_redemption.yield_amount,
        'quotas_preserved', v_investment.quotas,
        'investor_id', v_profile.id,
        'investor_name', v_investor_name,
        'external_ref', v_ext_ref,
        'bank_account_id', v_active_bank_id
      )
    );

    RETURN;
  END IF;

  -- CASO 2: RESGATE PADRÃO / PRINCIPAL (OU REINVESTIMENTO)
  -- 5. Atualizar cotas do produto (vitrine/estoque)
  IF v_product.id IS NOT NULL THEN
    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_product.id;
  END IF;

  -- 6. Atualizar investimento de origem (baixar cotas e decrementar proporcionalmente total_value)
  v_new_remaining_quotas := GREATEST(0, COALESCE(v_investment.quotas, 0) - (COALESCE(v_investment.redeemed_quotas, 0) + v_redemption.requested_quotas));
  v_new_total_value := v_new_remaining_quotas * COALESCE(v_investment.unit_price, v_product.quota_value, 1000);

  UPDATE public.investments 
  SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
      total_value = v_new_total_value,
      status = CASE 
        WHEN v_new_remaining_quotas = 0 THEN 'resgatado'
        ELSE status 
      END,
      updated_at = v_pay_ts
  WHERE id = v_investment.id;

  -- Sincronizar subscrição de debênture associada
  SELECT id INTO v_sub_id 
  FROM public.debenture_subscriptions
  WHERE investment_id = v_investment.id
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.debenture_subscriptions
    SET quantity = v_new_remaining_quotas,
        total_amount = v_new_total_value,
        status = CASE WHEN v_new_remaining_quotas = 0 THEN 'Encerrado' ELSE status END
    WHERE id = v_sub_id;
  ELSIF v_product.series_id IS NOT NULL AND v_profile.document_number IS NOT NULL THEN
    UPDATE public.debenture_subscriptions
    SET quantity = GREATEST(0, quantity - v_redemption.requested_quotas),
        total_amount = GREATEST(0, total_amount - (v_redemption.requested_quotas * unit_price)),
        status = CASE WHEN (quantity - v_redemption.requested_quotas) <= 0 THEN 'Encerrado' ELSE status END
    WHERE id = (
      SELECT id FROM public.debenture_subscriptions 
      WHERE series_id = v_product.series_id 
        AND document_number = v_profile.document_number 
        AND (status = 'Ativo' OR status IS NULL)
      ORDER BY created_at ASC 
      LIMIT 1
    );
  END IF;

  -- 7. Tratar Reinvestimento vs Resgate Padrão
  IF COALESCE(v_redemption.is_reinvestment, false) = true AND v_redemption.reinvestment_product_id IS NOT NULL THEN
    DECLARE
      v_target_product RECORD;
      v_quota_val NUMERIC;
      v_target_quotas INTEGER;
    BEGIN
      SELECT * INTO v_target_product 
      FROM public.investment_products 
      WHERE id = v_redemption.reinvestment_product_id 
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto de reinvestimento não encontrado.';
      END IF;

      v_quota_val := COALESCE(v_target_product.quota_value, 1000);
      IF v_redemption.reinvestment_quotas > 0 THEN
        v_target_quotas := v_redemption.reinvestment_quotas;
      ELSE
        v_target_quotas := FLOOR(v_redemption.net_value / v_quota_val);
      END IF;

      v_reinvest_amount := v_target_quotas * v_quota_val;
      v_troco := GREATEST(0, v_redemption.net_value - v_reinvest_amount);

      -- Criar novo aporte
      INSERT INTO public.investments (
        user_id, product_id, bank_account_id, quotas, unit_price,
        total_value, status, transfer_date, transfer_value
      ) VALUES (
        v_profile.id,
        v_target_product.id,
        v_active_bank_id,
        v_target_quotas,
        v_quota_val,
        v_reinvest_amount,
        'approved',
        v_pay_date,
        v_reinvest_amount
      ) RETURNING id INTO v_new_inv_id;

      -- Incrementar sold_quotas do novo produto
      UPDATE public.investment_products
      SET sold_quotas = COALESCE(sold_quotas, 0) + v_target_quotas
      WHERE id = v_target_product.id;

      -- Subscrição de debênture para novo produto se houver série
      IF v_target_product.series_id IS NOT NULL THEN
        INSERT INTO public.debenture_subscriptions (
          series_id, investor_name, document_number, quantity, unit_price,
          total_amount, subscription_date, investment_id, status
        ) VALUES (
          v_target_product.series_id,
          v_investor_name,
          COALESCE(v_profile.document_number, '00000000000'),
          v_target_quotas,
          v_quota_val,
          v_reinvest_amount,
          v_pay_date,
          v_new_inv_id,
          'Ativo'
        );
      END IF;

      -- Se houver sobra/troco no reinvestimento, deposita no saldo em conta do investidor
      IF v_troco > 0 THEN
        UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_troco
        WHERE id = v_profile.id;
      END IF;

      v_desc_resgate := 'Reinvestimento automático — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas convertidas em ' || v_target_quotas || ' cotas de ' || v_target_product.title;

      -- Tesouraria: saída de resgate e entrada de integralização
      INSERT INTO public.treasury_transactions (
        type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
      ) VALUES (
        'out', v_redemption.net_value, v_desc_resgate, 'Resgate de Investidor', v_cat_resgate, v_pay_date, v_admin_user, true, p_redemption_id, v_ext_ref, 'Confirmado', v_active_bank_id
      )
      ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
      SET amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          description = EXCLUDED.description,
          status = 'Confirmado',
          bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);

      INSERT INTO public.treasury_transactions (
        type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
      ) VALUES (
        'in', v_reinvest_amount, 'Integralização por Conversão de Crédito — ' || v_investor_name, 'Investimento', v_cat_invest, v_pay_date, v_admin_user, true, v_new_inv_id, 'reinvest-' || v_new_inv_id::text, 'Confirmado', v_active_bank_id
      )
      ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
      SET amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          description = EXCLUDED.description,
          status = 'Confirmado',
          bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);
    END;

  ELSE
    -- Resgate padrão de principal: liquidado via transferência bancária/PIX para o investidor
    v_desc_resgate := 'Resgate de investimento — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas';

    -- Tesouraria: saída do caixa
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
    ) VALUES (
      'out', v_redemption.net_value, v_desc_resgate, 'Resgate de Investidor', v_cat_resgate, v_pay_date, v_admin_user, false, p_redemption_id, v_ext_ref, 'Confirmado', v_active_bank_id
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado',
        bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);
  END IF;

  -- 8. Lançar movimentacoes_caixa e mapeamento_movimentacoes (Livro Caixa)
  DELETE FROM public.movimentacoes_caixa 
  WHERE referencia_id = p_redemption_id 
    AND referencia_tipo = 'resgate_investimento';

  INSERT INTO public.movimentacoes_caixa (
    tipo,
    categoria,
    descricao,
    valor,
    saldo_anterior,
    saldo_novo,
    referencia_id,
    referencia_tipo,
    referencia_numero,
    user_id,
    created_at,
    bank_account_id
  ) VALUES (
    'saida',
    'Resgate de Investidor',
    v_desc_resgate,
    v_redemption.net_value,
    0,
    0,
    p_redemption_id,
    'resgate_investimento',
    v_ext_ref,
    v_admin_user,
    v_pay_ts,
    v_active_bank_id
  )
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE origem_tabela = 'investment_redemptions' 
      AND origem_id = p_redemption_id;

    INSERT INTO public.mapeamento_movimentacoes (
      movimentacao_caixa_id,
      origem_tabela,
      origem_id,
      sincronizado,
      user_id,
      created_at
    ) VALUES (
      v_mov_id,
      'investment_redemptions',
      p_redemption_id,
      true,
      v_admin_user,
      v_pay_ts
    );
  END IF;

  -- 9. IRRF a recolher (se houver imposto retido)
  IF COALESCE(v_redemption.tax_amount, 0) > 0 THEN
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status, bank_account_id
    ) VALUES (
      'out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) — Resgate ' || v_investor_name, 'Impostos e Taxas', v_cat_imposto, v_pay_date, v_admin_user, false, p_redemption_id, 'tax-redemption-' || p_redemption_id::text, 'Confirmado', v_active_bank_id
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado',
        bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_active_bank_id);
  END IF;

  -- 10. Atualizar investment_redemptions
  UPDATE public.investment_redemptions
  SET status = 'paid',
      updated_at = v_pay_ts,
      updated_by = v_admin_user
  WHERE id = p_redemption_id;

  -- 11. Registrar em audit_logs
  INSERT INTO public.audit_logs (
    entity_type, entity_id, action, user_id, details
  ) VALUES (
    'investment_redemptions',
    p_redemption_id,
    'redemption_paid',
    v_admin_user,
    jsonb_build_object(
      'net_value', v_redemption.net_value,
      'gross_value', v_redemption.gross_value,
      'tax_amount', v_redemption.tax_amount,
      'tax_rate', v_redemption.tax_rate,
      'yield_amount', v_redemption.yield_amount,
      'quotas', v_redemption.requested_quotas,
      'is_reinvestment', COALESCE(v_redemption.is_reinvestment, false),
      'reinvest_amount', v_reinvest_amount,
      'troco', v_troco,
      'investor_id', v_profile.id,
      'investor_name', v_investor_name,
      'external_ref', v_ext_ref,
      'bank_account_id', v_active_bank_id
    )
  );
END;
$function$;

-- 4. Atualizar revert_redemption_payment para reconhecer resgate de juros
CREATE OR REPLACE FUNCTION public.revert_redemption_payment(p_redemption_id uuid, p_reason text DEFAULT 'Reversão solicitada pelo administrador'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_red RECORD;
  v_inv RECORD;
  v_prod RECORD;
  v_prof RECORD;
  v_admin_user UUID;
  v_ext_ref TEXT;
  v_is_interest_only BOOLEAN := false;
BEGIN
  v_admin_user := auth.uid();
  IF v_admin_user IS NULL THEN
    v_admin_user := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  SELECT * INTO v_red 
  FROM public.investment_redemptions 
  WHERE id = p_redemption_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado: %', p_redemption_id;
  END IF;

  IF v_red.status != 'paid' THEN
    RAISE EXCEPTION 'Apenas resgates pagos podem ser revertidos.';
  END IF;

  SELECT * INTO v_inv 
  FROM public.investments 
  WHERE id = v_red.investment_id 
  FOR UPDATE;

  SELECT * INTO v_prod 
  FROM public.investment_products 
  WHERE id = v_inv.product_id 
  FOR UPDATE;

  SELECT * INTO v_prof 
  FROM public.profiles 
  WHERE id = v_red.user_id 
  FOR UPDATE;

  v_ext_ref := 'redemption-' || p_redemption_id::text;
  v_is_interest_only := (COALESCE(v_red.redemption_type, 'total') = 'interest_only');

  -- 1. Devolver cotas para o investimento e produto (SE NÃO FOR interest_only)
  IF NOT v_is_interest_only THEN
    UPDATE public.investment_products
    SET sold_quotas = COALESCE(sold_quotas, 0) + v_red.requested_quotas
    WHERE id = v_prod.id;

    UPDATE public.investments
    SET redeemed_quotas = GREATEST(0, COALESCE(redeemed_quotas, 0) - v_red.requested_quotas),
        status = 'approved',
        updated_at = NOW()
    WHERE id = v_inv.id;
  END IF;

  -- 2. Debitar saldo da carteira do investidor se não for reinvestimento
  IF NOT COALESCE(v_red.is_reinvestment, false) THEN
    UPDATE public.profiles
    SET wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - v_red.net_value)
    WHERE id = v_prof.id;
  END IF;

  -- 3. Remover lançamentos de tesouraria
  DELETE FROM public.treasury_transactions 
  WHERE external_ref IN (v_ext_ref, 'tax-' || v_ext_ref)
     OR reference_id = p_redemption_id;

  -- 4. Remover livro caixa e mapeamento
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela = 'investment_redemptions' 
    AND origem_id = p_redemption_id;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = p_redemption_id
    AND referencia_tipo = 'resgate_investimento';

  -- 5. Atualizar resgate para 'approved'
  UPDATE public.investment_redemptions
  SET status = 'approved',
      rejection_reason = p_reason,
      updated_at = NOW(),
      updated_by = v_admin_user
  WHERE id = p_redemption_id;

  -- 6. Auditoria
  INSERT INTO public.audit_logs (
    entity_type, entity_id, action, user_id, details
  ) VALUES (
    'investment_redemptions',
    p_redemption_id,
    'redemption_reverted',
    v_admin_user,
    jsonb_build_object(
      'previous_status', 'paid',
      'new_status', 'approved',
      'reason', p_reason,
      'redemption_type', COALESCE(v_red.redemption_type, 'total'),
      'net_value', v_red.net_value,
      'quotas', v_red.requested_quotas,
      'external_ref', v_ext_ref
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', p_redemption_id,
    'status', 'approved'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_redemption_payment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_redemption_payment(UUID, TEXT) TO authenticated;
