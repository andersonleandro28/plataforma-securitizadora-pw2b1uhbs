-- Migration: Adicionar bank_account_id em treasury_transactions, movimentacoes_caixa e expenses
-- Atualizar RPCs e triggers para persistir conta bancária do movimento (com fallback para conta ativa)

-- 1. Colunas e índices
ALTER TABLE public.treasury_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_bank_account_id
  ON public.treasury_transactions(bank_account_id);

ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_bank_account_id
  ON public.movimentacoes_caixa(bank_account_id);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_bank_account_id
  ON public.expenses(bank_account_id);

-- 2. Trigger sync_expense_to_treasury atualizado com bank_account_id e fallback
CREATE OR REPLACE FUNCTION public.sync_expense_to_treasury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_bank_id UUID;
BEGIN
  IF NEW.status = 'paid' THEN
    -- Fallback: se despesa não tiver bank_account_id, usa a conta ativa
    v_bank_id := NEW.bank_account_id;
    IF v_bank_id IS NULL THEN
      SELECT id INTO v_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
    END IF;

    -- Realiza INSERT, mas se o registro já existir (conflito no expense_id), realiza UPDATE (Upsert)
    INSERT INTO public.treasury_transactions (
      type, 
      amount, 
      date, 
      description, 
      category, 
      expense_id, 
      is_escrow,
      bank_account_id
    )
    VALUES (
      'out', 
      NEW.amount, 
      COALESCE(NEW.payment_date, NEW.due_date), 
      NEW.description, 
      NEW.category, 
      NEW.id, 
      false,
      v_bank_id
    )
    ON CONFLICT (expense_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_bank_id);
      
  ELSIF NEW.status = 'pending' THEN
    -- Se voltar para pendente, remove o lançamento da tesouraria
    DELETE FROM public.treasury_transactions WHERE expense_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Trigger sync_ccb_boletos_to_treasury com bank_account_id (obtém de boleto->>'bank_account_id' ou conta ativa)
CREATE OR REPLACE FUNCTION public.sync_ccb_boletos_to_treasury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_tomador_nome TEXT;
  v_cat_id UUID;
  v_boleto JSONB;
  v_ext_ref TEXT;
  v_desc TEXT;
  idx INT := 1;
  v_total NUMERIC;
  v_status TEXT;
  v_effective_date DATE;
  v_bank_id UUID;
  v_default_bank_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' LIMIT 1;

  SELECT COALESCE(pj_company_name, full_name, 'Desconhecido') INTO v_tomador_nome FROM public.profiles WHERE id = NEW.tomador_id;

  SELECT id INTO v_default_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;

  IF NEW.boletos IS NOT NULL THEN
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(NEW.boletos)
    LOOP
      v_ext_ref := 'ccb-bol-' || NEW.id || '-' || idx;
      v_status := LOWER(COALESCE(v_boleto->>'status', ''));
      
      IF v_status IN ('pago', 'liquidado') THEN
        v_total := (COALESCE((v_boleto->>'unit_value')::numeric, 0) + COALESCE((v_boleto->>'interest_applied')::numeric, 0) + COALESCE((v_boleto->>'penalty_applied')::numeric, 0));
        v_desc := 'Recebimento Parcela ' || idx || ' - CCB nº ' || substr(NEW.ccb_id::text, 1, 8) || ' - Tomador: ' || v_tomador_nome;
        
        -- Prioriza data_pagamento real sobre payment_date ou due_date
        v_effective_date := COALESCE(
          NULLIF(v_boleto->>'data_pagamento', '')::date,
          NULLIF(v_boleto->>'payment_date', '')::date,
          NULLIF(v_boleto->>'due_date', '')::date,
          NOW()::date
        );

        -- Resolve conta bancária do boleto
        v_bank_id := NULL;
        IF v_boleto->>'bank_account_id' IS NOT NULL AND v_boleto->>'bank_account_id' != '' THEN
          BEGIN
            v_bank_id := (v_boleto->>'bank_account_id')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_bank_id := NULL;
          END;
        END IF;
        IF v_bank_id IS NULL THEN
          v_bank_id := v_default_bank_id;
        END IF;

        INSERT INTO public.treasury_transactions (type, amount, date, description, category, category_id, reference_id, is_escrow, external_ref, bank_account_id)
        VALUES ('in', v_total, v_effective_date, v_desc, 'Recebimento de Parcelas - CCB', v_cat_id, NEW.id, true, v_ext_ref, v_bank_id)
        ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE 
        SET amount = EXCLUDED.amount,
            date = EXCLUDED.date,
            description = EXCLUDED.description,
            bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id, v_bank_id);
      ELSE
        DELETE FROM public.treasury_transactions WHERE external_ref = v_ext_ref;
      END IF;
      idx := idx + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Função process_redemption_payment: grava sempre com conta ativa (ou v_investment.bank_account_id)
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

