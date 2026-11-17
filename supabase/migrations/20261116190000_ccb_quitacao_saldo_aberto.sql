-- 20261116190000_ccb_quitacao_saldo_aberto.sql
-- CORREÇÃO DA QUITAÇÃO DE CCB: o cálculo passa a considerar as parcelas JÁ PAGAS
-- (no vencimento ou antecipadas) e cobra somente o que resta.
--
-- Antes: principal = valor total da operação (requested_value) — ignorava parcelas pagas.
-- Agora: principal = soma das parcelas do array JSONB `boletos` de public.recebiveis_ccb
--        cujo status NÃO é pago/liquidado (saldo em aberto). Quando a CCB não tem
--        recebível/boletos (fluxo antigo), cai no valor total (comportamento anterior).
-- O restante da fórmula é preservado exatamente: juros proporcionais à taxa do contrato,
-- desconto proporcional à taxa sobre (saldo + juros) e taxas integrais de emissão,
-- análise e abertura SEM desconto: v_total := v_base - v_desconto + v_taxas_integrais.
-- Baixa para 'liquidado' (REGRA PÉTREA: liquidado libera limite; pago consome), caixa,
-- tarifa PIX (apply_pix_fee), auditoria em ccb_quitacoes/audit_logs e anti-re-quitação
-- permanecem intactos.

