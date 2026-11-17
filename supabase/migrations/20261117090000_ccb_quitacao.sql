-- 20261117090000_ccb_quitacao.sql
-- Quitação de CCB (solicitações em /admin/ccb-requests)
-- 1. Colunas de baixa em ccb_solicitacoes (liquidation_date, liquidation_value, quitacao jsonb)
-- 2. Tabela de auditoria public.ccb_quitacoes (quem, quando, valores decompostos) com RLS
-- 3. RPC public.quit_ccb_solicitacao — atômica, SECURITY DEFINER:
--    * principal + juros proporcionais do período decorrido pela taxa do contrato (rate_used)
--    * desconto proporcional à taxa do contrato sobre (principal + juros)
--    * taxas de emissão de CCB, análise e abertura de crédito somadas INTEGRAIS (sem desconto)
--    * baixa da operação para 'liquidado' (REGRA PÉTREA: liquidado libera limite; pago consome)
--    * entrada no caixa (treasury_transactions + movimentacoes_caixa + mapeamento)
--    * tarifa PIX automática via apply_pix_fee (anti-duplicidade própria da função)
--    * auditoria em ccb_quitacoes e audit_logs

-- ============================================================================
-- 1. COLUNAS DE BAIXA EM ccb_solicitacoes
-- ============================================================================
ALTER TABLE public.ccb_solicitacoes
  ADD COLUMN IF NOT EXISTS liquidation_date DATE,
  ADD COLUMN IF NOT EXISTS liquidation_value NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS quitacao JSONB;

-- ============================================================================
-- 2. TABELA DE AUDITORIA public.ccb_quitacoes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ccb_quitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccb_id UUID NOT NULL REFERENCES public.ccb_solicitacoes(id) ON DELETE CASCADE,
  borrower_id UUID,
  quitado_por UUID REFERENCES public.profiles(id),
  quitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_date DATE NOT NULL,
  principal NUMERIC(18,2) NOT NULL DEFAULT 0,
  juros_periodo NUMERIC(18,2) NOT NULL DEFAULT 0,
  taxa_mensal_aplicada NUMERIC(10,6) NOT NULL DEFAULT 0,
  dias_decorridos INTEGER NOT NULL DEFAULT 0,
  desconto NUMERIC(18,2) NOT NULL DEFAULT 0,
  desconto_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  taxas_integrais NUMERIC(18,2) NOT NULL DEFAULT 0,
  taxas_detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_quitacao NUMERIC(18,2) NOT NULL DEFAULT 0,
  bank_account_id UUID,
  external_ref TEXT,
  notes TEXT
);

ALTER TABLE public.ccb_quitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccb_quitacoes_admin_select" ON public.ccb_quitacoes;
CREATE POLICY "ccb_quitacoes_admin_select"
  ON public.ccb_quitacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (COALESCE(p.is_admin, false) OR COALESCE(p.is_staff, false) OR p.role IN ('admin','staff'))
    )
  );

DROP POLICY IF EXISTS "ccb_quitacoes_admin_insert" ON public.ccb_quitacoes;
CREATE POLICY "ccb_quitacoes_admin_insert"
  ON public.ccb_quitacoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (COALESCE(p.is_admin, false) OR COALESCE(p.is_staff, false) OR p.role IN ('admin','staff'))
    )
  );

CREATE INDEX IF NOT EXISTS idx_ccb_quitacoes_ccb ON public.ccb_quitacoes(ccb_id);

-- ============================================================================
-- 3. RPC public.quit_ccb_solicitacao
--    p_discount_pct: opcional (% sobre principal+juros). NULL = desconto automático
--    proporcional à taxa do contrato pelo prazo restante.
-- ============================================================================
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
  v_sim JSONB;
  v_taxa_mensal NUMERIC;        -- decimal (0.027 = 2,7% a.m.)
  v_principal NUMERIC;
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
  v_principal := COALESCE(v_ccb.requested_value, (v_sim->>'requestedValue')::numeric, 0);
  IF v_principal <= 0 THEN
    RAISE EXCEPTION 'Valor principal da CCB inválido';
  END IF;

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

  -- Juros proporcionais do período decorrido pela taxa do contrato
  v_juros := ROUND(v_principal * v_taxa_mensal * (LEAST(v_dias, v_prazo_dias)::numeric / 30.0), 2);
  v_base := v_principal + v_juros;

  -- Desconto proporcional à taxa do contrato
  IF p_discount_pct IS NOT NULL THEN
    v_desconto_pct := GREATEST(0, LEAST(p_discount_pct, 100));
    v_desconto := ROUND(v_base * v_desconto_pct / 100.0, 2);
  ELSE
    -- Desconto automático: juros proporcionais do prazo RESTANTE sobre (principal + juros do período)
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
        'principal', v_principal,
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

  -- ---- 4. Tarifa PIX automática (anti-duplicidade garantida dentro de apply_pix_fee;
  --         não lança tarifa duplicada da quitação)
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
      'principal', v_principal,
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
    'principal', v_principal,
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
