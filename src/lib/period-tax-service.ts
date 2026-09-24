import { supabase } from '@/lib/supabase/client'
import { parseProductRate, computeInterestYield } from '@/lib/yield-calculator'
import {
  classifyMovimentacaoCaixaDre,
  isTaxProvisionTransaction,
} from '@/lib/financial-classification'
import {
  getConsolidatedCaptacoes,
  normalizeDateOnly,
  type RawInvestment,
  type RawSubscription as CaptacoesRawSubscription,
} from '@/lib/captacoes-service'

/* ------------------------------------------------------------------ */
/* Types & Interfaces                                                 */
/* ------------------------------------------------------------------ */

export interface PeriodTaxCalculation {
  // Receita Bruta / Faturamento
  receitaBrutaRecebiveis: number
  receitaBrutaCcbs: number
  receitaBrutaTotal: number

  // Custos e Despesas Financeiras
  despesasCaptacao: number // Juros de Debêntures do Período
  tarifasBancarias: number // Tarifas Bancárias de Cobrança/Custódia
  totalCustosDespesasFinanceiras: number // despesasCaptacao + tarifasBancarias

  // Resultado Operacional Líquido (LAIR)
  // LAIR = Receita Bruta Total - Despesas de Captação - Tarifas Bancárias
  lair: number
  isPrejuizoPeriodo: boolean // true se lair <= 0
  valorPrejuizoFiscal: number // Math.max(0, -lair) se lair <= 0
  baseLucroRealTributavel: number // Math.max(0, lair) -> 0 se prejuízo

  // Base PIS / COFINS (mantida: cumulativo, deduz captação, trava base negativa)
  basePisCofinsOriginal: number
  basePisCofins: number // max(0, receitaBrutaTotal - despesasCaptacao)
  baseNegativaAviso: boolean

  // PIS / COFINS
  aliquotaPis: number // 0.0065 (0,65%)
  valorPis: number
  aliquotaCofins: number // 0.04 (4,00%)
  valorCofins: number
  totalPisCofins: number

  // DRE Referencial Histórico / Contábil
  receitasDre: number
  despesasDre: number
  lucroReal: number // Resultado oficial do DRE contábil
  captacoesDoPeriodo: number
  lucroRealFiscal: number // mantido por compatibilidade com LAIR

  // IRPJ & CSLL (Projeção de Impostos Lucro Real baseada no LAIR)
  aliquotaIrpj: number // 0.15 (15%)
  valorIrpjBase: number // 0 se lair <= 0, senão lair * 0.15
  mesesFiltro: number // Quantidade de meses cobertos pelo filtro (default 1)
  limiteExcedenteIrpj: number // 20000.00 * mesesFiltro
  baseAdicionalIrpj: number // max(0, lair - limiteExcedenteIrpj) se lair > 0
  aliquotaAdicionalIrpj: number // 0.10 (10%)
  valorAdicionalIrpj: number // 0 se lair <= 0, senão baseAdicionalIrpj * 0.10
  valorIrpjTotal: number // valorIrpjBase + valorAdicionalIrpj

  aliquotaCsll: number // 0.09 (9%)
  valorCsll: number // 0 se lair <= 0, senão lair * 0.09

  totalIrpjCsll: number

  // Carga Tributária Total Estimada
  totalCargaTributaria: number
  aliquotaEfetivaSobreReceita: number // totalCargaTributaria / receitaBrutaTotal * 100
}

interface ProductInfo {
  id: string
  title: string
  type: string
  rate: string
  term: string
  yield_split_pct: number
  quota_value?: number | null
  interest_type?: string | null
}

interface LinkedInvestment {
  id?: string
  status: string | null
  user_id: string
  quotas?: number | null
  redeemed_quotas?: number | null
  unit_price?: number | null
  total_value?: number | null
  transfer_date?: string | null
  created_at?: string | null
  investment_products: (ProductInfo & { quota_value?: number | null }) | null
}

interface RawSubscriptionYield {
  id: string
  investor_name: string
  document_number: string | null
  total_amount: number
  subscription_date: string | null
  created_at: string
  status: string | null
  investment_id: string | null
  series_id: string
  investments: LinkedInvestment | LinkedInvestment[] | null
}

