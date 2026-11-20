import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Edge function de DIAGNÓSTICO (somente leitura): reproduz o pipeline COMPLETO
// do motor contábil (src/lib/accounting-ledger.ts) — passos 3 a 8 + loop de
// saldos, regra por regra — e devolve os saldos por conta bancária, a
// decomposição por fonte, os lançamentos da BNK em novembro/2026 e o DUMP
// BRUTO das fontes (tts, movs, ops, reds, exps, recs, subs, invs, bancos,
// mapeamentos) para validação do cálculo fora do navegador. NÃO escreve nada
// no banco.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function classifyMovCaixa(tipo: unknown): 'in' | 'out' {
  return normalizeType(tipo) === 'entrada' ? 'in' : 'out'
}

function isTaxProvision(tx: Record<string, unknown>): boolean {
  const extRef = String(tx.external_ref ?? '')
    .toLowerCase()
    .trim()
  if (extRef.startsWith('tax-redemption-') || extRef.startsWith('tax-redemption')) return true
  const desc = String(tx.description ?? '')
    .toLowerCase()
    .trim()
  if (desc.includes('imposto a recolher') && (desc.includes('irrf') || desc.includes('resgate')))
    return true
  const cat = String(tx.category ?? '')
    .toLowerCase()
    .trim()
  if (
    cat.includes('impostos e taxas') &&
    (desc.includes('resgate') || extRef.includes('redemption'))
  )
    return true
  return false
}

