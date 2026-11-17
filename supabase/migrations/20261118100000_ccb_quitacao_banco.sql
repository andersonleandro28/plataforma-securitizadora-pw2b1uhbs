-- 20261118100000_ccb_quitacao_banco.sql
-- QUITAÇÃO ANTECIPADA DE CCB PELO MÉTODO BANCÁRIO (valor presente parcela a parcela)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- A fórmula anterior (migração 20261117090000) fazia:
--     juros  = saldo_aberto × taxa × (dias decorridos / 30)
--     base   = saldo_aberto + juros
--     desconto = base × taxa × (prazo_restante / 30)
--     total  = base - desconto + taxas
--
-- Três erros conceituais nisso:
--
-- 1. O saldo em aberto do boleto já é a soma das parcelas contratadas. Somar
--    "juros do período decorrido" sobre esse valor cobra juros duas vezes.
-- 2. Descontar "juros do prazo restante" calculado sobre (principal + juros) é
--    uma aproximação linear. Juros não são lineares: são compostos.
-- 3. A conta é feita sobre o contrato inteiro, e não sobre cada parcela. Numa
--    CCB com parcelas em datas diferentes, isso distorce o resultado.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O MÉTODO CORRETO (o que os bancos usam)
-- ─────────────────────────────────────────────────────────────────────────────
-- Quitação antecipada = valor presente de cada parcela em aberto, descontada
-- pela taxa do próprio contrato até a data do pagamento. É o critério da
-- Resolução BCB 3.919/2010, art. 8º (liquidação antecipada exige o valor
-- presente das parcelas com a mesma taxa da contratação) e a prática padrão
-- em CCB e consignado.
--
--     VP_k = parcela_k / (1 + i)^(dias_k / 30)
--
--     i      = taxa mensal do contrato (decimal)
--     dias_k = dias entre a data do pagamento e o vencimento da parcela k
--
-- Parcela ATRASADA (vencimento anterior ao pagamento) não recebe desconto:
-- ela é cobrada pelo valor original ACRESCIDA de mora (multa + juros de mora
-- pro rata die), que é o que o contrato prevê em caso de atraso.
--
-- Deságio concedido = Σ (parcela_k − VP_k) das parcelas ainda não vencidas.
-- É esse número que aparece na tela como "desconto", e é informação real.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PONTO DE DECISÃO DO NEGÓCIO (mantido explícito, não decidido aqui)
-- ─────────────────────────────────────────────────────────────────────────────
-- A versão anterior somava as taxas (emissão, análise, abertura) INTEGRAIS ao
-- pagamento da quitação. Verifiquei que o simulador (calculate-operation) já
-- desconta essas mesmas taxas na liberação do crédito — structuring_val,
-- analysis_val, ad_valorem_val. Se elas já foram descontadas na originação,
-- cobrá-las de novo na quitação é cobrança em duplicidade.
--
-- Por isso o comportamento passou a ser um PARÂMETRO (p_taxas_modo):
--   'cobrar'   → soma as taxas (comportamento anterior, mantido)
--   'nao_cobrar' → não soma (evita duplicidade)
--   NULL       → 'cobrar', preservando o comportamento atual em produção
-- A decisão é do dono; o padrão não muda o que já acontece hoje.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE NÃO MUDA (deliberadamente)
-- ─────────────────────────────────────────────────────────────────────────────
-- Status 'liquidado' (libera limite), entrada no caixa, livro caixa,
-- mapeamento, tarifa PIX, auditoria em ccb_quitacoes e audit_logs,
-- anti-re-quitação e trava de operação excluída: tudo idêntico.

