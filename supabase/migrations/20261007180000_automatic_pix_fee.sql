-- Migration: 20261007180000_automatic_pix_fee.sql
-- Implementação da Tarifa PIX automática (PF e PJ) por conta bancária da securitizadora
-- 1. Colunas pix_fee_pf e pix_fee_pj em company_bank_accounts
-- 2. Colunas de vínculo de referência (reference_type, reference_id) em expenses
-- 3. Funções public.apply_pix_fee e public.revert_pix_fee
-- 4. Ganchos de disparo em process_redemption_payment, revert_redemption_payment,
--    liquidate_credit_operation_full, revert_credit_operation_full_liquidation

-- ============================================================================
-- 1. ADIÇÃO DE COLUNAS EM company_bank_accounts E expenses
-- ============================================================================
ALTER TABLE public.company_bank_accounts 
  ADD COLUMN IF NOT EXISTS pix_fee_pf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pix_fee_pj NUMERIC(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_expenses_reference ON public.expenses(reference_type, reference_id);

-- ============================================================================
-- 2. FUNÇÃO public.apply_pix_fee
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_pix_fee(
  p_bank_account_id UUID,
  p_beneficiary_document TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank RECORD;
  v_clean_doc TEXT;
  v_fee NUMERIC(10,2) := 0.00;
  v_is_pj BOOLEAN := FALSE;
  v_doc_type TEXT;
  v_existing_id UUID;
  v_category_id UUID := '922335ad-9426-4dd1-8bb6-2abef057906d'::uuid;
  v_category_name TEXT := 'Tarifa Bancária (TED/PIX/Transferências)';
  v_expense_id UUID;
  v_desc TEXT;
  v_admin_user UUID;
  v_mov_id UUID;
  v_id_curto TEXT;
BEGIN
  -- Se não informou conta, busca a conta ativa da securitizadora
  IF p_bank_account_id IS NULL THEN
    SELECT * INTO v_bank FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
  ELSE
    SELECT * INTO v_bank FROM public.company_bank_accounts WHERE id = p_bank_account_id;
  END IF;

  IF v_bank.id IS NULL THEN
    -- Sem conta bancária definida, não lança tarifa
    RETURN NULL;
  END IF;

  -- Limpar documento (apenas dígitos)
  v_clean_doc := regexp_replace(COALESCE(p_beneficiary_document, ''), '\D', '', 'g');
  
  -- Se tiver 14 dígitos é CNPJ (PJ), caso contrário trata como CPF (PF)
  IF length(v_clean_doc) = 14 THEN
    v_is_pj := TRUE;
    v_fee := COALESCE(v_bank.pix_fee_pj, 0.00);
    v_doc_type := 'PJ';
  ELSE
    v_is_pj := FALSE;
    v_fee := COALESCE(v_bank.pix_fee_pf, 0.00);
    v_doc_type := 'PF';
  END IF;

  -- Se a tarifa for <= 0, não gera nenhum lançamento
  IF v_fee <= 0.00 THEN
    RETURN NULL;
  END IF;

  -- Anti-duplicidade: verificar se já existe despesa de tarifa bancária vinculada a este reference_type e reference_id
  SELECT id INTO v_existing_id 
  FROM public.expenses 
  WHERE reference_type = p_reference_type 
    AND reference_id = p_reference_id 
    AND (category ILIKE '%tarifa banc%' OR category_id = v_category_id)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Validar ou buscar categoria de Tarifa Bancária
  IF NOT EXISTS (SELECT 1 FROM public.transaction_categories WHERE id = v_category_id) THEN
    SELECT id, name INTO v_category_id, v_category_name
    FROM public.transaction_categories 
    WHERE name ILIKE '%tarifa banc%' 
    LIMIT 1;
  END IF;

  v_admin_user := COALESCE(p_admin_id, auth.uid());
  IF v_admin_user IS NULL THEN
    v_admin_user := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  v_id_curto := substr(p_reference_id::text, 1, 8);
  v_desc := 'Tarifa PIX — ' || v_doc_type || ' ref. ' || p_reference_type || ' (' || v_id_curto || ')';

  -- 1. Inserir em public.expenses (status 'paid', com devido bank_account_id, payment_date = CURRENT_DATE)
  -- Nota: a trigger on_expense_paid sincroniza automaticamente para public.treasury_transactions
  INSERT INTO public.expenses (
    description,
    category,
    category_id,
    amount,
    due_date,
    payment_date,
    status,
    bank_account_id,
    type,
    created_by,
    reference_type,
    reference_id,
    created_at,
    updated_at
  ) VALUES (
    v_desc,
    v_category_name,
    v_category_id,
    v_fee,
    CURRENT_DATE,
    CURRENT_DATE,
    'paid',
    v_bank.id,
    'pix_fee',
    v_admin_user,
    p_reference_type,
    p_reference_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_expense_id;

  -- 2. Inserir em public.movimentacoes_caixa (saída de caixa no Livro Caixa oficial)
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
    bank_account_id,
    created_at
  ) VALUES (
    'saida',
    'despesa',
    v_desc,
    v_fee,
    0,
    0,
    v_expense_id,
    'despesa',
    'pix-fee-' || v_id_curto,
    v_admin_user,
    v_bank.id,
    NOW()
  )
  RETURNING id INTO v_mov_id;

  -- 3. Inserir em public.mapeamento_movimentacoes para rastreabilidade
  IF v_mov_id IS NOT NULL THEN
    INSERT INTO public.mapeamento_movimentacoes (
      movimentacao_caixa_id,
      origem_tabela,
      origem_id,
      sincronizado,
      user_id,
      created_at
    ) VALUES (
      v_mov_id,
      'despesas',
      v_expense_id,
      true,
      v_admin_user,
      NOW()
    );
  END IF;

  RETURN v_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_pix_fee(UUID, TEXT, TEXT, UUID, UUID) TO authenticated;

-- ============================================================================
-- 3. FUNÇÃO public.revert_pix_fee
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revert_pix_fee(
  p_reference_type TEXT,
  p_reference_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp RECORD;
BEGIN
  -- Percorrer todas as despesas vinculadas à referência informada
  FOR v_exp IN
    SELECT id 
    FROM public.expenses 
    WHERE reference_type = p_reference_type 
      AND reference_id = p_reference_id
  LOOP
    -- 1. Deletar de mapeamento_movimentacoes (onde origem é despesas)
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE (origem_tabela = 'despesas' AND origem_id = v_exp.id)
       OR movimentacao_caixa_id IN (
         SELECT id FROM public.movimentacoes_caixa 
         WHERE referencia_id = v_exp.id AND referencia_tipo = 'despesa'
       );

    -- 2. Deletar de movimentacoes_caixa vinculadas
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_exp.id 
      AND referencia_tipo = 'despesa';

    -- 3. Deletar de treasury_transactions vinculadas à despesa
    DELETE FROM public.treasury_transactions 
    WHERE expense_id = v_exp.id;

    -- 4. Deletar a própria despesa em expenses
    DELETE FROM public.expenses 
    WHERE id = v_exp.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_pix_fee(TEXT, UUID) TO authenticated;

-- ============================================================================
-- 4. ATUALIZAR public.process_redemption_payment (GANCHO APLICAÇÃO TARIFA PIX)
-- ============================================================================
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

    -- GANCHO TARIFA PIX: lança tarifa bancária da conta se configurada
    PERFORM public.apply_pix_fee(
      v_active_bank_id,
      v_profile.document_number,
      'redemption',
      p_redemption_id,
      v_admin_user
    );

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
  IF v_product.id IS NOT NULL THEN
    UPDATE public.investment_products
    SET sold_quotas = GREATEST(0, COALESCE(sold_quotas, 0) - v_redemption.requested_quotas)
    WHERE id = v_product.id;
  END IF;

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

  -- Reinvestimento vs Resgate Padrão
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

      UPDATE public.investment_products
      SET sold_quotas = COALESCE(sold_quotas, 0) + v_target_quotas
      WHERE id = v_target_product.id;

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

      IF v_troco > 0 THEN
        UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_troco
        WHERE id = v_profile.id;
      END IF;

      v_desc_resgate := 'Reinvestimento automático — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas convertidas em ' || v_target_quotas || ' cotas de ' || v_target_product.title;

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
    -- Resgate padrão de principal: liquidado para a conta do investidor
    v_desc_resgate := 'Resgate de investimento — ' || v_investor_name || ' — ' || v_redemption.requested_quotas || ' cotas';

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

  -- 8. Lançar movimentacoes_caixa e mapeamento_movimentacoes
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

  -- GANCHO TARIFA PIX: lança tarifa bancária da conta se configurada (não reinvestimento)
  IF NOT COALESCE(v_redemption.is_reinvestment, false) THEN
    PERFORM public.apply_pix_fee(
      v_active_bank_id,
      v_profile.document_number,
      'redemption',
      p_redemption_id,
      v_admin_user
    );
  END IF;

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

GRANT EXECUTE ON FUNCTION public.process_redemption_payment(UUID, UUID) TO authenticated;

-- ============================================================================
-- 5. ATUALIZAR public.revert_redemption_payment (GANCHO ESTORNO TARIFA PIX)
-- ============================================================================
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

  -- GANCHO TARIFA PIX: reverte a despesa de tarifa bancária vinculada ao resgate
  PERFORM public.revert_pix_fee('redemption', p_redemption_id);

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

GRANT EXECUTE ON FUNCTION public.revert_redemption_payment(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 6. ATUALIZAR public.liquidate_credit_operation_full (GANCHO TARIFA PIX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.liquidate_credit_operation_full(
  p_operation_id text,
  p_payment_date date,
  p_amount_paid numeric DEFAULT NULL::numeric,
  p_notes text DEFAULT NULL::text,
  p_bank_account_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_total NUMERIC;
  v_date DATE;
  v_installments JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_installment JSONB;
  v_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_mov_id UUID;
  v_count_inst INT := 0;
  v_target_bank_id UUID;
  v_beneficiary_doc TEXT;
BEGIN
  -- Validar UUID
  BEGIN
    v_op_uuid := p_operation_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID da operação inválido: %', p_operation_id;
  END;

  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  -- Validar permissão
  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem baixar operações';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada: %', p_operation_id;
  END IF;

  -- Resolver conta bancária do movimento com fallback para a conta ativa
  v_target_bank_id := p_bank_account_id;
  IF v_target_bank_id IS NULL THEN
    SELECT id INTO v_target_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
  END IF;

  v_date := COALESCE(p_payment_date, v_op.liquidation_date, CURRENT_DATE);
  v_total := COALESCE(p_amount_paid, v_op.liquidation_value, v_op.face_value, v_op.requested_value, 0);

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago da liquidação deve ser maior que zero';
  END IF;

  -- Preparar cronograma de parcelas (installments_data) marcando todas como pagas
  v_installments := v_op.installments_data;
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    v_installments := jsonb_build_array(
      jsonb_build_object(
        'number', 1,
        'dueDate', COALESCE(v_op.due_date::text, v_date::text),
        'due_date', COALESCE(v_op.due_date::text, v_date::text),
        'value', v_total,
        'valor_original', v_total,
        'original_value', v_total,
        'status', 'pago',
        'payment_date', v_date::text,
        'data_pagamento', v_date::text,
        'amount_paid', v_total,
        'bank_account_id', v_target_bank_id
      )
    );
  END IF;

  v_count_inst := jsonb_array_length(v_installments);
  FOR v_idx IN 0..(v_count_inst - 1)
  LOOP
    v_installment := v_installments->v_idx;
    v_installment := v_installment || jsonb_build_object(
      'status', 'pago',
      'payment_date', v_date::text,
      'data_pagamento', v_date::text,
      'amount_paid', COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, (v_total / GREATEST(v_count_inst, 1))),
      'paid_at', NOW(),
      'paid_by', v_user_id,
      'notes', COALESCE(p_notes, v_installment->>'notes'),
      'bank_account_id', v_target_bank_id
    );
    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Atualizar credit_operations com status 'liquidado' (libera limite do tomador)
  UPDATE public.credit_operations
  SET
    status = 'liquidado',
    liquidation_date = v_date,
    liquidation_value = v_total,
    installments_data = v_new_installments,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Limpar lançamentos de parcelas individuais anteriores
  DELETE FROM public.treasury_transactions 
  WHERE reference_id = v_op_uuid AND external_ref LIKE 'op-bol-%';

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid AND referencia_tipo = 'parcela_operacao';

  -- Categoria de tesouraria
  SELECT id INTO v_cat_id 
  FROM public.transaction_categories 
  WHERE name = 'Liquidação de Recebível' OR name = 'Recebimento de Parcelas - Operação'
  LIMIT 1;

  v_ext_ref := 'op-liq-' || v_op_uuid::text;
  v_desc := 'Liquidação de recebível — ' || COALESCE(v_op.sacado, 'Sacado') || 
            ' (Doc ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || ')';

  -- Inserir ou atualizar em treasury_transactions
  INSERT INTO public.treasury_transactions (
    type,
    amount,
    date,
    description,
    category,
    category_id,
    reference_id,
    is_escrow,
    external_ref,
    status,
    bank_account_id
  )
  VALUES (
    'in',
    v_total,
    v_date,
    v_desc,
    'Liquidação de Recebível',
    v_cat_id,
    v_op_uuid,
    false,
    v_ext_ref,
    'Confirmado',
    v_target_bank_id
  )
  ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
  SET 
    amount = EXCLUDED.amount,
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    status = 'Confirmado',
    bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_target_bank_id);

  -- Sincronizar movimentacoes_caixa
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid 
    AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');

  INSERT INTO public.movimentacoes_caixa (
    tipo,
    categoria,
    descricao,
    valor,
    referencia_id,
    referencia_tipo,
    referencia_numero,
    user_id,
    created_at,
    bank_account_id
  )
  VALUES (
    'entrada',
    'liquidação_recebível',
    v_desc,
    v_total,
    v_op_uuid,
    'recebível',
    COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)),
    v_user_id,
    (v_date::text || ' 12:00:00+00')::timestamptz,
    v_target_bank_id
  )
  RETURNING id INTO v_mov_id;

  -- Mapeamento movimentações
  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE (origem_tabela = 'recebíveis' OR origem_tabela = 'credit_operations_installment')
      AND origem_id = v_op_uuid;

    INSERT INTO public.mapeamento_movimentacoes (
      movimentacao_caixa_id,
      origem_tabela,
      origem_id,
      sincronizado,
      user_id,
      created_at
    )
    VALUES (
      v_mov_id,
      'recebíveis',
      v_op_uuid,
      true,
      v_user_id,
      NOW()
    );
  END IF;

  -- GANCHO TARIFA PIX: lança tarifa bancária da conta se configurada (favorecido: sacado_document ou tomador)
  v_beneficiary_doc := v_op.sacado_document;
  IF v_beneficiary_doc IS NULL OR trim(v_beneficiary_doc) = '' THEN
    SELECT document_number INTO v_beneficiary_doc FROM public.profiles WHERE id = v_op.borrower_id;
  END IF;

  PERFORM public.apply_pix_fee(
    v_target_bank_id,
    v_beneficiary_doc,
    'credit_operation',
    v_op_uuid,
    v_user_id
  );

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_liquidated_operation_full',
    jsonb_build_object(
      'admin', v_user_id,
      'payment_date', v_date,
      'amount_paid', v_total,
      'sacado', v_op.sacado,
      'cedente', v_op.cedente,
      'document_number', v_op.document_number,
      'external_ref', v_ext_ref,
      'bank_account_id', v_target_bank_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'payment_date', v_date,
    'amount_paid', v_total,
    'external_ref', v_ext_ref,
    'operation_status', 'liquidado',
    'bank_account_id', v_target_bank_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidate_credit_operation_full(TEXT, DATE, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 7. ATUALIZAR public.revert_credit_operation_full_liquidation (GANCHO ESTORNO TARIFA PIX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revert_credit_operation_full_liquidation(
  p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_uuid UUID;
  v_op RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_installments JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_installment JSONB;
  v_ext_ref TEXT;
BEGIN
  -- Validar UUID
  BEGIN
    v_op_uuid := p_operation_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID da operação inválido: %', p_operation_id;
  END;

  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := 'a6edac8d-c3ed-4527-8d80-1f56ef7b3fc6'::uuid;
  END IF;

  SELECT is_admin, is_staff, role
  INTO v_is_admin, v_is_staff, v_caller_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, FALSE) OR COALESCE(v_is_staff, FALSE) OR v_caller_role IN ('admin', 'staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem reverter liquidação';
  END IF;

  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada: %', p_operation_id;
  END IF;

  -- Restaurar parcelas
  v_installments := v_op.installments_data;
  IF v_installments IS NOT NULL AND jsonb_typeof(v_installments) = 'array' THEN
    FOR v_idx IN 0..(jsonb_array_length(v_installments) - 1)
    LOOP
      v_installment := v_installments->v_idx;
      v_installment := (v_installment - 'payment_date' - 'data_pagamento' - 'paid_at' - 'paid_by' - 'amount_paid' - 'notes')
                       || jsonb_build_object('status', 'pendente');
      v_new_installments := v_new_installments || jsonb_build_array(v_installment);
    END LOOP;
  END IF;

  -- Atualizar credit_operations para 'pago' (volta a consumir o limite do tomador, nunca 'aprovado')
  UPDATE public.credit_operations
  SET
    status = 'pago',
    liquidation_date = NULL,
    liquidation_value = NULL,
    installments_data = v_new_installments,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  -- Deletar de treasury_transactions
  v_ext_ref := 'op-liq-' || v_op_uuid::text;
  DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref OR (reference_id = v_op_uuid AND external_ref LIKE 'op-bol-%');

  -- Deletar mapeamentos e caixa
  DELETE FROM public.mapeamento_movimentacoes
  WHERE origem_tabela IN ('recebíveis', 'juros', 'credit_operations_installment') AND origem_id = v_op_uuid;

  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = v_op_uuid;

  -- GANCHO TARIFA PIX: reverte a despesa de tarifa bancária vinculada à operação
  PERFORM public.revert_pix_fee('credit_operation', v_op_uuid);

  -- Auditoria
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_reverted_operation_full_liquidation',
    jsonb_build_object(
      'admin', v_user_id,
      'previous_status', v_op.status,
      'new_status', 'pago',
      'external_ref', v_ext_ref,
      'reverted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'operation_status', 'pago'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_credit_operation_full_liquidation(TEXT) TO authenticated;
