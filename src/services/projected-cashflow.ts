import { supabase } from '@/lib/supabase/client'
import {
  evaluateGracePeriod,
  calculateRedemptionMetrics,
  type InvestmentForRedemption,
} from '@/lib/redemption-utils'
import { fetchManualYieldEntries, type ManualYieldEntry } from '@/services/manual-yield'
import {
  fetchConsolidatedAccountingLedger,
  type BankAccountBalanceSummary,
} from '@/lib/accounting-ledger'

export type ProjectedEntryType = 'in' | 'out'

export type ProjectedOriginType =
  | 'recebivel_antecipacao'
  | 'recebivel_ccb'
  | 'conta_pagar'
  | 'resgate_investimento'
  | 'juros_mensais_debenture'
  | 'manual_entrada'
  | 'manual_saida'

export interface ProjectedCashflowItem {
  id: string
  date: string // YYYY-MM-DD
  type: ProjectedEntryType // 'in' = Entrada, 'out' = Saída
  origin: ProjectedOriginType
  originLabel: string // 'Antecipação', 'CCB', 'Contas a Pagar', 'Resgate', 'Recebível Futuro Manual', 'Pagamento Futuro Manual'
  description: string
  entityName: string // Tomador, Sacado, Fornecedor ou Investidor
  entityDocument?: string | null
  category: string
  amount: number
  status: 'previsto' | 'pendente' | 'em_aberto' | 'realizado'
  referenceId?: string | null
  isManual?: boolean
  manualNotes?: string | null
  principalAmount?: number
  yieldAmount?: number
}

export interface ManualProjectedEntry {
  id: string
  type: ProjectedEntryType
  description: string
  amount: number
  projected_date: string
  category: string
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface MonthProjectedSummary {
  monthKey: string // YYYY-MM
  monthLabel: string // "Outubro/2026"
  totalIn: number
  totalOut: number
  monthNet: number // totalIn - totalOut
  startingBalance: number
  accumulatedBalance: number
  items: ProjectedCashflowItem[]
}

export interface BankAccountBalanceInfo {
  id: string
  bankName: string
  accountNumber: string
  branch: string
  balance: number
  isActive: boolean
}

export interface ProjectedCashflowData {
  initialCashBalance: number
  accounts: BankAccountBalanceInfo[]
  items: ProjectedCashflowItem[]
  monthlySummaries: MonthProjectedSummary[]
  totalProjectedIn: number
  totalProjectedOut: number
  totalProjectedNet: number
  finalAccumulatedBalance: number
}

export interface FetchProjectedCashflowOptions {
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
}

/**
 * Consulta o saldo inicial de caixa a partir do Livro Caixa das contas cadastradas.
 */
export async function fetchCurrentCashBalances(asOfDate?: string): Promise<{
  totalBalance: number
  accounts: BankAccountBalanceInfo[]
}> {
  try {
    // Alinha a apuração de saldos com a fonte primária oficial do Livro Caixa (useAccounting / /admin/accounting)
    // Se asOfDate for informada, o saldo reflete o acumulado histórico até o início da projeção
    const ledger = await fetchConsolidatedAccountingLedger({ asOfDate })

    const accounts: BankAccountBalanceInfo[] = ledger.accountSummaries.map(
      (acc: BankAccountBalanceSummary) => ({
        id: acc.id,
        bankName: acc.bank_name,
        accountNumber: acc.account_number,
        branch: acc.branch || '',
        balance: acc.balance,
        isActive: acc.is_active,
      }),
    )

    return {
      totalBalance: ledger.totalCashBalance,
      accounts,
    }
  } catch (err) {
    console.error('Falha ao consolidar saldos de caixa via Livro Caixa:', err)
    return { totalBalance: 0, accounts: [] }
  }
}

/**
 * Carrega todos os lançamentos manuais projetados persistidos no banco.
 */
export async function fetchManualProjectedEntries(): Promise<ManualProjectedEntry[]> {
  const { data, error } = await supabase
    .from('projected_cashflow_manual_entries' as any)
    .select('*')
    .order('projected_date', { ascending: true })

  if (error) {
    console.error('Erro ao buscar lançamentos manuais do fluxo projetado:', error)
    return []
  }

  return (data as any[]) || []
}

/**
 * Cria um novo lançamento manual projetado.
 */
export async function createManualProjectedEntry(entry: {
  type: ProjectedEntryType
  description: string
  amount: number
  projected_date: string
  category?: string
  notes?: string | null
}): Promise<{ data: ManualProjectedEntry | null; error: any }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const payload = {
    type: entry.type,
    description: entry.description.trim(),
    amount: entry.amount,
    projected_date: entry.projected_date,
    category: entry.category?.trim() || 'Geral',
    notes: entry.notes?.trim() || null,
    created_by: user?.id || null,
  }