interface ManualEntry {
  id: string
  product_id: string
  period: string
  gross_percentage: number
  client_percentage: number
}

function resolveInvestment(
  raw: LinkedInvestment | LinkedInvestment[] | null,
): LinkedInvestment | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null
  return raw
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0]
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

const ELIGIBLE_INVESTMENT_STATUSES = ['approved', 'pending_transfer']
const DISCARD_RAW_STATUSES = ['encerrado', 'resgatado', 'excluído', 'cancelled']

/**
 * Busca e calcula o rendimento pago/auferido aos investidores no mês selecionado (YYYY-MM),
 * usando EXATAMENTE a fonte oficial e os cálculos de InvestorYieldsReportTab.
 */
export async function fetchInvestorYieldsForMonth(selectedMonth: string): Promise<number> {
  const [selYearStr, selMonthStr] = selectedMonth.split('-')
  const selYear = parseInt(selYearStr, 10)
  const selMonth = parseInt(selMonthStr, 10) // 1-12

  const startOfSelectedMonth = new Date(Date.UTC(selYear, selMonth - 1, 1, 0, 0, 0, 0))
  const endOfSelectedMonth = new Date(Date.UTC(selYear, selMonth, 0, 23, 59, 59, 999))
  const now = new Date()
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1
  const referenceDateAccrued = isCurrentMonth && now < endOfSelectedMonth ? now : endOfSelectedMonth

  const { data: subs, error: subsErr } = await supabase
    .from('debenture_subscriptions')
    .select(
      `
      id, investor_name, document_number, total_amount, subscription_date,
      created_at, status, investment_id, series_id,
      investments (
        id, status, user_id, quotas, redeemed_quotas, unit_price, total_value, transfer_date, created_at,
        investment_products ( id, title, type, rate, term, yield_split_pct, interest_type, quota_value )
      )
      `,
    )
    .is('deleted_at', null)
    .order('subscription_date', { ascending: false, nullsFirst: false })

  if (subsErr) throw subsErr
  const subsData = (subs || []) as RawSubscriptionYield[]

  // Produtos por series_id
  const seriesIds = Array.from(new Set(subsData.map((s) => s.series_id).filter(Boolean)))
  const seriesProductsMap: Record<string, ProductInfo> = {}
  if (seriesIds.length > 0) {
    const { data: seriesProducts, error: seriesErr } = await supabase
      .from('investment_products')
      .select('id, title, type, rate, term, yield_split_pct, series_id, interest_type, quota_value')
      .in('series_id', seriesIds)

    if (seriesErr) throw seriesErr
    for (const p of (seriesProducts || []) as (ProductInfo & { series_id: string | null })[]) {
      if (p.series_id) seriesProductsMap[p.series_id] = p
    }
  }

  // Entradas manuais
  const productIds = Array.from(
    new Set(
      subsData
        .map((s) => {
          const linked = resolveInvestment(s.investments)?.investment_products
          if (linked?.id) return linked.id
          const bySeries = s.series_id ? seriesProductsMap[s.series_id] : null
          return bySeries?.id || null
        })
        .filter(Boolean) as string[],
    ),
  )

  let manualEntries: ManualEntry[] = []
  if (productIds.length > 0) {
    const { data: entries, error: entriesErr } = await supabase
      .from('manual_yield_entries')
      .select('id, product_id, period, gross_percentage, client_percentage')
      .in('product_id', productIds)
      .order('period', { ascending: true })

    if (entriesErr) throw entriesErr
    manualEntries = (entries || []) as ManualEntry[]
  }

  const entriesByProduct: Record<string, ManualEntry[]> = {}
  for (const e of manualEntries) {
    if (!entriesByProduct[e.product_id]) entriesByProduct[e.product_id] = []
    entriesByProduct[e.product_id].push(e)
  }

  let totalMonthYield = 0

  for (const raw of subsData) {
    const inv = resolveInvestment(raw.investments)
    const product =
      inv?.investment_products ??
      (raw.series_id ? (seriesProductsMap[raw.series_id] ?? null) : null)

    const rawStatusLower = (raw.status || '').toLowerCase()
    if (DISCARD_RAW_STATUSES.includes(rawStatusLower)) continue

    if (inv) {
      if (!ELIGIBLE_INVESTMENT_STATUSES.includes(inv.status || '')) continue
      if (inv.status === 'resgatado') continue
    }

    const quotas = Number(inv?.quotas ?? 0)
    const redeemedQuotas = Number(inv?.redeemed_quotas ?? 0)
    const remainingQuotas = Math.max(0, quotas - redeemedQuotas)
    const unitPrice = Number(inv?.unit_price || product?.quota_value || 100)
    const investedAmount = inv ? remainingQuotas * unitPrice : Number(raw.total_amount || 0)

    if (investedAmount <= 0) continue

    const rawDateStr = raw.subscription_date || (inv as any)?.transfer_date || raw.created_at
    const startDate = rawDateStr ? new Date(rawDateStr + 'T12:00:00Z') : null

    if (startDate && startDate > endOfSelectedMonth) continue

    let yieldMonth = 0

    if (product && startDate && investedAmount > 0) {
      if (product.type === 'Rendimento Variável (Forex Manual)') {
        const allProductEntries = entriesByProduct[product.id] || []
        const split = Number(product.yield_split_pct ?? 0) / 100

        const monthEntries = allProductEntries.filter((e) => {
          const ed = new Date(e.period + 'T12:00:00Z')
          return ed >= startDate && ed >= startOfSelectedMonth && ed <= referenceDateAccrued
        })
        const sumMonthGross = monthEntries.reduce(
          (sum, e) => sum + Number(e.gross_percentage || 0),
          0,
        )
        yieldMonth = investedAmount * (sumMonthGross / 100) * split
      } else {
        const annualRate = parseProductRate(product.rate)
        if (annualRate !== null && annualRate > 0) {
          const effectiveMonthStart =
            startDate > startOfSelectedMonth ? startDate : startOfSelectedMonth

          if (referenceDateAccrued >= effectiveMonthStart) {
            const msMonth = referenceDateAccrued.getTime() - effectiveMonthStart.getTime()
            const daysMonth = Math.floor(msMonth / (1000 * 60 * 60 * 24))
            if (daysMonth > 0) {
              yieldMonth = computeInterestYield(
                investedAmount,
                annualRate,
                daysMonth,
                product.interest_type,
              )
            }
          }
        }
      }
    }

    totalMonthYield += Math.max(0, yieldMonth)
  }

  return totalMonthYield
}