CREATE OR REPLACE FUNCTION public.quit_ccb_solicitacao(
  p_ccb_id UUID,
  p_payment_date DATE DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_discount_pct NUMERIC DEFAULT NULL,
  p_taxas_modo TEXT DEFAULT NULL
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

  v_taxa_mensal NUMERIC;          -- decimal (0.027 = 2,7% a.m.)
  v_pay_date DATE;
  v_principal_total NUMERIC := 0; -- soma de todas as parcelas (auditoria)
  v_principal NUMERIC := 0;       -- soma do valor de face das parcelas em aberto
  v_total_pago NUMERIC := 0;      -- soma das parcelas já pagas
  v_qtd_boletos INTEGER := 0;
  v_qtd_pagas INTEGER := 0;
  v_qtd_abertas INTEGER := 0;

  v_vp NUMERIC := 0;              -- soma dos valores presentes
  v_desagio NUMERIC := 0;         -- juros não incorridos (informativo)
  v_mora NUMERIC := 0;            -- multa + juros de mora de parcelas vencidas
  v_qtd_vencidas INTEGER := 0;

  v_desconto NUMERIC := 0;
  v_desconto_pct NUMERIC := 0;
  v_base NUMERIC;
  v_taxa_emissao NUMERIC := 0;
  v_taxa_analise NUMERIC := 0;
  v_taxa_abertura NUMERIC := 0;
  v_taxas_integrais NUMERIC := 0;
  v_taxas_modo TEXT;
  v_total NUMERIC;

  v_bank_id UUID;
  v_borrower_doc TEXT;
  v_ext_ref TEXT;
  v_desc TEXT;
  v_mov_id UUID;
  v_quit_id UUID;
  v_taxas_detalhe JSONB;
  v_status_atual TEXT;
  v_parcelas_detalhe JSONB := '[]'::jsonb;

  -- mora padrão (o contrato não traz multa/encargo por boleto; usar o usual)
  v_multa_pct NUMERIC := 2.0;     -- 2% sobre a parcela em atraso
  v_mora_mensal NUMERIC := 1.0;   -- 1% a.m. pro rata

  v_dias_ate INT;
  v_face NUMERIC;
  v_vp_item NUMERIC;
  v_item JSONB;
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

  -- Taxa mensal do contrato: prioriza rate_used (decimal); fallback em %.
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

  SELECT * INTO v_rec
  FROM public.recebiveis_ccb
  WHERE ccb_id = p_ccb_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- ==========================================================================
  -- SEM BOLETOS: fluxo antigo. Mantém o comportamento anterior (uma parcela
  -- única no vencimento final), agora pelo método de valor presente.
  -- ==========================================================================
  IF NOT FOUND OR v_rec.boletos IS NULL OR jsonb_array_length(v_rec.boletos) = 0 THEN
    v_principal := COALESCE(v_ccb.requested_value, (v_sim->>'requestedValue')::numeric, 0);
    IF v_principal <= 0 THEN
      RAISE EXCEPTION 'Valor principal da CCB inválido';
    END IF;

    v_principal_total := v_principal;
    v_qtd_abertas := 1;

    -- Sem data de vencimento confiável, trata como parcela única no prazo do
    -- contrato: o valor presente usa os meses restantes até o fim do prazo.
    DECLARE
      v_emissao DATE := COALESCE(
        (v_sim->>'first_due_date')::date,
        (v_sim->>'dataEmissao')::date,
        v_ccb.created_at::date
      );
      v_prazo_meses NUMERIC := GREATEST(1, COALESCE(v_ccb.term_months, 1));
      v_decorridos NUMERIC := GREATEST(0, (v_pay_date - v_emissao))::numeric / 30.0;
      v_restantes NUMERIC := GREATEST(0, v_prazo_meses - v_decorridos);
    BEGIN
      v_vp := ROUND(v_principal / POWER(1 + v_taxa_mensal, v_restantes), 2);
      v_desagio := ROUND(v_principal - v_vp, 2);
    END;
  ELSE
    -- ========================================================================
    -- COM BOLETOS: valor presente parcela a parcela.
    -- ========================================================================
    FOR v_boleto IN SELECT * FROM jsonb_array_elements(v_rec.boletos)
    LOOP
      v_qtd_boletos := v_qtd_boletos + 1;
      v_face := COALESCE((v_boleto->>'unit_value')::numeric, 0);
      v_principal_total := v_principal_total + v_face;

      IF LOWER(COALESCE(v_boleto->>'status', '')) IN ('pago', 'liquidado') THEN
        v_qtd_pagas := v_qtd_pagas + 1;
        v_total_pago := v_total_pago + v_face;
        CONTINUE;
      END IF;

      v_qtd_abertas := v_qtd_abertas + 1;
      v_principal := v_principal + v_face;

      -- Sem vencimento não há como descontar: cobra o valor de face.
      IF (v_boleto->>'due_date') IS NULL THEN
        v_vp := v_vp + v_face;
        CONTINUE;
      END IF;

      v_dias_ate := ((v_boleto->>'due_date')::date - v_pay_date);
      v_vp_item := 0;

      IF v_dias_ate >= 0 THEN
        -- Parcela a vencer: desconto a valor presente pela taxa do contrato.
        v_vp_item := ROUND(
          v_face / POWER(1 + v_taxa_mensal, v_dias_ate::numeric / 30.0),
          2
        );
        v_desagio := v_desagio + (v_face - v_vp_item);
      ELSE
        -- Parcela vencida: cobra face + mora, sem desconto.
        v_qtd_vencidas := v_qtd_vencidas + 1;
        DECLARE
          v_atraso INTEGER := ABS(v_dias_ate);
          v_mora_item NUMERIC;
        BEGIN
          v_mora_item := ROUND(
            (v_face * v_multa_pct / 100.0)
            + (v_face * v_mora_mensal / 100.0 * (v_atraso::numeric / 30.0)),
            2
          );
          v_mora := v_mora + v_mora_item;
          v_vp_item := ROUND(v_face + v_mora_item, 2);
        END;
      END IF;

      v_vp := v_vp + v_vp_item;

      v_item := jsonb_build_object(
        'vencimento', (v_boleto->>'due_date'),
        'valor_face', v_face,
        'dias_ate_vencimento', v_dias_ate,
        'valor_presente', v_vp_item,
        'vencida', v_dias_ate < 0
      );
      v_parcelas_detalhe := v_parcelas_detalhe || jsonb_build_array(v_item);
    END LOOP;

    IF v_qtd_abertas = 0 THEN
      RAISE EXCEPTION 'Não há parcelas em aberto nesta CCB — nada a quitar';
    END IF;
    IF v_principal <= 0 THEN
      RAISE EXCEPTION 'Saldo em aberto inválido para quitação';
    END IF;
  END IF;

  v_desagio := ROUND(GREATEST(v_desagio, 0), 2);
  v_mora := ROUND(v_mora, 2);
  v_vp := ROUND(v_vp, 2);

  -- ==========================================================================
  -- DESCONTO
  --
  -- ATENÇÃO — erro que já existiu aqui e não pode voltar:
  -- o deságio (juros futuros) JÁ ESTÁ embutido no valor presente. Subtraí-lo
  -- uma segunda vez do VP desconta duas vezes e cobra menos do que o contrato
  -- permite. Por isso:
  --
  --   total = valor_presente − desconto_comercial + taxas
  --
  -- e v_desconto só carrega um desconto COMERCIAL adicional (p_discount_pct).
  -- O deságio continua exposto no retorno e na auditoria como informação, mas
  -- NÃO entra na aritmética.
  -- ==========================================================================
  v_base := v_vp;
  IF p_discount_pct IS NOT NULL THEN
    v_desconto_pct := GREATEST(0, LEAST(p_discount_pct, 100));
    v_desconto := ROUND(v_base * v_desconto_pct / 100.0, 2);
  ELSE
    v_desconto := 0;
    v_desconto_pct := 0;
  END IF;

  -- Taxas integrais (emissão, análise, abertura)
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

  v_taxas_modo := COALESCE(LOWER(p_taxas_modo), 'cobrar');
  IF v_taxas_modo = 'nao_cobrar' THEN
    v_taxas_integrais := 0;
  ELSE
    v_taxas_integrais := v_taxa_emissao + v_taxa_analise + v_taxa_abertura;
  END IF;

  v_taxas_detalhe := jsonb_build_object(
    'taxa_emissao_ccb', v_taxa_emissao,
    'taxa_analise', v_taxa_analise,
    'taxa_abertura_credito', v_taxa_abertura,
    'modo', v_taxas_modo
  );

  v_total := ROUND(v_base - v_desconto + v_taxas_integrais, 2);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Valor de quitação calculado ficou negativo — revisar os dados da CCB';
  END IF;

  v_bank_id := p_bank_account_id;
  IF v_bank_id IS NULL THEN
    SELECT id INTO v_bank_id FROM public.company_bank_accounts WHERE is_active = true LIMIT 1;
  END IF;

  SELECT document_number INTO v_borrower_doc FROM public.profiles WHERE id = v_ccb.user_id;

  v_ext_ref := 'ccb-quit-' || p_ccb_id::text;
  v_desc := 'Quitação de CCB — ' || COALESCE(v_ccb.borrower_data->>'name', 'Tomador') ||
            ' (CCB ' || substr(p_ccb_id::text, 1, 8) || ')';

  -- ---- 1. Baixa da operação (liquidado libera o limite do tomador)
  UPDATE public.ccb_solicitacoes
  SET status = 'liquidado',
      liquidation_date = v_pay_date,
      liquidation_value = v_total,
      quitacao = jsonb_build_object(
        'metodo', 'valor_presente_parcela',
        'taxa_mensal', v_taxa_mensal,
        'principal_total', v_principal_total,
        'principal_aberto', v_principal,
        'total_pago', v_total_pago,
        'qtd_boletos', v_qtd_boletos,
        'qtd_pagas', v_qtd_pagas,
        'qtd_abertas', v_qtd_abertas,
        'qtd_vencidas', v_qtd_vencidas,
        'valor_presente', v_vp,
        'desagio', v_desagio,
        'mora', v_mora,
        'desconto', v_desconto,
        'desconto_pct', v_desconto_pct,
        'taxas_integrais', v_taxas_integrais,
        'taxas_detalhe', v_taxas_detalhe,
        'parcelas', v_parcelas_detalhe,
        'total_quitacao', v_total,
        'quitado_por', v_user_id,
        'quitado_em', NOW()
      ),
      updated_at = NOW()
  WHERE id = p_ccb_id;

  -- ---- 2. Entrada no caixa
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

  -- ---- 4. Tarifa PIX
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
    v_principal,
    v_mora,                    -- no método VP, "juros do período" = mora cobrada
    v_taxa_mensal,
    COALESCE((v_pay_date - COALESCE(
      (v_sim->>'first_due_date')::date, (v_sim->>'dataEmissao')::date, v_ccb.created_at::date
    )), 0),
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
      'metodo', 'valor_presente_parcela',
      'quitacao_id', v_quit_id,
      'quitado_por', v_user_id,
      'payment_date', v_pay_date,
      'taxa_mensal_aplicada', v_taxa_mensal,
      'principal_aberto', v_principal,
      'valor_presente', v_vp,
      'desagio', v_desagio,
      'mora', v_mora,
      'desconto_comercial', v_desconto,
      'desconto_pct', v_desconto_pct,
      'taxas_integrais', v_taxas_integrais,
      'taxas_modo', v_taxas_modo,
      'total_quitacao', v_total,
      'parcelas', v_parcelas_detalhe,
      'previous_status', v_ccb.status,
      'new_status', 'liquidado',
      'external_ref', v_ext_ref
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'metodo', 'valor_presente_parcela',
    'ccb_id', p_ccb_id,
    'quitacao_id', v_quit_id,
    'payment_date', v_pay_date,
    'taxa_mensal_aplicada', v_taxa_mensal,
    'principal_total', v_principal_total,
    'principal_aberto', v_principal,
    'total_pago', v_total_pago,
    'qtd_boletos', v_qtd_boletos,
    'qtd_pagas', v_qtd_pagas,
    'qtd_abertas', v_qtd_abertas,
    'qtd_vencidas', v_qtd_vencidas,
    'valor_presente', v_vp,
    'desagio', v_desagio,
    'mora', v_mora,
    'desconto', v_desconto,
    'desconto_pct', v_desconto_pct,
    'taxas_integrais', v_taxas_integrais,
    'taxas_modo', v_taxas_modo,
    'parcelas', v_parcelas_detalhe,
    'total_quitacao', v_total,
    'new_status', 'liquidado',
    'external_ref', v_ext_ref,
    'bank_account_id', v_bank_id
  );
END;
$$;

-- A versão de 5 parâmetros (usada pelo front já publicado) é recriada como
-- wrapper na migration 20261118100100, apontando para esta implementação.
-- Sem esse wrapper, a quitação quebraria em produção no intervalo entre o
-- deploy do banco e o deploy do app.
GRANT EXECUTE ON FUNCTION public.quit_ccb_solicitacao(UUID, DATE, UUID, TEXT, NUMERIC, TEXT) TO authenticated;