  const { data, error } = await supabase
    .from('projected_cashflow_manual_entries' as any)
    .insert([payload])
    .select()
    .single()

  return { data: (data as any) || null, error }
}

/**
 * Atualiza um lançamento manual projetado.
 */
export async function updateManualProjectedEntry(
  id: string,
  entry: Partial<{
    type: ProjectedEntryType
    description: string
    amount: number
    projected_date: string
    category: string
    notes: string | null
  }>,
): Promise<{ data: ManualProjectedEntry | null; error: any }> {
  const payload = {
    ...entry,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('projected_cashflow_manual_entries' as any)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  return { data: (data as any) || null, error }
}

/**
 * Exclui um lançamento manual projetado.
 */
export async function deleteManualProjectedEntry(id: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('projected_cashflow_manual_entries' as any)
    .delete()
    .eq('id', id)

  return { error }
}

/**
 * Constrói a projeção consolidada de Fluxo de Caixa reunindo:
 * 1. Contas a Pagar (despesas pending)
 * 2. Resgates de Investimentos (solicitações pendentes + vencimento de carência de cotas ativas)
 * 3. Recebíveis Futuros Agendados (parcelas a receber de Antecipação e CCB)
 * 4. Lançamentos Manuais Projetados (entradas e saídas adicionais)
 * 5. Ponto de partida: Saldo real em caixa das contas bancárias
 */
export async function getConsolidatedProjectedCashflow(
  options: FetchProjectedCashflowOptions = {},
): Promise<ProjectedCashflowData> {
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTime = new Date(todayStr + 'T00:00:00').getTime()

  // 1. Saldo inicial real em caixa
  // Regra de consistência financeira com Livro Caixa (/admin/accounting) e Extrato Bancário (/admin/bank-accounts):
  // - Quando a projeção parte de hoje ou do futuro (startDate >= todayStr):
  //   o Saldo Inicial deve ser a posição real consolidada de caixa DE HOJE (sem corte retroativo, asOfCutoff = undefined),
  //   garantindo que baixas registradas hoje reflitam imediatamente no caixa inicial.
  // - Quando a projeção parte no passado (startDate < todayStr):
  //   o Saldo Inicial é apurado até a véspera da data inicial (startDate - 1 dia).
  //   Em compensação, as parcelas baixadas (pagas/liquidadas) dentro do período selecionado
  //   (startDate <= paymentDate <= todayStr) entram como ENTRADAS REALIZADAS no mês correspondente do relatório,
  //   evitando que o valor desapareça do fluxo (nem no saldo inicial, nem nos recebíveis).
  let asOfCutoff: string | undefined = undefined
  const isPastStart = Boolean(options.startDate && options.startDate < todayStr)

  if (isPastStart && options.startDate) {
    // Saldo no início da data de projeção: transações anteriores a startDate (corte retroativo)
    const d = new Date(options.startDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    asOfCutoff = d.toISOString().split('T')[0]
  }

  const { totalBalance: initialCashBalance, accounts } = await fetchCurrentCashBalances(asOfCutoff)

  // 2. Contas a pagar (tabela expenses, status != 'paid' ou payment_date IS NULL)
  // Observação: mesmo que todas hoje estejam pagas no seed, buscamos as que estiverem pendentes
  const { data: expensesData, error: expErr } = await supabase
    .from('expenses')
    .select(`
      id,
      description,
      category,
      amount,
      due_date,
      payment_date,
      status,
      suppliers (
        id,
        company_name,
        document_number
      )
    `)
    .neq('status', 'paid')

  if (expErr) {
    console.error('Erro ao buscar despesas a pagar para fluxo projetado:', expErr)
  }

  // 3. Resgates de investimentos:
  // a) Solicitações já registradas com status 'pending'
  // IMPORTANTE: desambiguar explicitamente FKs para profiles!
  const { data: pendingRedemptions, error: redErr } = await supabase
    .from('investment_redemptions')
    .select(`
      id,
      investment_id,
      requested_quotas,
      gross_value,
      net_value,
      status,
      created_at,
      profiles!investment_redemptions_user_id_fkey (
        id,
        full_name,
        document_number,
        pj_company_name
      ),
      investments!investment_redemptions_investment_id_fkey (
        id,
        unit_price,
        investment_products (
          id,
          title
        )
      )
    `)
    .eq('status', 'pending')

  if (redErr) {
    console.error('Erro ao buscar resgates pendentes:', redErr)
  }

  // b) Vencimento de carência das aplicações ativas (investments)
  // Desambiguar com profiles!investments_user_id_fkey
  const { data: activeInvestments, error: invErr } = await supabase
    .from('investments')
    .select(`
      id,
      user_id,
      product_id,
      quotas,
      redeemed_quotas,
      unit_price,
      total_value,
      status,
      transfer_date,
      created_at,
      profiles!investments_user_id_fkey (
        id,
        full_name,
        document_number,
        pj_company_name
      ),
      investment_products!investments_product_id_fkey (
        id,
        title,
        type,
        rate,
        term,
        quota_value,
        min_grace_period_months,
        allow_early_redemption,
        early_redemption_penalty_pct,
        early_redemption_discount_pct,
        yield_payment_regime,
        monthly_payment_day
      )
    `)
    .in('status', ['approved', 'transfer_confirmed'])
  if (invErr) {
    console.error('Erro ao buscar investimentos para carência:', invErr)
  }

  // 3.1. Resgates de rendimento mensal já solicitados ou pagos (para suprimir competências)
  const { data: monthlyRedemptionsData, error: mRedErr } = await supabase
    .from('investment_redemptions')
    .select(`
      id,
      investment_id,
      redemption_type,
      period_month,
      status
    `)
    .eq('redemption_type', 'interest_only')
    .not('status', 'eq', 'rejected')

  if (mRedErr) {
    console.error('Erro ao buscar resgates de rendimento mensal:', mRedErr)
  }

  // Mapa de competências já processadas ou solicitadas: `invId:YYYY-MM` -> true
  const paidOrRequestedMonthlyMonths = new Set<string>()
  ;(monthlyRedemptionsData || []).forEach((r: any) => {
    if (r.investment_id && r.period_month) {
      paidOrRequestedMonthlyMonths.add(`${r.investment_id}:${r.period_month}`)
    }
  })

  // 4. Recebíveis a Receber - Antecipações (credit_operations)
  const { data: creditOpsData, error: opsErr } = await supabase
    .from('credit_operations')
    .select(`
      id,
      document_number,
      receivable_type,
      receivable_type_other,
      cedente,
      sacado,
      sacado_document,
      face_value,
      requested_value,
      issue_date,
      due_date,
      installments,
      installments_data,
      status,
      liquidation_date,
      liquidation_value,
      profiles!credit_operations_borrower_id_fkey (
        id,
        full_name,
        document_number,
        pj_company_name
      )
    `)
    .not('status', 'in', '("cancelado","excluido","reprovado")')

  if (opsErr) {
    console.error('Erro ao buscar antecipações para fluxo projetado:', opsErr)
  }

  // 5. Recebíveis a Receber - CCBs (recebiveis_ccb)
  const { data: ccbData, error: ccbErr } = await supabase
    .from('recebiveis_ccb')
    .select(`
      id,
      ccb_id,
      acquisition_value,
      boleto_count,
      boleto_unit_value,
      gross_profit,
      boletos,
      status,
      created_at,
      ccb_solicitacoes (
        id,
        term_months,
        operation_data,
        borrower_data
      ),
      profiles!recebiveis_ccb_tomador_id_fkey (
        id,
        full_name,
        document_number,
        pj_company_name
      )
    `)
    .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")')

  if (ccbErr) {
    console.error('Erro ao buscar CCBs para fluxo projetado:', ccbErr)
  }

  // 6. Lançamentos manuais projetados e rendimentos manuais (Forex) para resgates
  const [manualEntries, manualYieldEntries] = await Promise.all([
    fetchManualProjectedEntries(),
    fetchManualYieldEntries(),
  ])

  // CONSOLIDAÇÃO DOS ITENS PROJETADOS
  const items: ProjectedCashflowItem[] = []

  // A. Processar Contas a Pagar (Saídas)
  ;(expensesData || []).forEach((exp: any) => {
    const supp = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
    const supplierName = supp?.company_name || 'Fornecedor não informado'
    const suppDoc = supp?.document_number || ''
    const dueStr = exp.due_date || todayStr

    items.push({
      id: `exp-${exp.id}`,
      date: dueStr,
      type: 'out',
      origin: 'conta_pagar',
      originLabel: 'Contas a Pagar',
      description: exp.description || 'Despesa a Pagar',
      entityName: supplierName,
      entityDocument: suppDoc,
      category: exp.category || 'Despesas Administrativas',
      amount: Number(exp.amount || 0),
      status: 'em_aberto',
      referenceId: exp.id,
      isManual: false,
    })
  })

  // B. Processar Resgates de Investimentos (Saídas com Principal + Juros/Rendimentos)
  // b.1: Resgates pendentes solicitados formalmente
  ;(pendingRedemptions || []).forEach((red: any) => {
    const prof = Array.isArray(red.profiles) ? red.profiles[0] : red.profiles
    const inv = Array.isArray(red.investments) ? red.investments[0] : red.investments
    const prod = Array.isArray(inv?.investment_products)
      ? inv.investment_products[0]
      : inv?.investment_products

    const investorName = prof?.pj_company_name || prof?.full_name || 'Investidor'
    const investorDoc = prof?.document_number || ''
    // Data projetada: data de solicitação ou hoje se anterior
    const reqDate = red.created_at ? red.created_at.split('T')[0] : todayStr
    const projDate = reqDate < todayStr ? todayStr : reqDate
    const projDateObj = new Date(projDate + 'T12:00:00Z')

    // Se já tiver gross_value calculado na solicitação formal, usamos; caso contrário ou se for apenas principal,
    // calculamos via calculateRedemptionMetrics com data projetada
    let grossVal = Number(red.gross_value || red.net_value || 0)
    let principalVal = 0
    let yieldVal = 0

    if (inv && prod) {
      const calcMetrics = calculateRedemptionMetrics(
        {
          id: inv.id,
          user_id: red.profiles?.id || '',
          product_id: prod.id,
          quotas: red.requested_quotas,
          redeemed_quotas: 0,
          unit_price: inv.unit_price,
          total_value: Number(red.requested_quotas) * Number(inv.unit_price || 1000),
          status: 'pending',
          transfer_date: red.created_at,
          created_at: red.created_at,
          investment_products: prod,
        },
        Number(red.requested_quotas || 0),
        manualYieldEntries,
        projDateObj,
      )

      principalVal = calcMetrics.principal
      yieldVal = calcMetrics.yieldAmount
      grossVal = Math.max(grossVal, calcMetrics.grossValue)
    } else {
      principalVal = grossVal
    }

    items.push({
      id: `red-solic-${red.id}`,
      date: projDate,
      type: 'out',
      origin: 'resgate_investimento',
      originLabel: 'Resgate Solicitado',
      description: `Resgate pendente — ${prod?.title || 'Debêntures'} (${red.requested_quotas} cotas) [Principal R$ ${principalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Juros R$ ${yieldVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]`,
      entityName: investorName,
      entityDocument: investorDoc,
      category: 'Resgate de Investimento',
      amount: grossVal,
      principalAmount: principalVal,
      yieldAmount: yieldVal,
      status: 'pendente',
      referenceId: red.id,
      isManual: false,
    })
  })

  // b.2: Resgates projetados por término de carência das aplicações ativas
  // Projeta a liquidação/saída na data do fim da carência quando esta vence no futuro
  // Inclui PRINCIPAL + JUROS acumulados até a data da carência (ou hoje se já decorrida)
  ;(activeInvestments || []).forEach((inv: any) => {
    const prof = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles
    const prod = Array.isArray(inv.investment_products)
      ? inv.investment_products[0]
      : inv.investment_products

    const remainingQuotas = Math.max(0, Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0))
    if (remainingQuotas <= 0) return

    const unitPrice = Number(inv.unit_price || prod?.quota_value || 1000)
    const principal = remainingQuotas * unitPrice

    if (prod) {
      const invObj: InvestmentForRedemption = {
        id: inv.id,
        user_id: inv.user_id,
        product_id: inv.product_id,
        quotas: inv.quotas,
        redeemed_quotas: inv.redeemed_quotas,
        unit_price: unitPrice,
        total_value: principal,
        status: inv.status,
        transfer_date: inv.transfer_date,
        created_at: inv.created_at,
        investment_products: prod,
      }

      const graceEval = evaluateGracePeriod(invObj, new Date())

      // Se a carência terminar em data futura (ou se a carência já tiver sido cumprida e as cotas continuam ativas)
      // Projeta o vencimento da carência na data prevista ou hoje se a carência já expirou e ainda não foi resgatada
      if (graceEval.graceReleaseDate || !graceEval.isWithinGracePeriod) {
        const targetDate =
          graceEval.graceReleaseDate &&
          graceEval.graceReleaseDate.toISOString().split('T')[0] >= todayStr
            ? graceEval.graceReleaseDate
            : new Date(todayStr + 'T12:00:00Z')
        const releaseStr = targetDate.toISOString().split('T')[0]

        const investorName = prof?.pj_company_name || prof?.full_name || 'Investidor'
        const investorDoc = prof?.document_number || ''

        // Calcula juros acumulados até a data projetada (término de carência ou data atual)
        const redemptionMetrics = calculateRedemptionMetrics(
          invObj,
          remainingQuotas,
          manualYieldEntries,
          targetDate,
        )

        const projectedTotalWithYield = redemptionMetrics.grossValue // principal + juros

        const labelCarencia =
          graceEval.gracePeriodMonths > 0
            ? `carência de ${graceEval.gracePeriodMonths}m`
            : 'sem carência'

        items.push({
          id: `inv-carencia-${inv.id}`,
          date: releaseStr,
          type: 'out',
          origin: 'resgate_investimento',
          originLabel:
            releaseStr > todayStr ? 'Vencimento de Carência' : 'Carência Cumprida (Disponível)',
          description: `Resgate projetado (${labelCarencia}) — ${prod.title || 'Debêntures'} (${remainingQuotas} cotas) [Principal R$ ${redemptionMetrics.principal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Juros R$ ${redemptionMetrics.yieldAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]`,
          entityName: investorName,
          entityDocument: investorDoc,
          category: 'Resgate de Investimento',
          amount: projectedTotalWithYield,
          principalAmount: redemptionMetrics.principal,
          yieldAmount: redemptionMetrics.yieldAmount,
          status: releaseStr > todayStr ? 'previsto' : 'pendente',
          referenceId: inv.id,
          isManual: false,
        })
      }
    }
  })

  // b.3: Saída Mensal Recorrente de Juros de Debêntures (yield_payment_regime = 'monthly')
  // Calcula o desembolso de juros mensais recorrentes para cada investimento ativo em regime mensal
  const horizonEndStr =
    options.endDate ||
    (() => {
      const d = new Date()
      d.setFullYear(d.getFullYear() + 2)
      return d.toISOString().split('T')[0]
    })()
  const horizonStartStr = options.startDate || todayStr

  const [startYearNum, startMonthNum] = horizonStartStr.slice(0, 7).split('-').map(Number)
  const [endYearNum, endMonthNum] = horizonEndStr.slice(0, 7).split('-').map(Number)

  ;(activeInvestments || []).forEach((inv: any) => {
    const prod = Array.isArray(inv.investment_products)
      ? inv.investment_products[0]
      : inv.investment_products

    if (!prod || prod.yield_payment_regime !== 'monthly') {
      return
    }

    const remainingQuotas = Math.max(0, Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0))
    if (remainingQuotas <= 0) return

    const prof = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles
    const investorName = prof?.pj_company_name || prof?.full_name || 'Investidor'
    const investorDoc = prof?.document_number || ''

    const unitPrice = Number(inv.unit_price || prod.quota_value || 1000)
    const principal = remainingQuotas * unitPrice

    // Juros mensais calculados pela MESMA fórmula do sistema: computeInterestYield
    // Projeção contínua e sem regressões para regime de juros mensais
    const monthlyRate = parseProductRate(prod.rate)
    const monthlyYieldAmount = computeInterestYield(principal, monthlyRate, prod.type)

    if (monthlyYieldAmount <= 0) return

    // Dia de pagamento mensal do produto (default: dia 1)
    const paymentDayConfig = Math.max(1, Math.min(31, Number(prod.monthly_payment_day || 1)))

    // Avaliação de carência do produto para suprimir meses anteriores à liberação
    const invObjForGrace: InvestmentForRedemption = {
      id: inv.id,
      user_id: inv.user_id,
      product_id: inv.product_id,
      quotas: inv.quotas,
      redeemed_quotas: inv.redeemed_quotas,
      unit_price: unitPrice,
      total_value: principal,
      status: inv.status,
      transfer_date: inv.transfer_date,
      created_at: inv.created_at,
      investment_products: prod,
    }
    const graceEval = evaluateGracePeriod(invObjForGrace, new Date())
    const graceReleaseStr = graceEval.graceReleaseDate
      ? graceEval.graceReleaseDate.toISOString().split('T')[0]
      : null

    // Data de início do investimento
    const invStartDate = getInvestmentStartDate(inv)
    const invStartStr = invStartDate.toISOString().split('T')[0]

    // Percorrer cada mês do horizonte
    let curYear = startYearNum
    let curMonth = startMonthNum

    while (curYear < endYearNum || (curYear === endYearNum && curMonth <= endMonthNum)) {
      const monthKey = `${curYear}-${String(curMonth).padStart(2, '0')}`

      // Último dia do mês para ajustar o dia configurado quando não existir
      const lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate()
      const actualDay = Math.min(paymentDayConfig, lastDayOfCurMonth)
      const payDateStr = `${monthKey}-${String(actualDay).padStart(2, '0')}`

      // 1. Respeitar data de início do investimento (não projetar para meses anteriores ao aporte)
      const monthEndStr = `${monthKey}-${String(lastDayOfCurMonth).padStart(2, '0')}`
      if (monthEndStr < invStartStr) {
        curMonth++
        if (curMonth > 12) {
          curMonth = 1
          curYear++
        }
        continue
      }

      // 2. Respeitar carência: se aplicável e payDateStr for anterior à data de liberação da carência
      if (graceReleaseStr && payDateStr < graceReleaseStr) {
        curMonth++
        if (curMonth > 12) {
          curMonth = 1
          curYear++
        }
        continue
      }

      // 3. Descontar/suprimir competências já pagas ou já solicitadas pelo investidor
      if (paidOrRequestedMonthlyMonths.has(`${inv.id}:${monthKey}`)) {
        curMonth++
        if (curMonth > 12) {
          curMonth = 1
          curYear++
        }
        continue
      }

      // 4. Somente inclui no horizonte solicitado
      if (payDateStr >= horizonStartStr && payDateStr <= horizonEndStr) {
        items.push({
          id: `debenture-yield-${inv.id}-${monthKey}`,
          date: payDateStr,
          type: 'out',
          origin: 'juros_mensais_debenture',
          originLabel: 'Juros Mensais — Debênture',
          description: `Rendimento Mensal (${monthKey}) — ${prod.title || 'Debêntures'} (${remainingQuotas} cotas preservadas)`,
          entityName: investorName,
          entityDocument: investorDoc,
          category: 'Juros Mensais de Debêntures',
          amount: monthlyYieldAmount,
          principalAmount: 0,
          yieldAmount: monthlyYieldAmount,
          status: payDateStr < todayStr ? 'em_aberto' : 'previsto',
          referenceId: inv.id,
          isManual: false,
        })
      }

      curMonth++
      if (curMonth > 12) {
        curMonth = 1
        curYear++
      }
    }
  })

  // C. Processar Entradas de Recebíveis Futuros - Antecipações (credit_operations)
  ;(creditOpsData || []).forEach((op: any) => {
    const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
    const tomadorName =
      prof?.pj_company_name || prof?.full_name || op.cedente || 'Cedente não informado'
    const tomadorDoc = prof?.document_number || ''
    const docNum = op.document_number || `OP-${op.id.substring(0, 8).toUpperCase()}`

    const arr = Array.isArray(op.installments_data) ? op.installments_data : []
    const instCount = Number(op.installments || 1)

    const rawList =
      arr.length > 0
        ? arr
        : [
            {
              number: 1,
              dueDate: op.due_date || op.issue_date || todayStr,
              due_date: op.due_date || op.issue_date || todayStr,
              value: Number(op.face_value || 0),
              status: op.status,
              payment_date: op.liquidation_date || null,
              data_pagamento: op.liquidation_date || null,
            },
          ]

    rawList.forEach((inst: any, idx: number) => {
      const rawStatus = (inst.status || '').toLowerCase()
      const isPaid =
        rawStatus === 'pago' ||
        rawStatus === 'liquidado' ||
        Boolean(inst.payment_date || inst.data_pagamento)

      const dueStr = inst.dueDate || inst.due_date || op.due_date || todayStr
      const sacado = op.sacado ? ` (Sacado: ${op.sacado})` : ''

      if (isPaid) {
        // Se a projeção partiu no passado (startDate < todayStr), as parcelas baixadas
        // dentro da janela do relatório (startDate <= paymentDate <= todayStr) devem entrar
        // como ENTRADAS REALIZADAS no mês correspondente, pois ficaram de fora do Saldo Inicial.
        // Se a projeção parte de hoje/futuro, o valor já está incorporado no saldo inicial em tempo real.
        if (isPastStart && options.startDate) {
          const rawPayDate =
            inst.payment_date || inst.data_pagamento || op.liquidation_date || dueStr
          const payDateStr = String(rawPayDate).split('T')[0]

          // Somente inclui se a baixa ocorreu a partir de startDate (não estava no saldo inicial)
          // e até hoje / endDate
          if (payDateStr >= options.startDate && payDateStr <= todayStr) {
            let paidVal =
              inst.amount_paid != null && Number(inst.amount_paid) > 0
                ? Number(inst.amount_paid)
                : inst.valor_atualizado != null && Number(inst.valor_atualizado) > 0
                  ? Number(inst.valor_atualizado)
                  : inst.total_devido != null && Number(inst.total_devido) > 0
                    ? Number(inst.total_devido)
                    : inst.valor_original != null
                      ? Number(inst.valor_original)
                      : inst.original_value != null
                        ? Number(inst.original_value)
                        : inst.value != null
                          ? Number(inst.value)
                          : instCount > 0
                            ? Number(op.face_value || 0) / instCount
                            : 0

            if (paidVal > 0) {
              items.push({
                id: `ant-rec-paid-${op.id}-${idx}`,
                date: payDateStr,
                type: 'in',
                origin: 'recebivel_antecipacao',
                originLabel: 'Antecipação Realizada',
                description: `Parcela ${inst.number || idx + 1}/${Math.max(instCount, rawList.length)} (Baixada) — ${docNum}${sacado}`,
                entityName: tomadorName,
                entityDocument: tomadorDoc,
                category: 'Recebimento de Antecipação (Realizado)',
                amount: paidVal,
                status: 'realizado',
                referenceId: op.id,
                isManual: false,
              })
            }
          }
        }
        return // Parcela paga tratada; não entra como projetada futura
      }

      // Parcela PENDENTE / PREVISTA
      // Valor da parcela
      let faceVal =
        inst.valor_original != null
          ? Number(inst.valor_original)
          : inst.original_value != null
            ? Number(inst.original_value)
            : inst.value != null
              ? Number(inst.value)
              : instCount > 0
                ? Number(op.face_value || 0) / instCount
                : 0

      if (inst.valor_atualizado != null && Number(inst.valor_atualizado) > 0) {
        faceVal = Number(inst.valor_atualizado)
      } else if (inst.total_devido != null && Number(inst.total_devido) > 0) {
        faceVal = Number(inst.total_devido)
      }

      if (faceVal <= 0) return

      items.push({
        id: `ant-rec-${op.id}-${idx}`,
        date: dueStr,
        type: 'in',
        origin: 'recebivel_antecipacao',
        originLabel: 'Antecipação',
        description: `Parcela ${inst.number || idx + 1}/${Math.max(instCount, rawList.length)} — ${docNum}${sacado}`,
        entityName: tomadorName,
        entityDocument: tomadorDoc,
        category: 'Recebimento de Antecipação',
        amount: faceVal,
        status: dueStr < todayStr ? 'em_aberto' : 'previsto',
        referenceId: op.id,
        isManual: false,
      })
    })
  })

  // D. Processar Entradas de Recebíveis Futuros - CCBs (recebiveis_ccb)
  ;(ccbData || []).forEach((ccb: any) => {
    const prof = Array.isArray(ccb.profiles) ? ccb.profiles[0] : ccb.profiles
    const ccbSol = Array.isArray(ccb.ccb_solicitacoes)
      ? ccb.ccb_solicitacoes[0]
      : ccb.ccb_solicitacoes

    const tomadorName =
      prof?.pj_company_name || prof?.full_name || ccbSol?.borrower_data?.name || 'Tomador CCB'
    const tomadorDoc = prof?.document_number || ccbSol?.borrower_data?.cpf || ''
    const contractNum = ccbSol?.id
      ? `CCB-${ccbSol.id.substring(0, 8).toUpperCase()}`
      : `AQC-${ccb.id.substring(0, 8).toUpperCase()}`

    const unitVal = Number(ccb.boleto_unit_value || 0)
    const boletosList = Array.isArray(ccb.boletos) ? ccb.boletos : []

    boletosList.forEach((b: any, idx: number) => {
      const rawStatus = (b.status || '').toLowerCase()
      const isPaid =
        rawStatus === 'pago' ||
        rawStatus === 'liquidado' ||
        Boolean(b.payment_date || b.data_pagamento)

      const dueStr = b.due_date || b.vencimento || b.dueDate || todayStr

      if (isPaid) {
        // Se a projeção partiu no passado (startDate < todayStr), as parcelas de CCB baixadas
        // dentro da janela do relatório (startDate <= paymentDate <= todayStr) devem entrar
        // como ENTRADAS REALIZADAS no mês correspondente, pois ficaram de fora do Saldo Inicial.
        // Se a projeção parte de hoje/futuro, o valor já está incorporado no saldo inicial em tempo real.
        if (isPastStart && options.startDate) {
          const rawPayDate = b.payment_date || b.data_pagamento || dueStr
          const payDateStr = String(rawPayDate).split('T')[0]

          if (payDateStr >= options.startDate && payDateStr <= todayStr) {
            let paidVal =
              b.amount_paid != null && Number(b.amount_paid) > 0
                ? Number(b.amount_paid)
                : Number(b.unit_value ?? unitVal ?? 0) +
                  Number(b.interest_applied ?? 0) +
                  Number(b.penalty_applied ?? 0)

            if (paidVal <= 0) {
              paidVal =
                b.valor_atualizado != null && Number(b.valor_atualizado) > 0
                  ? Number(b.valor_atualizado)
                  : b.total_devido != null && Number(b.total_devido) > 0
                    ? Number(b.total_devido)
                    : b.original_value != null
                      ? Number(b.original_value)
                      : b.valor_original != null
                        ? Number(b.valor_original)
                        : Number(b.unit_value ?? unitVal ?? 0)
            }

            if (paidVal > 0) {
              items.push({
                id: `ccb-rec-paid-${ccb.id}-${idx}`,
                date: payDateStr,
                type: 'in',
                origin: 'recebivel_ccb',
                originLabel: 'CCB Realizada',
                description: `Boleto ${b.number || b.numero || idx + 1}/${boletosList.length || ccb.boleto_count || 1} (Baixado) — ${contractNum}`,
                entityName: tomadorName,
                entityDocument: tomadorDoc,
                category: 'Recebimento de CCB (Realizado)',
                amount: paidVal,
                status: 'realizado',
                referenceId: ccb.id,
                isManual: false,
              })
            }
          }
        }
        return // Parcela de CCB paga tratada; não entra como projetada futura
      }

      // Parcela PENDENTE / PREVISTA
      let val =
        b.valor_atualizado != null && Number(b.valor_atualizado) > 0
          ? Number(b.valor_atualizado)
          : b.total_devido != null && Number(b.total_devido) > 0
            ? Number(b.total_devido)
            : b.original_value != null
              ? Number(b.original_value)
              : b.valor_original != null
                ? Number(b.valor_original)
                : Number(b.unit_value ?? unitVal ?? 0)

      if (val <= 0) return

      items.push({
        id: `ccb-rec-${ccb.id}-${idx}`,
        date: dueStr,
        type: 'in',
        origin: 'recebivel_ccb',
        originLabel: 'CCB',
        description: `Boleto ${b.number || b.numero || idx + 1}/${boletosList.length || ccb.boleto_count || 1} — ${contractNum}`,
        entityName: tomadorName,
        entityDocument: tomadorDoc,
        category: 'Recebimento de CCB',
        amount: val,
        status: dueStr < todayStr ? 'em_aberto' : 'previsto',
        referenceId: ccb.id,
        isManual: false,
      })
    })
  })

  // E. Lançamentos Manuais Projetados
  manualEntries.forEach((m) => {
    items.push({
      id: `man-${m.id}`,
      date: m.projected_date,
      type: m.type,
      origin: m.type === 'in' ? 'manual_entrada' : 'manual_saida',
      originLabel: m.type === 'in' ? 'Manual (Entrada)' : 'Manual (Saída)',
      description: m.description,
      entityName: 'Lançamento Manual Admin',
      entityDocument: null,
      category: m.category || 'Projeção Manual',
      amount: Number(m.amount || 0),
      status: 'previsto',
      referenceId: m.id,
      isManual: true,
      manualNotes: m.notes,
    })
  })

  // Ordenar todos os itens cronologicamente crescente
  items.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date)
    if (cmp !== 0) return cmp
    return a.description.localeCompare(b.description)
  })

  // Filtro opcional por intervalo de datas se solicitado
  let filteredItems = items
  if (options.startDate) {
    filteredItems = filteredItems.filter((i) => i.date >= options.startDate!)
  }
  if (options.endDate) {
    filteredItems = filteredItems.filter((i) => i.date <= options.endDate!)
  }

  // Agrupamento por mês
  const monthMap = new Map<string, ProjectedCashflowItem[]>()
  filteredItems.forEach((item) => {
    const monthKey = item.date.slice(0, 7) // YYYY-MM
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, [])
    }
    monthMap.get(monthKey)!.push(item)
  })

  // Ordenar chaves de mês cronologicamente
  const sortedMonthKeys = Array.from(monthMap.keys()).sort()

  let runningBalance = initialCashBalance
  const monthlySummaries: MonthProjectedSummary[] = []
  let totalProjectedIn = 0
  let totalProjectedOut = 0

  sortedMonthKeys.forEach((mKey) => {
    const monthItems = monthMap.get(mKey)!
    const startBal = runningBalance
    let mIn = 0
    let mOut = 0

    monthItems.forEach((i) => {
      if (i.type === 'in') {
        mIn += i.amount
        totalProjectedIn += i.amount
      } else {
        mOut += i.amount
        totalProjectedOut += i.amount
      }
    })

    const mNet = mIn - mOut
    runningBalance += mNet

    const [year, month] = mKey.split('-')
    const dateObj = new Date(Number(year), Number(month) - 1, 1)
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1)

    monthlySummaries.push({
      monthKey: mKey,
      monthLabel,
      totalIn: mIn,
      totalOut: mOut,
      monthNet: mNet,
      startingBalance: startBal,
      accumulatedBalance: runningBalance,
      items: monthItems,
    })
  })

  const totalProjectedNet = totalProjectedIn - totalProjectedOut
  const finalAccumulatedBalance = initialCashBalance + totalProjectedNet

  return {
    initialCashBalance,
    accounts,
    items: filteredItems,
    monthlySummaries,
    totalProjectedIn,
    totalProjectedOut,
    totalProjectedNet,
    finalAccumulatedBalance,
  }
}