/**
 * Busca e calcula o resultado DRE do período (Receitas e Despesas oficiais),
 * com as exatas deduplicações e fontes oficiais de `useDre`.
 */
export async function fetchDreResultForPeriod(
  inicio: string,
  fim: string,
): Promise<{
  totalReceitas: number
  totalDespesas: number
  resultado: number
  totalCaptacoes: number
  totalTarifasBancarias: number
}> {
  const [
    movsRes,
    subsRes,
    invsRes,
    expsRes,
    tresRes,
    credRes,
    ccbRes,
    mapRes,
    allPaidExpsRes,
    allRedemptionsRes,
  ] = await Promise.all([
    supabase
      .from('movimentacoes_caixa')
      .select(
        'id, tipo, categoria, descricao, valor, created_at, referencia_tipo, referencia_id, referencia_numero',
      )
      .is('deleted_at', null),
    supabase
      .from('debenture_subscriptions')
      .select(
        'id, investor_name, document_number, total_amount, unit_price, quantity, subscription_date, created_at, status, deleted_at, investment_id, investments(quotas, redeemed_quotas, unit_price, transfer_value, transfer_date, status)',
      )
      .is('deleted_at', null),
    supabase
      .from('investments')
      .select(
        'id, user_id, quotas, redeemed_quotas, unit_price, total_value, transfer_value, transfer_date, status, created_at, profiles(id, full_name, document_number, pj_company_name), debenture_subscriptions(id, total_amount, subscription_date, status)',
      ),
    supabase
      .from('expenses')
      .select(
        'id, amount, description, payment_date, due_date, status, category, supplier_id, suppliers(company_name)',
      )
      .or(
        `and(payment_date.gte.${inicio},payment_date.lte.${fim}),and(payment_date.is.null,and(due_date.gte.${inicio},due_date.lte.${fim}))`,
      ),
    supabase
      .from('treasury_transactions')
      .select(
        'id, type, category, amount, description, date, external_ref, expense_id, reference_id, status',
      )
      .is('deleted_at', null)
      .or('status.eq.Confirmado,status.is.null')
      .gte('date', inicio)
      .lte('date', fim),
    supabase
      .from('credit_operations')
      .select(
        'id, status, issue_date, sacado, requested_value, face_value, operation_calculations(net_value)',
      )
      .gte('issue_date', inicio)
      .lte('issue_date', fim),
    supabase
      .from('recebiveis_ccb')
      .select(
        'id, ccb_id, acquisition_value, created_at, boletos, status, tomador_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
      ),
    supabase
      .from('mapeamento_movimentacoes')
      .select('movimentacao_caixa_id, origem_tabela, origem_id')
      .in('origem_tabela', ['fornecedores', 'despesas', 'investment_redemptions']),
    supabase.from('expenses').select('id, payment_date, due_date, status'),
    supabase.from('investment_redemptions').select('id, updated_at, created_at, status'),
  ])

  type LocalDreItem = {
    id: string
    date: string
    tipo: 'receita' | 'despesa'
    valor: number
  }

  const lancamentos: LocalDreItem[] = []

  const expenseMap = new Map<
    string,
    { payment_date: string | null; due_date: string | null; status: string }
  >()
  ;(allPaidExpsRes.data || []).forEach((e: any) => {
    expenseMap.set(e.id, {
      payment_date: e.payment_date,
      due_date: e.due_date,
      status: e.status,
    })
  })

  const redemptionMap = new Map<
    string,
    { updated_at: string; created_at: string; status: string }
  >()
  ;(allRedemptionsRes.data || []).forEach((r: any) => {
    redemptionMap.set(r.id, {
      updated_at: r.updated_at,
      created_at: r.created_at,
      status: r.status,
    })
  })

  const movIdToExpenseId = new Map<string, string>()
  ;(mapRes.data || []).forEach((m: any) => {
    if (m.movimentacao_caixa_id && m.origem_id) {
      if (m.origem_tabela === 'fornecedores' || m.origem_tabela === 'despesas') {
        movIdToExpenseId.set(m.movimentacao_caixa_id, m.origem_id)
      }
    }
  })

  const creditOpIdsNoCaixa = new Set<string>()
  const movsExternalRefs = new Set<string>()

  ;(movsRes.data || []).forEach((mov: any) => {
    const tipo = classifyMovimentacaoCaixaDre(mov.tipo)
    const refTipo = (mov.referencia_tipo || '').toLowerCase()

    if (
      tipo === 'despesa' &&
      (refTipo === 'recebível' || refTipo === 'recebivel') &&
      mov.referencia_id
    ) {
      creditOpIdsNoCaixa.add(mov.referencia_id)
    }
    if (mov.referencia_id) {
      movsExternalRefs.add(`op-liq-${mov.referencia_id}`)
      movsExternalRefs.add(`redemption-${mov.referencia_id}`)
      if (mov.referencia_numero) {
        movsExternalRefs.add(`op-bol-${mov.referencia_id}-${mov.referencia_numero}`)
        movsExternalRefs.add(String(mov.referencia_numero))
      }
    }

    const linkedExpenseId =
      movIdToExpenseId.get(mov.id) || (refTipo === 'despesa' ? mov.referencia_id : null)

    if (linkedExpenseId && expenseMap.has(linkedExpenseId)) {
      return
    }

    if (
      refTipo === 'transferencia_entre_contas' ||
      (mov.categoria || '').toLowerCase().includes('transferência entre contas') ||
      (mov.categoria || '').toLowerCase().includes('transferencia entre contas') ||
      Boolean(mov.transfer_pair_id)
    ) {
      return
    }

    let effectiveDate = normalizeDate(mov.created_at)

    if (
      refTipo === 'resgate_investimento' &&
      mov.referencia_id &&
      redemptionMap.has(mov.referencia_id)
    ) {
      const red = redemptionMap.get(mov.referencia_id)!
      effectiveDate = normalizeDate(red.updated_at || red.created_at)
    }

    if (effectiveDate < inicio || effectiveDate > fim) {
      return
    }

    lancamentos.push({
      id: `mov-${mov.id}`,
      date: effectiveDate,
      tipo,
      valor: Number(mov.valor || 0),
    })
  })

  // 2. Captações
  const rawInvs = (invsRes.data || []) as RawInvestment[]
  const rawSubs = (subsRes.data || []) as CaptacoesRawSubscription[]
  const captacoes = getConsolidatedCaptacoes(rawInvs, rawSubs)

  let totalCaptacoes = 0
  captacoes.forEach((cap) => {
    if (cap.date < inicio || cap.date > fim) return
    const valorCap = Number(cap.valor || 0)
    totalCaptacoes += valorCap
    lancamentos.push({
      id: cap.id,
      date: cap.date,
      tipo: 'receita',
      valor: valorCap,
    })
  })

  // 3. Despesas pagas
  const expenseIdsInDre = new Set<string>()
  ;(expsRes.data || []).forEach((exp) => {
    if (exp.status !== 'paid') return
    expenseIdsInDre.add(exp.id)
    const dataLanc = normalizeDate(exp.payment_date || exp.due_date)
    lancamentos.push({
      id: `exp-${exp.id}`,
      date: dataLanc,
      tipo: 'despesa',
      valor: Number(exp.amount || 0),
    })
  })

  // 5. Operações de crédito
  ;(credRes.data || []).forEach((op) => {
    const st = (op.status || '').toLowerCase()
    if (st !== 'liquidado' && st !== 'pago') return
    if (creditOpIdsNoCaixa.has(op.id)) return

    const calc = Array.isArray(op.operation_calculations)
      ? op.operation_calculations[0]
      : op.operation_calculations
    const valor = Number(calc?.net_value || op.requested_value || 0)
    if (!valor) return

    lancamentos.push({
      id: `cre-${op.id}`,
      date: normalizeDate(op.issue_date),
      tipo: 'despesa',
      valor,
    })
  })

  // 4. Tesouraria
  const treasuryExternalRefs = new Set<string>()
  ;(tresRes.data || []).forEach((t) => {
    if (isTaxProvisionTransaction(t)) return

    const tipo: 'receita' | 'despesa' = t.type === 'out' ? 'despesa' : 'receita'
    if (tipo === 'despesa' && t.expense_id && expenseIdsInDre.has(t.expense_id)) return

    const extRef = t.external_ref ? String(t.external_ref) : null
    if (extRef && movsExternalRefs.has(extRef)) return
    if (extRef) treasuryExternalRefs.add(extRef)

    lancamentos.push({
      id: `tre-${t.id}`,
      date: normalizeDate(t.date),
      tipo,
      valor: Number(t.amount || 0),
    })
  })

  // 6. Boletos pagos JSONB
  ;(ccbRes.data || []).forEach((rec: any) => {
    const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
    boletos.forEach((bol: any, i: number) => {
      const bolStatus = (bol.status || '').toLowerCase()
      if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return

      const dataPgto =
        bol.data_pagamento ||
        bol.payment_date ||
        bol.data_liquidacao ||
        bol.data_vencimento ||
        bol.due_date
      if (!dataPgto) return

      const dataLanc = normalizeDate(dataPgto)
      if (dataLanc < inicio || dataLanc > fim) return

      const parcela = i + 1
      const extRef = bol.external_ref ? String(bol.external_ref) : `ccb-bol-${rec.id}-${parcela}`
      if (treasuryExternalRefs.has(extRef)) return
      treasuryExternalRefs.add(extRef)

      const valor =
        Number(bol.valor || bol.unit_value || 0) +
        Number(bol.interest_applied || 0) +
        Number(bol.penalty_applied || 0)
      if (!valor) return

      lancamentos.push({
        id: `ccb-${rec.id}-${parcela}`,
        date: dataLanc,
        tipo: 'receita',
        valor,
      })
    })
  })

  // 7. Aquisições de CCB
  ;(ccbRes.data || []).forEach((rec: any) => {
    const valAcq = Number(rec.acquisition_value || 0)
    if (valAcq <= 0) return

    const dataAcq = normalizeDate(rec.created_at)
    if (dataAcq < inicio || dataAcq > fim) return

    lancamentos.push({
      id: `acq-${rec.id}`,
      date: dataAcq,
      tipo: 'despesa',
      valor: valAcq,
    })
  })

  const lancamentosFiltrados = lancamentos.filter((l) => l.date >= inicio && l.date <= fim)
  const totalReceitas = lancamentosFiltrados
    .filter((l) => l.tipo === 'receita')
    .reduce((s, l) => s + l.valor, 0)
  const totalDespesas = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa')
    .reduce((s, l) => s + l.valor, 0)

  // Apuração oficial das Tarifas Bancárias de Cobrança / Custódia do período:
  // Fontes oficiais deduplicadas existentes no DRE:
  // 1. `expenses` pagas no período com categoria/descrição de tarifa ou custódia
  // 2. `treasury_transactions` de saída (type='out') com categoria/descrição de tarifa não vinculadas ao expenses
  const isTarifaOrCustodia = (cat: string | null | undefined, desc: string | null | undefined) => {
    const text = `${cat || ''} ${desc || ''}`.toLowerCase()
    return (
      text.includes('tarifa') ||
      text.includes('custodia') ||
      text.includes('custódia') ||
      text.includes('taxa banc')
    )
  }

  let totalTarifasBancarias = 0
  ;(expsRes.data || []).forEach((exp) => {
    if (exp.status !== 'paid') return
    const dataLanc = normalizeDate(exp.payment_date || exp.due_date)
    if (dataLanc < inicio || dataLanc > fim) return
    if (isTarifaOrCustodia(exp.category, exp.description)) {
      totalTarifasBancarias += Number(exp.amount || 0)
    }
  })

  ;(tresRes.data || []).forEach((t) => {
    if (t.type !== 'out') return
    if (isTaxProvisionTransaction(t)) return
    if (t.expense_id && expenseIdsInDre.has(t.expense_id)) return
    const dataLanc = normalizeDate(t.date)
    if (dataLanc < inicio || dataLanc > fim) return
    if (isTarifaOrCustodia(t.category, t.description)) {
      totalTarifasBancarias += Number(t.amount || 0)
    }
  })

  return {
    totalReceitas,
    totalDespesas,
    resultado: totalReceitas - totalDespesas,
    totalCaptacoes,
    totalTarifasBancarias,
  }
}