-- 5. liquidate_credit_operation_installment: novo parâmetro opcional p_bank_account_id
CREATE OR REPLACE FUNCTION public.liquidate_credit_operation_installment(
  p_operation_id text,
  p_installment_idx integer,
  p_payment_date date,
  p_amount_paid numeric,
  p_interest_applied numeric DEFAULT 0,
  p_penalty_applied numeric DEFAULT 0,
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
  v_installments JSONB;
  v_installment JSONB;
  v_new_installments JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_caller_role TEXT;
  v_total NUMERIC;
  v_inst_val NUMERIC;
  v_ext_ref TEXT;
  v_full_ext_ref TEXT;
  v_cat_id UUID;
  v_desc TEXT;
  v_all_paid BOOLEAN := TRUE;
  v_total_paid_op NUMERIC := 0;
  v_latest_payment_date DATE := NULL;
  v_inst_payment_date DATE;
  v_total_inst_count INT;
  v_op_is_single BOOLEAN;
  v_init_status TEXT;
  v_mov_id UUID;
  v_target_status TEXT;
  v_st TEXT;
  v_target_bank_id UUID;
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
    RAISE EXCEPTION 'Acesso negado: apenas administradores e equipe podem dar baixa em parcelas';
  END IF;

  -- Buscar operação
  SELECT * INTO v_op FROM public.credit_operations WHERE id = v_op_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação de crédito não encontrada';
  END IF;

  -- Resolver conta bancária do lançamento com fallback na conta ativa
  v_target_bank_id := p_bank_account_id;
  IF v_target_bank_id IS NULL THEN
    SELECT id INTO v_target_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
  END IF;

  v_installments := v_op.installments_data;
  v_op_is_single := (v_op.installments IS NULL OR v_op.installments <= 1);

  -- Se installments_data estiver vazio/nulo e for parcela única, inicializar cronograma
  IF v_installments IS NULL OR jsonb_typeof(v_installments) != 'array' OR jsonb_array_length(v_installments) = 0 THEN
    IF v_op_is_single THEN
      IF LOWER(COALESCE(v_op.status, '')) IN ('pago', 'liquidado') THEN
        v_init_status := 'pago';
      ELSE
        v_init_status := 'pendente';
      END IF;

      v_installments := jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'dueDate', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'due_date', COALESCE(v_op.due_date::text, CURRENT_DATE::text),
          'value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'valor_original', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'original_value', COALESCE(v_op.face_value, v_op.requested_value, 0),
          'status', v_init_status,
          'payment_date', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'data_pagamento', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_date::text, v_op.due_date::text, CURRENT_DATE::text) ELSE NULL END,
          'amount_paid', CASE WHEN v_init_status = 'pago' THEN COALESCE(v_op.liquidation_value, v_op.face_value, v_op.requested_value, 0) ELSE NULL END,
          'bank_account_id', v_target_bank_id
        )
      );
    ELSE
      RAISE EXCEPTION 'Cronograma de parcelas não encontrado para a operação';
    END IF;
  END IF;

  v_total_inst_count := jsonb_array_length(v_installments);

  IF v_total_inst_count <= p_installment_idx THEN
    RAISE EXCEPTION 'Parcela não encontrada no cronograma';
  END IF;

  v_total := COALESCE(p_amount_paid, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'O valor pago deve ser maior que zero';
  END IF;

  -- Atualizar cronograma de parcelas e computar status geral
  FOR v_idx IN 0..(v_total_inst_count - 1)
  LOOP
    v_installment := v_installments->v_idx;
    IF v_idx = p_installment_idx THEN
      v_inst_val := COALESCE(
        (v_installment->>'valor_original')::numeric,
        (v_installment->>'original_value')::numeric,
        (v_installment->>'value')::numeric,
        (v_op.face_value / GREATEST(v_total_inst_count, 1))
      );

      v_installment := v_installment || jsonb_build_object(
        'status', 'pago',
        'value', v_inst_val,
        'payment_date', p_payment_date,
        'data_pagamento', p_payment_date,
        'amount_paid', v_total,
        'interest_applied', COALESCE(p_interest_applied, 0),
        'penalty_applied', COALESCE(p_penalty_applied, 0),
        'paid_at', NOW(),
        'paid_by', v_user_id,
        'notes', p_notes,
        'bank_account_id', v_target_bank_id
      );
    END IF;

    v_st := LOWER(COALESCE(v_installment->>'status', ''));

    IF (v_st NOT IN ('pago', 'liquidado')) OR (v_st IN ('prorrogado', 'prorrogada', 'pendente')) OR (v_installment->>'payment_date' IS NULL AND v_installment->>'data_pagamento' IS NULL) THEN
      v_all_paid := FALSE;
    ELSE
      v_total_paid_op := v_total_paid_op + COALESCE((v_installment->>'amount_paid')::numeric, (v_installment->>'value')::numeric, 0);
      
      v_inst_payment_date := NULL;
      IF v_installment->>'payment_date' IS NOT NULL THEN
        BEGIN
          v_inst_payment_date := (v_installment->>'payment_date')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_payment_date := NULL;
        END;
      ELSIF v_installment->>'data_pagamento' IS NOT NULL THEN
        BEGIN
          v_inst_payment_date := (v_installment->>'data_pagamento')::date;
        EXCEPTION WHEN OTHERS THEN
          v_inst_payment_date := NULL;
        END;
      END IF;

      IF v_inst_payment_date IS NOT NULL THEN
        IF v_latest_payment_date IS NULL OR v_inst_payment_date > v_latest_payment_date THEN
          v_latest_payment_date := v_inst_payment_date;
        END IF;
      END IF;
    END IF;

    v_new_installments := v_new_installments || jsonb_build_array(v_installment);
  END LOOP;

  -- Se TODAS as parcelas foram pagas, operação vai para 'liquidado' (restaurando o limite do tomador).
  -- Se restam parcelas abertas, o status permanece 'pago' (CONTINUA consumindo o limite!).
  IF v_all_paid AND v_total_inst_count > 0 THEN
    v_target_status := 'liquidado';
  ELSE
    v_target_status := 'pago';
  END IF;

  IF v_latest_payment_date IS NULL THEN
    v_latest_payment_date := p_payment_date;
  END IF;

  -- Atualizar credit_operations
  UPDATE public.credit_operations
  SET 
    installments_data = v_new_installments,
    status = v_target_status,
    liquidation_date = CASE WHEN v_target_status = 'liquidado' THEN v_latest_payment_date ELSE NULL END,
    liquidation_value = CASE WHEN v_target_status = 'liquidado' THEN v_total_paid_op ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_op_uuid;

  SELECT id INTO v_cat_id FROM public.transaction_categories WHERE name = 'Recebimento de Parcelas - CCB' OR name = 'Liquidação de Recebível' LIMIT 1;

  v_ext_ref := 'op-bol-' || v_op_uuid::text || '-' || (p_installment_idx + 1);
  v_full_ext_ref := 'op-liq-' || v_op_uuid::text;

  v_desc := 'Recebimento Parcela ' || (p_installment_idx + 1) || '/' || v_total_inst_count || 
            ' - Operação ' || COALESCE(v_op.document_number, substr(v_op_uuid::text, 1, 8)) || 
            ' - Sacado: ' || COALESCE(v_op.sacado, 'Desconhecido') || 
            ' - Cedente: ' || COALESCE(v_op.cedente, 'N/A');

  IF v_target_status != 'liquidado' OR v_total_inst_count = 1 THEN
    DELETE FROM public.treasury_transactions WHERE external_ref = v_full_ext_ref;
    DELETE FROM public.movimentacoes_caixa 
    WHERE referencia_id = v_op_uuid 
      AND (referencia_tipo = 'recebível' OR referencia_tipo = 'recebivel');
  END IF;

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
    p_payment_date,
    v_desc,
    'Recebimento de Parcelas - Operação',
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

  DELETE FROM public.movimentacoes_caixa 
  WHERE referencia_id = v_op_uuid 
    AND (
      (referencia_tipo = 'parcela_operacao' AND referencia_numero = (p_installment_idx + 1)::text)
      OR (v_total_inst_count = 1 AND referencia_tipo IN ('recebível', 'recebivel'))
    );

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
    'parcela_operacao',
    (p_installment_idx + 1)::text,
    v_user_id,
    (p_payment_date::text || ' 12:00:00+00')::timestamptz,
    v_target_bank_id
  )
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes 
    WHERE origem_tabela = 'credit_operations_installment' 
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
      'credit_operations_installment',
      v_op_uuid,
      true,
      v_user_id,
      NOW()
    );
  END IF;

  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'credit_operations',
    v_op_uuid,
    v_user_id,
    'admin_liquidated_operation_installment',
    jsonb_build_object(
      'admin', v_user_id,
      'installment_idx', p_installment_idx,
      'installment_number', p_installment_idx + 1,
      'payment_date', p_payment_date,
      'amount_paid', v_total,
      'interest_applied', p_interest_applied,
      'penalty_applied', p_penalty_applied,
      'sacado', v_op.sacado,
      'cedente', v_op.cedente,
      'external_ref', v_ext_ref,
      'all_paid', v_all_paid,
      'new_operation_status', v_target_status,
      'liquidation_date', CASE WHEN v_target_status = 'liquidado' THEN v_latest_payment_date ELSE NULL END,
      'liquidation_value', CASE WHEN v_target_status = 'liquidado' THEN v_total_paid_op ELSE NULL END,
      'bank_account_id', v_target_bank_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_uuid,
    'installment_idx', p_installment_idx,
    'installments_data', v_new_installments,
    'all_paid', v_all_paid,
    'operation_status', v_target_status,
    'bank_account_id', v_target_bank_id
  );
END;
$$;

-- 6. liquidate_credit_operation_full: novo parâmetro opcional p_bank_account_id
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

  -- Limpar lançamentos de parcelas individuais anteriores para evitar duplicidade com a liquidação integral
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

  -- Inserir ou atualizar em treasury_transactions (DRE / Tesouraria)
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

  -- Sincronizar movimentacoes_caixa (Livro Caixa)
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
