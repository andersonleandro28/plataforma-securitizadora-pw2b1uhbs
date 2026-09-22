-- Migração de Reparo de Dados do Resgate de Amilton Cardozo e Atualização da RPC process_redemption_payment
-- 1. Decrementar atomicamente total_value na RPC process_redemption_payment
-- 2. Corrigir os registros da solicitação de resgate d9c922d5-cca3-4337-b847-59157914ef3c e investimento 37a24e18-8e48-4466-88fe-cdd5264ceeb4
-- 3. Inserir/corrigir os lançamentos de débito de R$ 5.000,00 na conta principal (BNK DIGITAL SCD) em treasury_transactions e movimentacoes_caixa

-- A. Atualizar RPC process_redemption_payment
CREATE OR REPLACE FUNCTION public.process_redemption_payment(p_redemption_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_active_bank_id UUID;
  v_unit_price NUMERIC;
  v_redeemed_val NUMERIC;
BEGIN
  -- 0. Buscar conta bancária ativa da empresa
  SELECT id INTO v_active_bank_id 
  FROM public.company_bank_accounts 
  WHERE is_active = true 
  LIMIT 1;

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

  -- Fallback de conta caso a ativa não tenha sido encontrada
  IF v_active_bank_id IS NULL THEN
    v_active_bank_id := v_investment.bank_account_id;
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

  -- 5. Atualizar cotas resgatadas e decrementar total_value no investimento
  v_unit_price := COALESCE(v_investment.unit_price, v_product.quota_value, 1000);
  v_redeemed_val := v_redemption.requested_quotas * v_unit_price;

  UPDATE public.investments
  SET redeemed_quotas = COALESCE(redeemed_quotas, 0) + v_redemption.requested_quotas,
      total_value = GREATEST(0, COALESCE(total_value, 0) - v_redeemed_val),
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
          total_amount = GREATEST(0, total_amount - (v_redemption.requested_quotas * v_unit_price))
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
      v_new_inv_id, v_profile.id, v_target_product.id, COALESCE(v_investment.bank_account_id, v_active_bank_id), v_redemption.reinvestment_quotas,
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

    -- treasury_transactions entrada (integralização)
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

  ELSE
    -- Resgate padrão: credita na carteira do investidor
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_redemption.net_value
    WHERE id = v_profile.id;

    v_desc_resgate := 'Resgate de investimento — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas';

    -- treasury_transactions saída
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
$$;

-- B. Reparo de Dados de Amilton Cardozo
DO $$
DECLARE
  v_red_id UUID := 'd9c922d5-cca3-4337-b847-59157914ef3c'::uuid;
  v_inv_id UUID := '37a24e18-8e48-4466-88fe-cdd5264ceeb4'::uuid;
  v_user_id UUID := '5091d24e-8001-410a-a979-55ec20799ee9'::uuid;
  v_admin_id UUID := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  v_bank_id UUID;
  v_cat_resgate UUID;
  v_mov_id UUID;
  v_ext_ref TEXT := 'redemption-d9c922d5-cca3-4337-b847-59157914ef3c';
  v_desc TEXT := 'Resgate de investimento — AMILTON CARDOZO — 50 cotas';
  v_sub_id UUID;
BEGIN
  -- 1. Obter a conta ativa principal
  SELECT id INTO v_bank_id 
  FROM public.company_bank_accounts 
  WHERE is_active = true 
  LIMIT 1;

  IF v_bank_id IS NULL THEN
    v_bank_id := '97c394bd-6334-43ab-9db5-b8717581ae61'::uuid;
  END IF;

  -- 2. Categoria Resgate
  SELECT id INTO v_cat_resgate 
  FROM public.transaction_categories 
  WHERE name = 'Resgate de Investidor' OR name = 'Resgates e Rendimentos' 
  ORDER BY CASE WHEN name = 'Resgate de Investidor' THEN 1 ELSE 2 END 
  LIMIT 1;

  -- 3. Atualizar a solicitação de resgate para 50 cotas / R$ 5.000,00 com status 'paid'
  UPDATE public.investment_redemptions
  SET requested_quotas = 50,
      gross_value = 5000.00,
      net_value = 5000.00,
      yield_amount = 0.00,
      tax_amount = 0.00,
      tax_rate = 0.00,
      penalty_applied = 0.00,
      discount_applied = 0.00,
      status = 'paid',
      rejection_reason = NULL,
      updated_at = NOW(),
      updated_by = v_admin_id
  WHERE id = v_red_id;

  -- 4. Atualizar o investimento para totalmente resgatado (total_value = 0, redeemed_quotas = 50, status = 'resgatado')
  UPDATE public.investments
  SET redeemed_quotas = 50,
      total_value = 0,
      status = 'resgatado',
      updated_at = NOW()
  WHERE id = v_inv_id;

  -- 5. Atualizar subscrição de debênture associada
  SELECT id INTO v_sub_id 
  FROM public.debenture_subscriptions
  WHERE investment_id = v_inv_id
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.debenture_subscriptions
    SET quantity = 0,
        total_amount = 0,
        status = 'Encerrado'
    WHERE id = v_sub_id;
  END IF;

  -- 6. Atualizar cotas vendidas do produto Renda +1 Sea Connection (-50 cotas de Amilton)
  UPDATE public.investment_products
  SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - 50)
  WHERE id = 'a3333333-3333-3333-3333-333333333333'::uuid;

  -- 7. Lançar em treasury_transactions o resgate de R$ 5.000,00
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
    status,
    bank_account_id
  ) VALUES (
    'out',
    5000.00,
    v_desc,
    'Resgate de Investidor',
    v_cat_resgate,
    CURRENT_DATE,
    v_admin_id,
    false,
    v_red_id,
    v_ext_ref,
    'Confirmado',
    v_bank_id
  )
  ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
  SET amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      description = EXCLUDED.description,
      status = 'Confirmado',
      bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_bank_id);

  -- 8. Lançar em movimentacoes_caixa (Livro Caixa)
  DELETE FROM public.movimentacoes_caixa 
  WHERE referencia_id = v_red_id 
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
    v_desc,
    5000.00,
    0,
    0,
    v_red_id,
    'resgate_investimento',
    v_ext_ref,
    v_admin_id,
    NOW(),
    v_bank_id
  )
  RETURNING id INTO v_mov_id;

  -- 9. Mapeamento de movimentações
  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE origem_tabela = 'investment_redemptions' 
      AND origem_id = v_red_id;

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
      v_red_id,
      true,
      v_admin_id,
      NOW()
    );
  END IF;

  -- 10. Audit log
  INSERT INTO public.audit_logs (
    entity_type, entity_id, action, user_id, details
  ) VALUES (
    'investment_redemptions',
    v_red_id,
    'redemption_data_repaired',
    v_admin_id,
    jsonb_build_object(
      'message', 'Reparo do resgate de Amilton Cardozo para 50 cotas / R$ 5.000,00 com baixa do investimento',
      'requested_quotas', 50,
      'net_value', 5000.00,
      'gross_value', 5000.00,
      'bank_account_id', v_bank_id
    )
  );
END $$;