/**
 * Computa a apuração tributária consolidada para securitizadora no período selecionado,
 * seguindo estritamente a estrutura:
 * (+) RECEITAS DA OPERAÇÃO: Deságio Recebíveis + CCBs/Outros Ganhos = Receita Bruta Total
 * (-) CUSTOS E DESPESAS FINANCEIRAS: (-) Despesas de Captação + (-) Tarifas Bancárias
 * (=) RESULTADO OPERACIONAL LÍQUIDO (LAIR)
 * PROJEÇÃO DE IMPOSTOS (LUCRO REAL):
 * Se LAIR <= 0: IRPJ = 0, CSLL = 0, NOTA: Gerado Prejuízo Fiscal de [Valor] para compensação futura.
 * Se LAIR > 0: CSLL (9%), IRPJ Base (15%), Adicional IRPJ (10% sobre excedente a R$ 20.000 × N meses).
 * PIS (0,65%) e COFINS (4%) cumulativos mantidos com dedução de despesas de captação da base.
 */
export function calculatePeriodTaxes(params: {
  receitaBrutaRecebiveis: number
  receitaBrutaCcbs: number
  despesasCaptacao: number
  tarifasBancarias?: number
  mesesFiltro?: number
  lucroReal?: number
  captacoesDoPeriodo?: number
  receitasDre?: number
  despesasDre?: number
}): PeriodTaxCalculation {
  const {
    receitaBrutaRecebiveis,
    receitaBrutaCcbs,
    despesasCaptacao,
    tarifasBancarias = 0,
    mesesFiltro = 1,
    lucroReal = 0,
    captacoesDoPeriodo = 0,
    receitasDre = 0,
    despesasDre = 0,
  } = params

  const safeMesesFiltro = Math.max(1, mesesFiltro)
  const safeTarifas = Math.max(0, Number(tarifasBancarias || 0))
  const safeCaptacoes = Number(captacoesDoPeriodo || 0)

  // (+) RECEITAS DA OPERAÇÃO
  const receitaBrutaTotal = Math.max(0, receitaBrutaRecebiveis + receitaBrutaCcbs)

  // (-) CUSTOS E DESPESAS FINANCEIRAS
  const totalCustosDespesasFinanceiras = despesasCaptacao + safeTarifas

  // (=) RESULTADO OPERACIONAL LÍQUIDO (LAIR)
  // Receita Bruta Total MENOS despesas de captação MENOS tarifas bancárias de cobrança/custódia
  const lair = receitaBrutaTotal - despesasCaptacao - safeTarifas
  const isPrejuizoPeriodo = lair <= 0
  const valorPrejuizoFiscal = isPrejuizoPeriodo ? Math.abs(lair) : 0
  const baseLucroRealTributavel = isPrejuizoPeriodo ? 0 : lair
  const lucroRealFiscal = lair // A base tributária de IRPJ/CSLL passa a ser o LAIR

  // PIS / COFINS CUMULATIVOS (mantidos: dedução de despesas de captação da base e trava de base negativa)
  const basePisCofinsOriginal = receitaBrutaTotal - despesasCaptacao
  const basePisCofins = Math.max(0, basePisCofinsOriginal)
  const baseNegativaAviso = basePisCofinsOriginal < 0

  const aliquotaPis = 0.0065 // 0,65%
  const aliquotaCofins = 0.04 // 4,00%
  const valorPis = basePisCofins * aliquotaPis
  const valorCofins = basePisCofins * aliquotaCofins
  const totalPisCofins = valorPis + valorCofins

  // PROJEÇÃO DE IMPOSTOS (LUCRO REAL)
  // Se LAIR <= 0: IRPJ = 0, CSLL = 0
  // Se LAIR > 0: CSLL 9%, IRPJ Base 15%, Adicional 10% sobre excedente a R$ 20.000 × N meses
  const aliquotaIrpj = 0.15
  const valorIrpjBase = isPrejuizoPeriodo ? 0 : baseLucroRealTributavel * aliquotaIrpj

  // Limite proporcional de adicional de IRPJ: R$ 20.000,00 por mês coberto pelo filtro
  const limiteExcedenteIrpj = 20000.0 * safeMesesFiltro
  const baseAdicionalIrpj = isPrejuizoPeriodo
    ? 0
    : Math.max(0, baseLucroRealTributavel - limiteExcedenteIrpj)
  const aliquotaAdicionalIrpj = 0.1
  const valorAdicionalIrpj = isPrejuizoPeriodo ? 0 : baseAdicionalIrpj * aliquotaAdicionalIrpj
  const valorIrpjTotal = valorIrpjBase + valorAdicionalIrpj

  // CSLL: 9% sobre LAIR (zerado se LAIR <= 0)
  const aliquotaCsll = 0.09
  const valorCsll = isPrejuizoPeriodo ? 0 : baseLucroRealTributavel * aliquotaCsll
  const totalIrpjCsll = valorIrpjTotal + valorCsll

  const totalCargaTributaria = totalPisCofins + totalIrpjCsll
  const aliquotaEfetivaSobreReceita =
    receitaBrutaTotal > 0 ? (totalCargaTributaria / receitaBrutaTotal) * 100 : 0

  return {
    receitaBrutaRecebiveis,
    receitaBrutaCcbs,
    receitaBrutaTotal,
    despesasCaptacao,
    tarifasBancarias: safeTarifas,
    totalCustosDespesasFinanceiras,
    lair,
    isPrejuizoPeriodo,
    valorPrejuizoFiscal,
    baseLucroRealTributavel,
    basePisCofinsOriginal,
    basePisCofins,
    baseNegativaAviso,
    aliquotaPis,
    valorPis,
    aliquotaCofins,
    valorCofins,
    totalPisCofins,
    receitasDre,
    despesasDre,
    lucroReal,
    captacoesDoPeriodo: safeCaptacoes,
    lucroRealFiscal,
    mesesFiltro: safeMesesFiltro,
    aliquotaIrpj,
    valorIrpjBase,
    limiteExcedenteIrpj,
    baseAdicionalIrpj,
    aliquotaAdicionalIrpj,
    valorAdicionalIrpj,
    valorIrpjTotal,
    aliquotaCsll,
    valorCsll,
    totalIrpjCsll,
    totalCargaTributaria,
    aliquotaEfetivaSobreReceita,
  }
}
