-- Migração: Correção do saldo em carteira (wallet_balance) e ajuste na liquidação de resgate direto na conta bancária
-- Data: 2026-09-23

-- 1. Regularizar wallet_balance de Amilton Cardozo para 0 (os resgates de R$ 48.837,65 foram pagos via TED/PIX pela Nexum para a conta do investidor, não devem figurar como saldo pendente em conta virtual/carteira livre no portal)
UPDATE public.profiles
SET wallet_balance = 0
WHERE id = '5091d24e-8001-410a-a979-55ec20799ee9'::uuid;

-- 2. Atualizar a RPC process_redemption_payment para que, em resgates padrão (não reinvestimento), NÃO credite erroneamente em wallet_balance como se fosse saldo a ser sacado novamente, já que a liquidação da administração é a efetivação/pagamento do saque para a conta bancária do investidor
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
  v_new_inv_id UUID;
  v_reinvest_amount NUMERIC := 0;
  v_troco NUMERIC := 0;
  v_admin_user UUID;
  v_active_bank_id UUID;
  v_cat_resgate UUID;
  v_cat_invest UUID;
  v_cat_imposto UUID;
  v_ext_ref TEXT;
  v_desc_resgate TEXT;
  v_pay_date DATE;
  v_pay_ts TIMESTAMPTZ;
  v_mov_id UUID;
  v_investor_name TEXT;
  v_sub_id UUID;
  v_new_remaining_quotas INTEGER;
  v_new_total_value NUMERIC;
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
    -- Resgate padrão: liquidado diretamente via transferência bancária/PIX para o investidor.
    -- NÃO somar ao wallet_balance para evitar inflar o saldo total exibido como saldo a resgatar.
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
$$;