function normDate(value: unknown): string {
  if (!value) return new Date().toISOString().split('T')[0]
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]
  return d.toISOString().split('T')[0]
}

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const [subsRes, recsRes, expsRes, opsRes, redsRes, movsRes, ttRes, banksRes, mapRes] =
    await Promise.all([
      db
        .from('debenture_subscriptions')
        .select('id, total_amount, status, deleted_at, investment_id'),
      db.from('recebiveis_ccb').select('id, acquisition_value, created_at, boletos, ccb_id'),
      db
        .from('expenses')
        .select(
          'id, amount, description, payment_date, due_date, status, bank_account_id, category, recurrence_group_id',
        ),
      db
        .from('credit_operations')
        .select('id, requested_value, status, issue_date, operation_calculations(net_value)'),
      db.from('investment_redemptions').select('id, net_value, updated_at, created_at, status'),
      db
        .from('movimentacoes_caixa')
        .select(
          'id, tipo, categoria, descricao, valor, user_id, created_at, referencia_id, referencia_tipo, referencia_numero, bank_account_id, deleted_at',
        ),
      db
        .from('treasury_transactions')
        .select(
          'id, type, category, amount, description, date, external_ref, expense_id, bank_account_id, created_by, referencia_tipo, reference_id, status, is_escrow, deleted_at',
        ),
      db.from('company_bank_accounts').select('id, bank_name, branch, account_number, is_active'),
      db.from('mapeamento_movimentacoes').select('movimentacao_caixa_id, origem_tabela, origem_id'),
    ])

  const exps = (expsRes.data ?? []) as Record<string, unknown>[]
  const ops = (opsRes.data ?? []) as Record<string, unknown>[]
  const reds = (redsRes.data ?? []) as Record<string, unknown>[]
  // Ledger real filtra movs com .is('deleted_at', null) na query.
  const movs = ((movsRes.data ?? []) as Record<string, unknown>[]).filter((m) => !m.deleted_at)
  const ttAll = (ttRes.data ?? []) as Record<string, unknown>[]
  const companyBanks = (banksRes.data ?? []) as Record<string, unknown>[]
  const mapMovs = (mapRes.data ?? []) as Record<string, unknown>[]
  const recs = (recsRes.data ?? []) as Record<string, unknown>[]
  const subs = (subsRes.data ?? []) as Record<string, unknown>[]
  const invs = [] as Record<string, unknown>[]
  const tt = ttAll.filter((tx) => {
    if (tx.deleted_at) return false
    const st = tx.status == null ? null : String(tx.status)
    if (st !== 'Confirmado' && st !== null) return false
    const CATS = [
      'Recebimento de Parcelas - CCB',
      'Recebimento de Parcelas - Operação',
      'Liquidação de Recebível',
      'Resgate de Investidor',
      'Resgates e Rendimentos',
      'Receita Avulsa',
      'Crédito em Conta',
      'Receitas Diversas',
      'Aporte de Capital',
      'Rendimento Financeiro',
      'Reembolso',
    ]
    const ref = tx.external_ref ? String(tx.external_ref) : ''
    return CATS.includes(String(tx.category)) || ref.startsWith('manual-credit-')
  })

  const ttExpenseIds = new Set<string>(
    tt
      .filter((tx) => (!tx.status || tx.status === 'Confirmado') && tx.expense_id)
      .map((tx) => String(tx.expense_id)),
  )

  const expenseMap = new Map<string, { payment_date: unknown; due_date: unknown; status: string }>()
  exps.forEach((e) =>
    expenseMap.set(String(e.id), {
      payment_date: e.payment_date,
      due_date: e.due_date,
      status: String(e.status ?? ''),
    }),
  )

  const redemptionMap = new Map<
    string,
    { updated_at: unknown; created_at: unknown; status: string }
  >()
  reds.forEach((r) =>
    redemptionMap.set(String(r.id), {
      updated_at: r.updated_at,
      created_at: r.created_at,
      status: String(r.status ?? ''),
    }),
  )

  const movIdToExpenseId = new Map<string, string>()
  mapMovs.forEach((m) => {
    if (
      m.movimentacao_caixa_id &&
      m.origem_id &&
      (m.origem_tabela === 'fornecedores' || m.origem_tabela === 'despesas')
    ) {
      movIdToExpenseId.set(String(m.movimentacao_caixa_id), String(m.origem_id))
    }
  })

  const bankMap = new Map<string, Record<string, unknown>>()
  companyBanks.forEach((b) => bankMap.set(String(b.id), b))

  const resolveBank = (id?: unknown) => {
    const key = id == null ? null : String(id)
    if (key && bankMap.has(key)) return { id: key }
    return { id: null }
  }

  const MIRROR_REF = /^(ccb-bol|op-bol|op-liq|redemption|tax-redemption)-/

  type Tx = {
    id: string
    date: string
    type: 'in' | 'out'
    category: string
    description: string
    value: number
    is_bank_mirror: boolean
    dedup_suppressed?: boolean
    bank_account_id: string | null
    ref?: string | null
  }
  const transactions: Tx[] = []

  // Passo 3: tesouraria
  const movsExternalRefs = new Map<string, 'in' | 'out'>()
  movs.forEach((m) => {
    if (!m.referencia_id) return
    const flow = classifyMovCaixa(m.tipo)
    const refs = [`op-liq-${m.referencia_id}`, `redemption-${m.referencia_id}`]
    if (m.referencia_numero) {
      refs.push(`op-bol-${m.referencia_id}-${m.referencia_numero}`)
      refs.push(`ccb-bol-${m.referencia_id}-${m.referencia_numero}`)
      refs.push(String(m.referencia_numero))
    }
    refs.forEach((r) => {
      if (!movsExternalRefs.has(r)) movsExternalRefs.set(r, flow)
    })
  })

  const treasuryExternalRefs = new Set<string>()
  const treasuryRefTypes = new Map<string, { type: 'in' | 'out'; value: number; date: string }>()
  tt.forEach((tx) => {
    if (isTaxProvision(tx)) return
    const txType: 'in' | 'out' = tx.type === 'out' ? 'out' : 'in'
    const ref = tx.external_ref ? String(tx.external_ref) : null
    if (ref) {
      const redRefMatch = ref.match(/^(?:redemption|tax-redemption)-(.+)$/)
      if (redRefMatch) {
        const redStatus = redemptionMap.get(redRefMatch[1])?.status
        if (redStatus !== 'paid') return
      }
      const movFlow = movsExternalRefs.get(ref)
      if (movFlow && movFlow === txType) {
        if (!treasuryRefTypes.has(ref)) {
          treasuryRefTypes.set(ref, {
            type: txType,
            value: Number(tx.amount || 0),
            date: normDate(tx.date),
          })
        }
        return
      }
      if (treasuryExternalRefs.has(ref)) return
      treasuryExternalRefs.add(ref)
      if (!treasuryRefTypes.has(ref)) {
        treasuryRefTypes.set(ref, {
          type: txType,
          value: Number(tx.amount || 0),
          date: normDate(tx.date),
        })
      }
    }
    const b = resolveBank(tx.bank_account_id)
    transactions.push({
      id: `tt-${tx.id}`,
      date: normDate(tx.date),
      type: txType,
      category: String(
        tx.category ||
          (txType === 'out' ? 'Resgate de Investidor' : 'Recebimento de Parcelas - CCB'),
      ),
      description: String(tx.description ?? ''),
      value: Number(tx.amount || 0),
      is_bank_mirror: Boolean(ref && MIRROR_REF.test(ref)),
      bank_account_id: b.id,
      ref,
    })
  })

  const recebivelParcelaRefs = new Map<string, Set<string>>()
  recs.forEach((rec) => {
    const bols = Array.isArray(rec.boletos) ? (rec.boletos as Record<string, unknown>[]) : []
    const refs = new Set<string>()
    bols.forEach((bol, i) => {
      const st = String(bol.status ?? '').toLowerCase()
      if (st !== 'pago' && st !== 'liquidado') return
      refs.add(`ccb-bol-${rec.id}-${i + 1}`)
      refs.add(`op-bol-${rec.id}-${i + 1}`)
    })
    if (refs.size > 0) recebivelParcelaRefs.set(String(rec.id), refs)
  })

  const opIdToRecIds = new Map<string, string[]>()
  recs.forEach((rec) => {
    if (rec.ccb_id) {
      const key = String(rec.ccb_id)
      const list = opIdToRecIds.get(key) || []
      list.push(String(rec.id))
      opIdToRecIds.set(key, list)
    }
  })

  recs.forEach((rec) => {
    const bols = Array.isArray(rec.boletos) ? (rec.boletos as Record<string, unknown>[]) : []
    const prof = rec.profiles as Record<string, unknown> | undefined
    const tomador = String(
      (prof?.pj_company_name as string) ?? (prof?.full_name as string) ?? 'Desconhecido',
    )
    bols.forEach((bol, i) => {
      const st = String(bol.status ?? '').toLowerCase()
      if (st !== 'pago' && st !== 'liquidado') return
      const pDate =
        bol.data_pagamento ??
        bol.payment_date ??
        bol.data_liquidacao ??
        bol.data_vencimento ??
        bol.due_date
      if (!pDate) return
      const parcela = i + 1
      const extRef = bol.external_ref ? String(bol.external_ref) : `ccb-bol-${rec.id}-${parcela}`
      const altRef = `op-bol-${rec.id}-${parcela}`
      if (treasuryExternalRefs.has(extRef) || treasuryExternalRefs.has(altRef)) return
      const val =
        Number(bol.valor ?? bol.unit_value ?? 0) +
        Number(bol.interest_applied ?? 0) +
        Number(bol.penalty_applied ?? 0)
      if (!val) return
      treasuryExternalRefs.add(extRef)
      treasuryExternalRefs.add(altRef)
      const dataPagBoleto = normDate(pDate)
      treasuryRefTypes.set(extRef, { type: 'in', value: val, date: dataPagBoleto })
      treasuryRefTypes.set(altRef, { type: 'in', value: val, date: dataPagBoleto })
      const b = resolveBank(bol.bank_account_id)
      transactions.push({
        id: `ccb-bol-${rec.id}-${parcela}`,
        date: dataPagBoleto,
        type: 'in',
        category: 'Recebimento de Parcelas - CCB',
        description: `Recebimento Parcela ${bol.numero ?? bol.number ?? parcela} - CCB nº ${String(rec.ccb_id ?? rec.id).slice(0, 8)} - Tomador: ${tomador}`,
        value: val,
        is_bank_mirror: true,
        bank_account_id: b.id,
        ref: extRef,
      })
    })
  })

  exps.forEach((exp) => {
    if (String(exp.status) === 'paid') {
      if (exp.recurrence_group_id && !exp.payment_date) return
      const b = resolveBank(exp.bank_account_id)
      if (exp.id && ttExpenseIds.has(String(exp.id))) return
      transactions.push({
        id: `exp-${exp.id}`,
        date: normDate(exp.payment_date ?? exp.due_date),
        type: 'out',
        category: 'Despesa',
        description: String(exp.description ?? 'Despesa'),
        value: Number(exp.amount || 0),
        is_bank_mirror: false,
        bank_account_id: b.id,
        ref: null,
      })
    }
  })

  ops.forEach((op) => {
    if (['pago', 'liquidado'].includes(String(op.status ?? ''))) {
      const calc = Array.isArray(op.operation_calculations)
        ? (op.operation_calculations as Record<string, unknown>[])[0]
        : op.operation_calculations
      const val = Number((calc?.net_value as number) ?? op.requested_value ?? 0)
      const b = resolveBank(null)
      transactions.push({
        id: `op-out-${op.id}`,
        date: normDate(op.issue_date),
        type: 'out',
        category: 'Desembolso de Crédito',
        description: `Operação de Crédito — Sacado: ${String(op.sacado ?? 'Sacado')}`,
        value: val,
        is_bank_mirror: false,
        bank_account_id: b.id,
        ref: null,
      })
    }
  })

  reds.forEach((red) => {
    if (String(red.status) === 'paid') {
      if (treasuryExternalRefs.has(`redemption-${red.id}`)) return
      const movDaRed = movs.find(
        (m) =>
          String(m.referencia_id) === String(red.id) &&
          String(m.referencia_tipo ?? '').toLowerCase() === 'resgate_investimento',
      )
      const ttDaRed = tt.find((tx) => String(tx.external_ref ?? '') === `redemption-${red.id}`)
      const b = resolveBank(movDaRed?.bank_account_id || ttDaRed?.bank_account_id || null)
      transactions.push({
        id: `red-${red.id}`,
        date: normDate(red.updated_at ?? red.created_at),
        type: 'out',
        category: 'Resgate de Investimento',
        description: 'Resgate',
        value: Number(red.net_value ?? 0),
        is_bank_mirror: true,
        bank_account_id: b.id,
        ref: `redemption-${red.id}`,
      })
    }
  })

  const categoriaLabel: Record<string, string> = {
    liquidação_recebível: 'Liquidação de Recebível',
    liquidacao_recebivel: 'Liquidação de Recebível',
    juros_entrada: 'Juros Recebidos',
    transferencia_entre_contas: 'Transferência entre Contas',
    fornecedor: 'Pagamento Fornecedor',
    despesa: 'Despesa Operacional',
  }

  movs.forEach((mov) => {
    const catLower = String(mov.categoria ?? '').toLowerCase()
    const refTipo = String(mov.referencia_tipo ?? '').toLowerCase()
    let dedupSuppressed = false
    const linkedExpenseId =
      movIdToExpenseId.get(String(mov.id)) ?? (refTipo === 'despesa' ? mov.referencia_id : null)
    if (linkedExpenseId && expenseMap.has(String(linkedExpenseId))) dedupSuppressed = true
    if (catLower === 'fornecedor' || catLower === 'despesa') {
      if (linkedExpenseId || (mov.referencia_id && expenseMap.has(String(mov.referencia_id)))) {
        dedupSuppressed = true
      }
    }
    if (refTipo === 'resgate_investimento' && mov.referencia_id) return
    let effectiveDate = normDate(mov.created_at)
    if (
      refTipo === 'resgate_investimento' &&
      mov.referencia_id &&
      redemptionMap.has(String(mov.referencia_id))
    ) {
      const red = redemptionMap.get(String(mov.referencia_id))!
      effectiveDate = normDate(red.updated_at ?? red.created_at)
    }
    const type = classifyMovCaixa(mov.tipo)
    if (mov.referencia_id) {
      const rid = String(mov.referencia_id)
      const recIdsDaOperacao = opIdToRecIds.get(rid) || []
      // FONTE ÚNICA — parcela de OPERAÇÃO espelhada na tesouraria (mesma
      // correção do accounting-ledger.ts 0.0.1223): o tt op-bol-{op}-{n} é
      // descartado no passo 3, logo a mov é a ÚNICA fonte do evento.
      const refEspelhoOperacao =
        refTipo === 'parcela_operacao' && mov.referencia_numero
          ? `op-bol-${rid}-${mov.referencia_numero}`
          : null
      const ttEspelhoPresente = refEspelhoOperacao
        ? treasuryRefTypes.get(refEspelhoOperacao)?.type === type
        : false
      const refsCandidatas = [`op-liq-${rid}`, `redemption-${rid}`]
      recIdsDaOperacao.forEach((recId) => {
        refsCandidatas.push(`op-liq-${recId}`, `redemption-${recId}`)
      })
      if (mov.referencia_numero) {
        refsCandidatas.push(`op-bol-${rid}-${mov.referencia_numero}`)
        refsCandidatas.push(`ccb-bol-${rid}-${mov.referencia_numero}`)
        recIdsDaOperacao.forEach((recId) => {
          refsCandidatas.push(`op-bol-${recId}-${mov.referencia_numero}`)
          refsCandidatas.push(`ccb-bol-${recId}-${mov.referencia_numero}`)
        })
      }
      const mesmoSentidoExato =
        !ttEspelhoPresente && refsCandidatas.some((ref) => treasuryRefTypes.get(ref)?.type === type)
      let casouPorIndice = false
      if (!mesmoSentidoExato && !ttEspelhoPresente) {
        const conjuntos = [recebivelParcelaRefs.get(rid)]
        recIdsDaOperacao.forEach((recId) => conjuntos.push(recebivelParcelaRefs.get(recId)))
        const refsParcelas = conjuntos.find((s) => s && s.size > 0)
        if (refsParcelas) {
          const valoresMesmoSentido: number[] = []
          treasuryRefTypes.forEach((info, ref) => {
            if (refsParcelas.has(ref) && info.type === type) valoresMesmoSentido.push(info.value)
          })
          if (valoresMesmoSentido.length > 0) {
            const movVal = Number(mov.valor || 0)
            const soma = valoresMesmoSentido.reduce((a, b) => a + b, 0)
            casouPorIndice =
              valoresMesmoSentido.some((v) => Math.abs(v - movVal) < 0.015) ||
              Math.abs(soma - movVal) < 0.015
          }
        }
      }
      let casouPorValorData = false
      if (!mesmoSentidoExato && !casouPorIndice && !ttEspelhoPresente) {
        const refTipoNorm = refTipo
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        const ehEspelhoDeEvento = [
          'parcela_operacao',
          'recebivel',
          'liquidacao_recebivel',
          'parcela',
          'boleto',
        ].includes(refTipoNorm)
        if (ehEspelhoDeEvento) {
          const movVal = Number(mov.valor || 0)
          const movMs = new Date(String(mov.created_at)).getTime()
          casouPorValorData = [...treasuryRefTypes.entries()].some(([ref, info]) => {
            if (info.type !== type || Math.abs(info.value - movVal) >= 0.015) return false
            if (
              !ref.startsWith('ccb-bol-') &&
              !ref.startsWith('op-bol-') &&
              !ref.startsWith('op-liq-')
            )
              return false
            const ms = new Date(info.date).getTime()
            return !isNaN(ms) && !isNaN(movMs) && Math.abs(ms - movMs) <= 7 * 86400000
          })
        }
      }
      if (mesmoSentidoExato || casouPorIndice || casouPorValorData) {
        dedupSuppressed = true
      }
    }
    const category = String(categoriaLabel[catLower] ?? mov.categoria ?? 'Movimentação de Caixa')
    const b = resolveBank(mov.bank_account_id)
    transactions.push({
      id: `mov-${mov.id}`,
      date: effectiveDate,
      type,
      category,
      description: String(mov.descricao ?? category),
      value: Number(mov.valor || 0),
      is_bank_mirror: false,
      dedup_suppressed: dedupSuppressed,
      bank_account_id: b.id,
      ref: mov.referencia_numero
        ? `${String(mov.referencia_tipo ?? '')}#${mov.referencia_numero}`
        : String(mov.referencia_tipo ?? ''),
    })
  })

  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let runningGlobal = 0
  const balancesByAccount: Record<string, number> = {}
  const bankMirrorNetByAccount: Record<string, number> = {}
  companyBanks.forEach((b) => {
    balancesByAccount[String(b.id)] = 0
  })
  const netByAccountAndSource: Record<string, Record<string, number>> = {}
  const calculatedTransactions: Tx[] = []
  for (const t of transactions) {
    const delta = t.type === 'in' ? t.value : -t.value
    const accId = t.bank_account_id
    if (accId && !t.dedup_suppressed) {
      runningGlobal += delta
      balancesByAccount[accId] = (balancesByAccount[accId] ?? 0) + delta
      const sourceOf = (tx: Tx): string => {
        if (tx.id.startsWith('tt-')) return 'tesouraria'
        if (tx.id.startsWith('mov-')) return 'mov-caixa'
        if (tx.id.startsWith('ccb-bol-')) return 'boletos-ccb'
        if (tx.id.startsWith('exp-')) return 'despesas'
        if (tx.id.startsWith('op-out-')) return 'operacoes-credito'
        if (tx.id.startsWith('red-')) return 'resgates'
        if (tx.id.startsWith('acq-')) return 'aquisicoes-ccb'
        return 'captacoes'
      }
      const src = sourceOf(t)
      netByAccountAndSource[accId] = netByAccountAndSource[accId] || {}
      netByAccountAndSource[accId][src] = (netByAccountAndSource[accId][src] ?? 0) + delta
      if (t.is_bank_mirror)
        bankMirrorNetByAccount[accId] = (bankMirrorNetByAccount[accId] ?? 0) + delta
    }
    calculatedTransactions.push(t)
  }

  const BNK = '97c394bd-6334-43ab-9db5-b8717581ae61'
  const bnkNovembro = calculatedTransactions
    .filter((t) => t.bank_account_id === BNK && t.date >= '2026-11-01' && !t.dedup_suppressed)
    .map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      value: t.value,
      desc: t.description.slice(0, 70),
      ref: t.ref ?? null,
      src: ((): string => {
        if (t.id.startsWith('tt-')) return 'tesouraria'
        if (t.id.startsWith('mov-')) return 'mov-caixa'
        if (t.id.startsWith('ccb-bol-')) return 'boletos-ccb'
        if (t.id.startsWith('exp-')) return 'despesas'
        if (t.id.startsWith('op-out-')) return 'operacoes-credito'
        if (t.id.startsWith('red-')) return 'resgates'
        return 'captacoes'
      })(),
    }))

  const parcela16 = calculatedTransactions.filter(
    (t) => t.id === 'ccb-bol-aabecf04-a549-4fbf-a80e-d98a47f2d827-16',
  )

  const dump = {
    saldos_por_conta: balancesByAccount,
    contas: companyBanks.map((b) => ({
      id: b.id,
      bank_name: b.bank_name,
      account_number: b.account_number,
      is_active: b.is_active,
    })),
    net_bnk_por_fonte: netByAccountAndSource[BNK] ?? {},
    parcela_16_no_livro: parcela16,
    bnk_lancamentos_novembro_2026: bnkNovembro,
    total_lancamentos: calculatedTransactions.length,
    raw: {
      tt: tt,
      movs: movs,
      ops: ops,
      reds: reds,
      exps: exps,
      recs: recs,
      subs: subs,
      invs: invs,
      banks: companyBanks,
      mapMovs: mapMovs,
    },
  }
  return new Response(JSON.stringify(dump), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