CREATE OR REPLACE FUNCTION public.quit_ccb_solicitacao(
  p_ccb_id UUID,
  p_payment_date DATE DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_discount_pct NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_is_staff BOOLEAN := FALSE;
  v_role TEXT;
  v_ccb RECORD;
  v_rec RECORD;
  v_sim JSONB;
  v_boleto JSONB;
  v_boleto_status TEXT;
  v_taxa_mensal NUMERIC;        -- decimal (0.027 = 2,7% a.m.)
  v_principal_total NUMERIC;    -- soma de TODAS as parcelas (para auditoria)
  v_principal NUMERIC;          -- saldo em aberto (parcelas não pagas)
  v_total_pago NUMERIC := 0;    -- soma das parcelas já pagas
  v_qtd_boletos INTEGER := 0;
  v_qtd_pagas INTEGER := 0;
  v_qtd_abertas INTEGER := 0;
  v_emission_date DATE;
  v_pay_date DATE;
  v_dias INTEGER;
  v_prazo_dias INTEGER;
  v_juros NUMERIC := 0;
  v_base NUMERIC;
  v_desconto NUMERIC := 0;
  v_desconto_pct NUMERIC := 0;
  v_taxa_emissao NUMERIC := 0;
  v_taxa_analise NUMERIC := 0;
  v_taxa_abertura NUMERIC := 0;
  v_taxas_integrais NUMERIC := 0;
  v_total NUMERIC;
  v_bank_id UUID;
  v_borrower_doc TEXT;
  v_ext_ref TEXT;
  v_desc TEXT;
  v_mov_id UUID;
  v_quit_id UUID;
  v_taxas_detalhe JSONB;
  v_status_atual TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT COALESCE(is_admin, false), COALESCE(is_staff, false), role
  INTO v_is_admin, v_is_staff, v_role
  FROM public.profiles WHERE id = v_user_id;

  IF NOT (v_is_admin OR v_is_staff OR v_role IN ('admin','staff')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem quitar CCB';
  END IF;

  SELECT * INTO v_ccb FROM public.ccb_solicitacoes WHERE id = p_ccb_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de CCB não encontrada: %', p_ccb_id;
  END IF;

  v_status_atual := LOWER(COALESCE(v_ccb.status, ''));
  IF v_ccb.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta solicitação de CCB foi excluída e não pode ser quitada';
  END IF;
  IF v_status_atual IN ('quitado','liquidado','pago','reprovado','cancelado','excluido') THEN
    RAISE EXCEPTION 'Esta CCB já foi baixada (status atual: %) e não pode ser quitada novamente', v_ccb.status;
  END IF;

  v_sim := v_ccb.operation_data->'simulation';

  -- Taxa mensal do contrato: prioriza rate_used (decimal); fallback interest_rate_monthly (%) ou proposedRate (%)
  v_taxa_mensal := COALESCE(
    (v_sim->>'rate_used')::numeric,
    CASE WHEN v_sim->>'interest_rate_monthly' IS NOT NULL
      THEN (v_sim->>'interest_rate_monthly')::numeric / 100.0 END,
    CASE WHEN v_ccb.operation_data->>'proposedRate' IS NOT NULL
      THEN (v_ccb.operation_data->>'proposedRate')::numeric / 100.0 END,
    0
  );
  IF v_taxa_mensal <= 0 THEN
    RAISE EXCEPTION 'Taxa do contrato não encontrada na simulação da CCB';
  END IF;

  v_pay_date := COALESCE(p_payment_date, CURRENT_DATE);
  v_emission_date := COALESCE(
    (v_sim->>'first_due_date')::date,
    (v_sim->>'dataEmissao')::date,
    v_ccb.created_at::date
  );
  v_dias := GREATEST(0, (v_pay_date - v_emission_date));
  v_prazo_dias := GREATEST(30, COALESCE(v_ccb.term_months, 1) * 30);

  -- ========================================================================
  -- SALDO EM ABERTO: parcelas NÃO PAGAS do array `boletos` de recebiveis_ccb.
  -- Parcelas pagas (no vencimento ou antecipadas) NÃO entram no total a pagar.
  -- Sem recebível/boletos (fluxo antigo): cai no valor total da operação.
  -- ========================================================================
  v_principal := COALESCE(v_ccb.requested_value, (v_sim->>'requestedValue')::numeric, 0);

  SELECT * INTO v_rec
  FROM public.recebiveis_ccb
  WHERE ccb_id = p_ccb_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND v_rec.boletos IS NOT NULL AND jsonb_array_length(v_rec.boletos) > 0 THEN
    v_principal := 0;
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(v_rec.boletos)
    LOOP
      v_qtd_boletos := v_qtd_boletos + 1;
      v_boleto_status := LOWER(COALESCE(v_boleto->>'status', ''));
      IF v_boleto_status IN ('pago', 'liquidado') THEN
        v_qtd_pagas := v_qtd_pagas + 1;
        v_total_pago := v_total_pago + COALESCE((v_boleto->>'unit_value')::numeric, 0);
      ELSE
        v_qtd_abertas := v_qtd_abertas + 1;
        v_principal := v_principal + COALESCE((v_boleto->>'unit_value')::numeric, 0);
      END IF;
    END LOOP;
    v_principal_total := v_total_pago + v_principal;
  ELSE
    v_principal_total := v_principal;
  END IF;

  IF v_principal <= 0 THEN
    RAISE EXCEPTION 'Não há parcelas em aberto nesta CCB — nada a quitar';
  END IF;

  -- Juros proporcionais do período decorrido pela taxa do contrato, sobre o SALDO EM ABERTO
  v_juros := ROUND(v_principal * v_taxa_mensal * (LEAST(v_dias, v_prazo_dias)::numeric / 30.0), 2);
  v_base := v_principal + v_juros;

  -- Desconto proporcional à taxa do contrato
  IF p_discount_pct IS NOT NULL THEN
    v_desconto_pct := GREATEST(0, LEAST(p_discount_pct, 100));
    v_desconto := ROUND(v_base * v_desconto_pct / 100.0, 2);
  ELSE
    -- Desconto automático: juros proporcionais do prazo RESTANTE sobre (saldo + juros do período)
    v_desconto_pct := ROUND(v_taxa_mensal * (GREATEST(0, v_prazo_dias - LEAST(v_dias, v_prazo_dias))::numeric / 30.0) * 100.0, 6);
    v_desconto := ROUND(v_base * (v_desconto_pct / 100.0), 2);
  END IF;
  v_desconto := LEAST(v_desconto, v_base);

  -- Taxas INTEGRAIS (nunca recebem desconto): emissão da CCB, análise e abertura de crédito
  v_taxa_emissao := ROUND(COALESCE(
    (v_sim->>'fixed_cost')::numeric,
    (v_sim->>'fixedCost')::numeric,
    (v_sim->>'taxa_emissao')::numeric,
    (v_sim->>'valorTarifas')::numeric,
    0
  ), 2);
  v_taxa_analise := ROUND(COALESCE(
    (v_sim->>'taxa_analise')::numeric,
    (v_sim->>'taxaAnalise')::numeric,
    (v_sim->>'analysis_fee')::numeric,
    0
  ), 2);
  v_taxa_abertura := ROUND(COALESCE(
    (v_sim->>'taxa_abertura')::numeric,
    (v_sim->>'taxaAbertura')::numeric,
    (v_sim->>'opening_fee')::numeric,
    0
  ), 2);
  v_taxas_integrais := v_taxa_emissao + v_taxa_analise + v_taxa_abertura;
  v_taxas_detalhe := jsonb_build_object(
    'taxa_emissao_ccb', v_taxa_emissao,
    'taxa_analise', v_taxa_analise,
    'taxa_abertura_credito', v_taxa_abertura
  );

  v_total := ROUND(v_base - v_desconto + v_taxas_integrais, 2);

  -- Conta bancária do recebimento
  v_bank_id := p_bank_account_id;
  IF v_bank_id IS NULL THEN
    SELECT id INTO v_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
  END IF;

  SELECT document_number INTO v_borrower_doc FROM public.profiles WHERE id = v_ccb.user_id;

  v_ext_ref := 'ccb-quit-' || p_ccb_id::text;
  v_desc := 'Quitação de CCB — ' || COALESCE(v_ccb.borrower_data->>'name', 'Tomador') ||
            ' (CCB ' || substr(p_ccb_id::text, 1, 8) || ')';

  -- ---- 1. Baixa da operação: status 'liquidado' (REGRA PÉTREA: liquidado LIBERA o limite do
  --         tomador; 'pago' consumiria o limite e nunca é usado em quitação total)
  UPDATE public.ccb_solicitacoes
  SET status = 'liquidado',
      liquidation_date = v_pay_date,
      liquidation_value = v_total,
      quitacao = jsonb_build_object(
        'principal_total', v_principal_total,
        'principal_aberto', v_principal,
        'total_pago', v_total_pago,
        'qtd_boletos', v_qtd_boletos,
        'qtd_pagas', v_qtd_pagas,
        'qtd_abertas', v_qtd_abertas,
        'juros_periodo', v_juros,
        'taxa_mensal', v_taxa_mensal,
        'dias_decorridos', v_dias,
        'desconto', v_desconto,
        'desconto_pct', v_desconto_pct,
        'taxas_integrais', v_taxas_integrais,
        'taxas_detalhe', v_taxas_detalhe,
        'total_quitacao', v_total,
        'quitado_por', v_user_id,
        'quitado_em', NOW()
      ),
      updated_at = NOW()
  WHERE id = p_ccb_id;

  -- ---- 2. Entrada no caixa (tesouraria)
  INSERT INTO public.treasury_transactions (
    type, amount, date, description, category, reference_id,
    is_escrow, external_ref, status, bank_account_id, created_by
  )
  VALUES (
    'in', v_total, v_pay_date, v_desc, 'Quitação de CCB', p_ccb_id,
    false, v_ext_ref, 'Confirmado', v_bank_id, v_user_id
  )
  ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE
  SET amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      description = EXCLUDED.description,
      status = 'Confirmado',
      bank_account_id = COALESCE(EXCLUDED.bank_account_id, public.treasury_transactions.bank_account_id);

  -- ---- 3. Livro caixa + mapeamento
  DELETE FROM public.movimentacoes_caixa
  WHERE referencia_id = p_ccb_id AND referencia_tipo = 'ccb_quitacao';

  INSERT INTO public.movimentacoes_caixa (
    tipo, categoria, descricao, valor, saldo_anterior, saldo_novo,
    referencia_id, referencia_tipo, referencia_numero, user_id, created_at, bank_account_id
  )
  VALUES (
    'entrada', 'quitação_ccb', v_desc, v_total, 0, 0,
    p_ccb_id, 'ccb_quitacao', v_ext_ref, v_user_id, NOW(), v_bank_id
  )
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.mapeamento_movimentacoes
    WHERE origem_tabela = 'ccb_solicitacoes' AND origem_id = p_ccb_id;

    INSERT INTO public.mapeamento_movimentacoes (
      movimentacao_caixa_id, origem_tabela, origem_id, sincronizado, user_id, created_at
    )
    VALUES (v_mov_id, 'ccb_solicitacoes', p_ccb_id, true, v_user_id, NOW());
  END IF;

  -- ---- 4. Tarifa PIX automática (anti-duplicidade garantida dentro de apply_pix_fee)
  PERFORM public.apply_pix_fee(
    v_bank_id,
    v_borrower_doc,
    'ccb_quitacao',
    p_ccb_id,
    v_user_id
  );

  -- ---- 5. Auditoria dedicada
  INSERT INTO public.ccb_quitacoes (
    ccb_id, borrower_id, quitado_por, payment_date,
    principal, juros_periodo, taxa_mensal_aplicada, dias_decorridos,
    desconto, desconto_pct, taxas_integrais, taxas_detalhe,
    total_quitacao, bank_account_id, external_ref, notes
  )
  VALUES (
    p_ccb_id, v_ccb.user_id, v_user_id, v_pay_date,
    v_principal, v_juros, v_taxa_mensal, v_dias,
    v_desconto, v_desconto_pct, v_taxas_integrais, v_taxas_detalhe,
    v_total, v_bank_id, v_ext_ref, p_notes
  )
  RETURNING id INTO v_quit_id;

  -- ---- 6. Auditoria geral
  INSERT INTO public.audit_logs (entity_type, entity_id, user_id, action, details)
  VALUES (
    'ccb_solicitacoes',
    p_ccb_id,
    v_user_id,
    'ccb_quitada',
    jsonb_build_object(
      'quitacao_id', v_quit_id,
      'quitado_por', v_user_id,
      'payment_date', v_pay_date,
      'principal_total', v_principal_total,
      'principal_aberto', v_principal,
      'total_pago', v_total_pago,
      'qtd_boletos', v_qtd_boletos,
      'qtd_pagas', v_qtd_pagas,
      'qtd_abertas', v_qtd_abertas,
      'juros_periodo', v_juros,
      'taxa_mensal_aplicada', v_taxa_mensal,
      'dias_decorridos', v_dias,
      'desconto', v_desconto,
      'desconto_pct', v_desconto_pct,
      'taxas_integrais', v_taxas_integrais,
      'taxas_detalhe', v_taxas_detalhe,
      'total_quitacao', v_total,
      'previous_status', v_ccb.status,
      'new_status', 'liquidado',
      'bank_account_id', v_bank_id,
      'external_ref', v_ext_ref
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ccb_id', p_ccb_id,
    'quitacao_id', v_quit_id,
    'payment_date', v_pay_date,
    'principal_total', v_principal_total,
    'principal_aberto', v_principal,
    'total_pago', v_total_pago,
    'qtd_boletos', v_qtd_boletos,
    'qtd_pagas', v_qtd_pagas,
    'qtd_abertas', v_qtd_abertas,
    'juros_periodo', v_juros,
    'taxa_mensal_aplicada', v_taxa_mensal,
    'dias_decorridos', v_dias,
    'desconto', v_desconto,
    'desconto_pct', v_desconto_pct,
    'taxas_integrais', v_taxas_integrais,
    'taxas_detalhe', v_taxas_detalhe,
    'total_quitacao', v_total,
    'new_status', 'liquidado',
    'external_ref', v_ext_ref,
    'bank_account_id', v_bank_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quit_ccb_solicitacao(UUID, DATE, UUID, TEXT, NUMERIC) TO authenticated;
