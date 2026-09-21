-- 20260920235600_sync_redemptions_treasury_caixa.sql
-- Garante sincronização atômica ao pagar resgates de investimento:
-- 1. Cria/assegura categoria 'Resgate de Investidor' e 'Resgates e Rendimentos' em transaction_categories
-- 2. Atualiza a RPC process_redemption_payment com search_path = public, gravando atomicamente em:
--    - treasury_transactions (external_ref = 'redemption-{id}')
--    - movimentacoes_caixa (referencia_id = {id}, referencia_tipo = 'resgate_investimento', referencia_numero = 'redemption-{id}')
--    - mapeamento_movimentacoes (sincronizado = true)
-- 3. Cria a RPC revert_redemption_payment para estorno/reversão de resgates pagos se necessário
-- 4. Backfill idempotente para todos os resgates com status='paid' (incluindo e5848e7b-50cb-4c23-a521-f1a45cbe05cb)

-- 1. Assegurar categorias de transação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Resgate de Investidor') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Resgate de Investidor', 'out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Resgates e Rendimentos') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Resgates e Rendimentos', 'out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Impostos e Taxas') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Impostos e Taxas', 'out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE name = 'Investimento') THEN
    INSERT INTO public.transaction_categories (name, type) VALUES ('Investimento', 'out');
  END IF;
END $$;

