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
  status: 'previsto' | 'pendente' | 'em_aberto'
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
  // Se options.startDate for informada:
  // - Se for uma data no passado (ou no início do mês), apura o saldo exatamente até a véspera (data-base inicial)
  // Se for maior ou igual a hoje (projeção para frente), usa o saldo atual em tempo real
  let asOfCutoff: string | undefined = undefined
  if (options.startDate) {
    if (options.startDate < todayStr) {
      // Saldo no início da data de projeção: transações anteriores a startDate
      const d = new Date(options.startDate + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      asOfCutoff = d.toISOString().split('T')[0]
    }
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
        early_redemption_discount_pct
      )
    `)
    .in('status', ['approved', 'transfer_confirmed'])

  if (invErr) {
    console.error('Erro ao buscar investimentos para carência:', invErr)
  }

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

  // C. Processar Entradas de Recebíveis Futuros - Antecipações (credit_operations)
  ;(creditOpsData || []).forEach((op: any) => {
    const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
    const tomadorName =
      prof?.pj_company_name || prof?.full_name || op.cedente || 'Cedente não informado'
    const tomadorDoc = prof?.document_number || ''
    const docNum = op.document_number || `OP-${op.id.substring(0, 8).toUpperCase()}`

    const isOpFullyPaid =
      ((op.status || '').toLowerCase() === 'pago' ||
        (op.status || '').toLowerCase() === 'liquidado') &&
      Boolean(op.liquidation_date)

    if (isOpFullyPaid) {
      // Já liquidado totalmente no passado — não entra na projeção de fluxo futuro
      return
    }

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
            },
          ]

    rawList.forEach((inst: any, idx: number) => {
      const rawStatus = (inst.status || '').toLowerCase()
      const isPaid =
        rawStatus === 'pago' ||
        rawStatus === 'liquidado' ||
        Boolean(inst.payment_date || inst.data_pagamento)

      if (isPaid) return // parcela já recebida

      const dueStr = inst.dueDate || inst.due_date || op.due_date || todayStr

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

      const sacado = op.sacado ? ` (Sacado: ${op.sacado})` : ''

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

      if (isPaid) return // boleto já quitado

      const dueStr = b.due_date || b.vencimento || b.dueDate || todayStr

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