-- 2. Atualizar RPC process_redemption_payment
CREATE OR REPLACE FUNCTION public.process_redemption_payment(
  p_redemption_id UUID,
  p_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
  v_investment RECORD;
  v_product RECORD;
  v_profile RECORD;
  v_cat_resgate UUID;
  v_cat_imposto UUID;
  v_cat_invest UUID;
  v_reinvest_amount NUMERIC := 0;
  v_troco NUMERIC := 0;
  v_new_inv_id UUID;
  v_target_product RECORD;
  v_sub_id UUID;
  v_investor_name TEXT;
  v_product_title TEXT;
  v_ext_ref TEXT;
  v_desc_resgate TEXT;
  v_mov_id UUID;
  v_pay_date DATE;
  v_pay_ts TIMESTAMPTZ;
  v_admin_user UUID;
BEGIN
  -- 1. Carregar e travar resgate
  SELECT * INTO v_redemption 
  FROM public.investment_redemptions 
  WHERE id = p_redemption_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado: %', p_redemption_id;
  END IF;

  IF v_redemption.status != 'approved' THEN
    RAISE EXCEPTION 'O resgate precisa estar aprovado para ser pago.';
  END IF;

  -- 2. Carregar e travar investimento
  SELECT * INTO v_investment 
  FROM public.investments 
  WHERE id = v_redemption.investment_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento associado não encontrado: %', v_redemption.investment_id;
  END IF;

  IF v_redemption.requested_quotas > (v_investment.quotas - COALESCE(v_investment.redeemed_quotas, 0)) THEN
    RAISE EXCEPTION 'Quantidade de resgate excede o saldo disponível do investimento.';
  END IF;

  -- 3. Carregar produto e perfil do investidor
  SELECT * INTO v_product 
  FROM public.investment_products 
  WHERE id = v_investment.product_id 
  FOR UPDATE;

  SELECT * INTO v_profile 
  FROM public.profiles 
  WHERE id = v_redemption.user_id 
  FOR UPDATE;

  v_investor_name := COALESCE(v_profile.full_name, v_profile.pj_company_name, 'Investidor');
  v_product_title := COALESCE(v_product.title, 'Investimento');
  v_ext_ref := 'redemption-' || p_redemption_id::text;
  v_pay_date := CURRENT_DATE;
  v_pay_ts := NOW();

  v_admin_user := p_admin_id;
  IF v_admin_user IS NULL THEN
    v_admin_user := auth.uid();
  END IF;

  -- Categorias
  SELECT id INTO v_cat_resgate 
  FROM public.transaction_categories 
  WHERE name = 'Resgate de Investidor' OR name = 'Resgates e Rendimentos' 
  ORDER BY CASE WHEN name = 'Resgate de Investidor' THEN 1 ELSE 2 END 
  LIMIT 1;

  SELECT id INTO v_cat_imposto 
  FROM public.transaction_categories 
  WHERE name = 'Impostos e Taxas' 
  LIMIT 1;

  SELECT id INTO v_cat_invest 
  FROM public.transaction_categories 
  WHERE name = 'Investimento' 
  LIMIT 1;

  IF v_cat_invest IS NULL THEN
    SELECT id INTO v_cat_invest FROM public.transaction_categories LIMIT 1;
  END IF;

  -- 4. Atualizar cotas vendidas do produto
  UPDATE public.investment_products
  SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
  WHERE id = v_product.id;

  -- 5. Atualizar cotas resgatadas no investimento
  UPDATE public.investments
  SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
      status = CASE WHEN quotas <= (COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas) THEN 'resgatado' ELSE status END,
      updated_at = NOW()
  WHERE id = v_investment.id;

  -- 6. Baixa da subscrição de debênture (se houver série vinculada)
  IF v_product.series_id IS NOT NULL THEN
    SELECT id INTO v_sub_id 
    FROM public.debenture_subscriptions
    WHERE investment_id = v_investment.id
    ORDER BY created_at ASC 
    LIMIT 1;

    IF v_sub_id IS NULL THEN
      SELECT id INTO v_sub_id 
      FROM public.debenture_subscriptions
      WHERE series_id = v_product.series_id
        AND document_number = v_profile.document_number
        AND (status = 'Ativo' OR status IS NULL)
      ORDER BY created_at ASC 
      LIMIT 1;
    END IF;

    IF v_sub_id IS NOT NULL THEN
      UPDATE public.debenture_subscriptions
      SET quantity = GREATEST(0, quantity - v_redemption.requested_quotas),
          total_amount = GREATEST(0, total_amount - (v_redemption.requested_quotas * unit_price))
      WHERE id = v_sub_id;

      UPDATE public.debenture_subscriptions
      SET status = 'Encerrado'
      WHERE quantity <= 0 AND id = v_sub_id;
    END IF;

    INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES (
      'debenture_series',
      v_product.series_id,
      'redemption_returned_to_stock',
      v_admin_user,
      jsonb_build_object(
        'message', 'Retorno de ' || v_redemption.requested_quotas || ' debêntures por resgate do investidor ' || v_investor_name || ' em ' || TO_CHAR(v_pay_date, 'DD/MM/YYYY')
      )
    );
  END IF;

  -- 7. Fluxo de Reinvestimento ou Saque em Conta
  IF v_redemption.is_reinvestment AND v_redemption.reinvestment_product_id IS NOT NULL THEN
    SELECT * INTO v_target_product 
    FROM public.investment_products 
    WHERE id = v_redemption.reinvestment_product_id 
    FOR UPDATE;

    v_reinvest_amount := v_redemption.reinvestment_quotas * COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000);
    v_troco := v_redemption.net_value - v_reinvest_amount;

    IF v_troco < 0 THEN
      v_troco := 0;
    END IF;

    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_troco
    WHERE id = v_profile.id;

    v_new_inv_id := gen_random_uuid();
    INSERT INTO public.investments (
      id, user_id, product_id, bank_account_id, quotas, unit_price, total_value, status, transfer_date
    ) VALUES (
      v_new_inv_id, v_profile.id, v_target_product.id, v_investment.bank_account_id, v_redemption.reinvestment_quotas,
      COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000), v_reinvest_amount, 'approved', v_pay_date
    );

    UPDATE public.investment_products
    SET sold_quotas = COALESCE(sold_quotas, 0) + v_redemption.reinvestment_quotas
    WHERE id = v_target_product.id;

    IF v_target_product.series_id IS NOT NULL THEN
      INSERT INTO public.debenture_subscriptions (
        investment_id, series_id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date, status
      ) VALUES (
        v_new_inv_id, v_target_product.series_id, v_investor_name,
        v_profile.document_number, v_redemption.reinvestment_quotas, COALESCE(v_target_product.quota_value, v_target_product.min_investment, 1000),
        v_reinvest_amount, v_pay_date, 'Ativo'
      );
    END IF;

    v_desc_resgate := 'Resgate de investimento (Reinvestimento) — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas';

    -- treasury_transactions saída (base do resgate)
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status
    ) VALUES (
      'out', v_redemption.net_value, v_desc_resgate, 'Resgate de Investidor', v_cat_resgate, v_pay_date, v_admin_user, true, p_redemption_id, v_ext_ref, 'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado';

    -- treasury_transactions entrada (integralização)
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status
    ) VALUES (
      'in', v_reinvest_amount, 'Integralização por Conversão de Crédito — ' || v_investor_name, 'Investimento', v_cat_invest, v_pay_date, v_admin_user, true, v_new_inv_id, 'reinvest-' || v_new_inv_id::text, 'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado';

  ELSE
    -- Resgate padrão: credita na carteira do investidor
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
    WHERE id = v_profile.id;

    v_desc_resgate := 'Resgate de investimento — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas';

    -- treasury_transactions saída
    INSERT INTO public.treasury_transactions (
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status
    ) VALUES (
      'out', v_redemption.net_value, v_desc_resgate, 'Resgate de Investidor', v_cat_resgate, v_pay_date, v_admin_user, false, p_redemption_id, v_ext_ref, 'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado';
  END IF;

  -- 8. Lançar movimentacoes_caixa e mapeamento_movimentacoes (Livro Caixa)
  -- Remove lançamento anterior deste resgate para idempotência
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
    created_at
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
    v_pay_ts
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
      type, amount, description, category, category_id, date, created_by, is_escrow, reference_id, external_ref, status
    ) VALUES (
      'out', v_redemption.tax_amount, 'Imposto a Recolher (IRRF) — Resgate ' || v_investor_name, 'Impostos e Taxas', v_cat_imposto, v_pay_date, v_admin_user, false, p_redemption_id, 'tax-redemption-' || p_redemption_id::text, 'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado';
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
      'external_ref', v_ext_ref
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_redemption_payment(UUID, UUID) TO authenticated;

-- 3. Função de Reversão / Estorno de Resgate
CREATE OR REPLACE FUNCTION public.revert_redemption_payment(
  p_redemption_id UUID,
  p_reason TEXT DEFAULT 'Reversão solicitada pelo administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red RECORD;
  v_inv RECORD;
  v_prod RECORD;
  v_prof RECORD;
  v_admin_user UUID;
  v_ext_ref TEXT;
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

  -- 1. Devolver cotas para o investimento e produto
  UPDATE public.investment_products
  SET sold_quotas = COALESCE(sold_quotas, 0) + v_red.requested_quotas
  WHERE id = v_prod.id;

  UPDATE public.investments
  SET redeemed_quotas = GREATEST(0, COALESCE(redeemed_quotas, 0) - v_red.requested_quotas),
      status = 'approved',
      updated_at = NOW()
  WHERE id = v_inv.id;

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

  -- 5. Atualizar resgate para 'approved' ou 'rejected' conforme solicitado
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
$$;

GRANT EXECUTE ON FUNCTION public.revert_redemption_payment(UUID, TEXT) TO authenticated;

-- 4. BACKFILL IDEMPOTENTE: resgates com status='paid' sem lançamento correspondente
DO $$
DECLARE
  r RECORD;
  v_cat_resgate UUID;
  v_cat_imposto UUID;
  v_ext_ref TEXT;
  v_desc_resgate TEXT;
  v_mov_id UUID;
  v_pay_date DATE;
  v_pay_ts TIMESTAMPTZ;
  v_admin_id UUID := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  v_investor_name TEXT;
BEGIN
  SELECT id INTO v_cat_resgate 
  FROM public.transaction_categories 
  WHERE name = 'Resgate de Investidor' OR name = 'Resgates e Rendimentos' 
  ORDER BY CASE WHEN name = 'Resgate de Investidor' THEN 1 ELSE 2 END 
  LIMIT 1;

  SELECT id INTO v_cat_imposto 
  FROM public.transaction_categories 
  WHERE name = 'Impostos e Taxas' 
  LIMIT 1;

  FOR r IN 
    SELECT 
      ir.*,
      COALESCE(p.full_name, p.pj_company_name, 'Investidor') AS investor_name
    FROM public.investment_redemptions ir
    LEFT JOIN public.profiles p ON p.id = ir.user_id
    WHERE ir.status = 'paid'
  LOOP
    v_ext_ref := 'redemption-' || r.id::text;
    v_pay_date := COALESCE(r.updated_at::date, r.created_at::date, CURRENT_DATE);
    v_pay_ts := COALESCE(r.updated_at, r.created_at, NOW());
    v_investor_name := r.investor_name;
    v_desc_resgate := 'Resgate de investimento — ' || v_investor_name || ' — ' || COALESCE(r.requested_quotas, 0) || ' cotas';

    -- 1. Inserir ou atualizar em treasury_transactions
    INSERT INTO public.treasury_transactions (
      type,
      amount,
      description,
      category,
      category_id,
      date,
      created_by,
      is_escrow,
      reference_id,
      external_ref,
      status
    ) VALUES (
      'out',
      r.net_value,
      v_desc_resgate,
      'Resgate de Investidor',
      v_cat_resgate,
      v_pay_date,
      COALESCE(r.updated_by, v_admin_id),
      false,
      r.id,
      v_ext_ref,
      'Confirmado'
    )
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        status = 'Confirmado';

    -- Se tiver imposto de renda retido
    IF COALESCE(r.tax_amount, 0) > 0 THEN
      INSERT INTO public.treasury_transactions (
        type,
        amount,
        description,
        category,
        category_id,
        date,
        created_by,
        is_escrow,
        reference_id,
        external_ref,
        status
      ) VALUES (
        'out',
        r.tax_amount,
        'Imposto a Recolher (IRRF) — Resgate ' || v_investor_name,
        'Impostos e Taxas',
        v_cat_imposto,
        v_pay_date,
        COALESCE(r.updated_by, v_admin_id),
        false,
        r.id,
        'tax-redemption-' || r.id::text,
        'Confirmado'
      )
      ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
      SET amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          description = EXCLUDED.description,
          status = 'Confirmado';
    END IF;

    -- 2. Inserir em movimentacoes_caixa se ainda não existir
    SELECT id INTO v_mov_id 
    FROM public.movimentacoes_caixa 
    WHERE referencia_id = r.id 
      AND referencia_tipo = 'resgate_investimento' 
    LIMIT 1;

    IF v_mov_id IS NULL THEN
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
        created_at
      ) VALUES (
        'saida',
        'Resgate de Investidor',
        v_desc_resgate,
        r.net_value,
        0,
        0,
        r.id,
        'resgate_investimento',
        v_ext_ref,
        COALESCE(r.updated_by, v_admin_id),
        v_pay_ts
      )
      RETURNING id INTO v_mov_id;
    ELSE
      UPDATE public.movimentacoes_caixa
      SET valor = r.net_value,
          descricao = v_desc_resgate,
          categoria = 'Resgate de Investidor',
          created_at = v_pay_ts
      WHERE id = v_mov_id;
    END IF;

    -- 3. Inserir em mapeamento_movimentacoes se ainda não existir
    IF v_mov_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.mapeamento_movimentacoes 
      WHERE origem_tabela = 'investment_redemptions' AND origem_id = r.id
    ) THEN
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
        r.id,
        true,
        COALESCE(r.updated_by, v_admin_id),
        v_pay_ts
      );
    END IF;

  END LOOP;
END $$;
