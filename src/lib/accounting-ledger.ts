import { supabase } from '@/lib/supabase/client'
import {
  classifyMovimentacaoCaixaAccounting,
  isTaxProvisionTransaction,
} from '@/lib/financial-classification'
import {
  getConsolidatedCaptacoes,
  type RawInvestment,
  type RawSubscription,
} from '@/lib/captacoes-service'

export interface AccountingTransaction {
  id: string
  date: string // YYYY-MM-DD
  type: 'in' | 'out'
  category: string
  description: string
  value: number
  accumulated_balance: number
  bank_account_id?: string | null
  bank_account_info?: {
    bank_name: string
    branch?: string | null
    account_number: string
  } | null
}

export interface BankAccountBalanceSummary {
  id: string
  bank_name: string
  branch?: string | null
  account_number: string
  is_active: boolean
  balance: number
}

export interface AccountingLedgerResult {
  transactions: AccountingTransaction[]
  balancesByAccount: Record<string, number>
  totalCashBalance: number
  accountSummaries: BankAccountBalanceSummary[]
}

export interface FetchAccountingOptions {
  inicio?: string // YYYY-MM-DD
  fim?: string // YYYY-MM-DD
  asOfDate?: string // YYYY-MM-DD (saldo apurado até esta data inclusive)
}

/**
 * Normaliza uma data para o formato YYYY-MM-DD evitando deslocamento de timezone.
 */
export function normalizeAccountingDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0]
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]

  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

/**
 * Executa a consolidação contábil oficial do Livro Caixa das fontes primárias:
 * - Captações / Aportes de Debêntures (investments + debenture_subscriptions deduplicados)
 * - Aquisições de CCB (recebiveis_ccb)
 * - Transações do Tesoureiro (treasury_transactions)
 * - Boletos de CCB quitados (recebiveis_ccb.boletos)
 * - Despesas pagas (expenses)
 * - Operações de crédito pagas (credit_operations)
 * - Resgates pagos (investment_redemptions)
 * - Movimentações de Caixa avulsas deduplicadas (movimentacoes_caixa)
 *
 * Garante consistência idêntica entre Livro Caixa (useAccounting / /admin/accounting),
 * Extrato Bancário (/admin/bank-accounts), DRE, DFC e Fluxo de Caixa Projetado (/reports).
 */
export async function fetchConsolidatedAccountingLedger(
  options: FetchAccountingOptions = {},
): Promise<AccountingLedgerResult> {
  const [
    { data: subs },
    { data: invs },
    { data: recs },
    { data: exps },
    { data: ops },
    { data: reds },
    { data: movs },
    { data: tt },
    { data: companyBanks },
    { data: mapMovs },
  ] = await Promise.all([
    supabase
      .from('debenture_subscriptions')
      .select(
        'id, investor_name, document_number, total_amount, unit_price, quantity, subscription_date, created_at, status, investment_id, investments(quotas, redeemed_quotas, unit_price, transfer_value, transfer_date, status)',
      )
      .is('deleted_at', null),
    supabase
      .from('investments')
      .select(
        'id, user_id, quotas, redeemed_quotas, unit_price, total_value, transfer_value, transfer_date, status, created_at, profiles!investments_user_id_fkey(id, full_name, document_number, pj_company_name), debenture_subscriptions(id, total_amount, subscription_date, status)',
      ),
    supabase
      .from('recebiveis_ccb')
      .select(
        'id, acquisition_value, created_at, boletos, ccb_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
      ),
    supabase
      .from('expenses')
      .select(
        'id, amount, description, payment_date, due_date, status, bank_account_id, suppliers(company_name), supplier_id, category',
      ),
    supabase
      .from('credit_operations')
      .select(
        'id, requested_value, face_value, issue_date, created_at, updated_at, status, sacado, liquidation_date, liquidation_value, operation_calculations(net_value)',
      ),
    supabase
      .from('investment_redemptions')
      .select(
        'id, net_value, updated_at, created_at, status, profiles!investment_redemptions_user_id_fkey(full_name, pj_company_name)',
      ),
    supabase
      .from('movimentacoes_caixa')
      .select(
        'id, tipo, categoria, descricao, valor, user_id, created_at, referencia_id, referencia_tipo, referencia_numero, bank_account_id',
      )
      .is('deleted_at', null),
    supabase
      .from('treasury_transactions')
      .select(
        'id, type, category, amount, description, date, external_ref, expense_id, bank_account_id',
      )
      .is('deleted_at', null)
      .or('status.eq.Confirmado,status.is.null')
      .or(
        'category.in.("Recebimento de Parcelas - CCB","Recebimento de Parcelas - Operação","Liquidação de Recebível","Resgate de Investidor","Resgates e Rendimentos","Receita Avulsa","Crédito em Conta","Receitas Diversas","Aporte de Capital","Rendimento Financeiro","Reembolso"),external_ref.like.manual-credit-%',
      ),
    supabase
      .from('company_bank_accounts')
      .select('id, bank_name, branch, account_number, is_active')
      .order('is_active', { ascending: false }),
    supabase
      .from('mapeamento_movimentacoes')
      .select('movimentacao_caixa_id, origem_tabela, origem_id')
      .in('origem_tabela', ['fornecedores', 'despesas', 'investment_redemptions']),
  ])

  const expenseMap = new Map<
    string,
    { payment_date: string | null; due_date: string | null; status: string }
  >()
  ;(exps || []).forEach((e: any) => {
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
  ;(reds || []).forEach((r: any) => {
    redemptionMap.set(r.id, {
      updated_at: r.updated_at,
      created_at: r.created_at,
      status: r.status,
    })
  })

  const movIdToExpenseId = new Map<string, string>()
  ;(mapMovs || []).forEach((m: any) => {
    if (m.movimentacao_caixa_id && m.origem_id) {
      if (m.origem_tabela === 'fornecedores' || m.origem_tabela === 'despesas') {
        movIdToExpenseId.set(m.movimentacao_caixa_id, m.origem_id)
      }
    }
  })

  const bankMap = new Map<
    string,
    { bank_name: string; branch: string | null; account_number: string; is_active: boolean }
  >()
  let activeBankId: string | null = null
  let activeBankInfo: {
    bank_name: string
    branch: string | null
    account_number: string
    is_active: boolean
  } | null = null

  ;(companyBanks || []).forEach((b: any) => {
    const info = {
      bank_name: b.bank_name,
      branch: b.branch,
      account_number: b.account_number,
      is_active: Boolean(b.is_active),
    }
    bankMap.set(b.id, info)
    if (b.is_active && !activeBankId) {
      activeBankId = b.id
      activeBankInfo = info
    }
  })

  if (!activeBankInfo && companyBanks && companyBanks.length > 0) {
    const first = companyBanks[0]
    activeBankId = first.id
    activeBankInfo = {
      bank_name: first.bank_name,
      branch: first.branch,
      account_number: first.account_number,
      is_active: Boolean(first.is_active),
    }
  }

  const resolveBank = (id?: string | null) => {
    if (id && bankMap.has(id)) {
      return { id, info: bankMap.get(id)! }
    }
    return { id: activeBankId, info: activeBankInfo }
  }

  const transactions: Omit<AccountingTransaction, 'accumulated_balance'>[] = []

  // 1. Captações
  const rawInvs = (invs || []) as RawInvestment[]
  const rawSubs = (subs || []) as RawSubscription[]
  const captacoes = getConsolidatedCaptacoes(rawInvs, rawSubs)

  captacoes.forEach((cap) => {
    const bInfo = resolveBank(null)
    transactions.push({
      id: cap.id,
      date: cap.date,
      type: 'in',
      category: 'Subscrição de Debênture',
      description: `Subscrição / Aporte — ${cap.investorName}`,
      value: cap.valor,
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // 2. Aquisições CCB
  ;(recs || []).forEach((rec: any) => {
    const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
    const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
    const valAcq = Number(rec.acquisition_value || 0)
    const bInfo = resolveBank(null)
    transactions.push({
      id: `acq-${rec.id}`,
      date: normalizeAccountingDate(rec.created_at),
      type: 'out',
      category: 'Aquisição de CCB',
      description: `Aquisição de CCB — ${tomador} — R$ ${valAcq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      value: valAcq,
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // Coleta referências já presentes em movimentações de caixa
  const movsExternalRefs = new Set<string>()
  ;(movs || []).forEach((m: any) => {
    if (m.referencia_id) {
      movsExternalRefs.add(`op-liq-${m.referencia_id}`)
      movsExternalRefs.add(`redemption-${m.referencia_id}`)
      if (m.referencia_numero) {
        movsExternalRefs.add(`op-bol-${m.referencia_id}-${m.referencia_numero}`)
        movsExternalRefs.add(String(m.referencia_numero))
      }
    }
  })

  // 3. Transações do Tesoureiro
  const treasuryExternalRefs = new Set<string>()
  ;(tt || []).forEach((tx: any) => {
    if (isTaxProvisionTransaction(tx)) return

    const ref = tx.external_ref ? String(tx.external_ref) : null
    if (ref && movsExternalRefs.has(ref)) return
    if (ref && treasuryExternalRefs.has(ref)) return
    if (ref) treasuryExternalRefs.add(ref)

    const txType: 'in' | 'out' = tx.type === 'out' ? 'out' : 'in'
    const bInfo = resolveBank(tx.bank_account_id)
    transactions.push({
      id: `tt-${tx.id}`,
      type: txType,
      category:
        tx.category ||
        (txType === 'out' ? 'Resgate de Investidor' : 'Recebimento de Parcelas - CCB'),
      description: tx.description,
      value: Number(tx.amount || 0),
      date: normalizeAccountingDate(tx.date),
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // 4. Boletos de CCB quitados (dedup com treasuryExternalRefs)
  ;(recs || []).forEach((rec: any) => {
    const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
    const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

    const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
    boletos.forEach((bol: any, i: number) => {
      const bolStatus = (bol.status || '').toLowerCase()
      if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return

      const pDate =
        bol.data_pagamento ||
        bol.payment_date ||
        bol.data_liquidacao ||
        bol.data_vencimento ||
        bol.due_date
      if (!pDate) return

      const parcela = i + 1
      const extRef = bol.external_ref ? String(bol.external_ref) : `ccb-bol-${rec.id}-${parcela}`

      if (treasuryExternalRefs.has(extRef)) return
      treasuryExternalRefs.add(extRef)

      const val =
        Number(bol.valor || bol.unit_value || 0) +
        Number(bol.interest_applied || 0) +
        Number(bol.penalty_applied || 0)
      if (!val) return

      const bInfo = resolveBank(bol.bank_account_id)
      transactions.push({
        id: `ccb-bol-${rec.id}-${parcela}`,
        date: normalizeAccountingDate(pDate),
        type: 'in',
        category: 'Recebimento de Parcelas - CCB',
        description: `Recebimento Parcela ${bol.numero || bol.number || parcela} - CCB nº ${rec.ccb_id ? String(rec.ccb_id).substring(0, 8) : String(rec.id).substring(0, 8)} - Tomador: ${tomador}`,
        value: val,
        bank_account_id: bInfo.id,
        bank_account_info: bInfo.info,
      })
    })
  })

  // 5. Despesas pagas
  ;(exps || []).forEach((exp: any) => {
    if (exp.status === 'paid') {
      const sup = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
      const fornecedor = sup?.company_name
      const bInfo = resolveBank(exp.bank_account_id)
      transactions.push({
        id: `exp-${exp.id}`,
        date: normalizeAccountingDate(exp.payment_date || exp.due_date),
        type: 'out',
        category: fornecedor ? 'Pagamento Fornecedor' : 'Despesa',
        description: fornecedor ? `Fornecedor — ${fornecedor}` : `Despesa — ${exp.description}`,
        value: Number(exp.amount || 0),
        bank_account_id: bInfo.id,
        bank_account_info: bInfo.info,
      })
    }
  })

  // 6. Operações de Crédito pagas
  ;(ops || []).forEach((op: any) => {
    if (['pago', 'liquidado'].includes(op.status || '')) {
      const calc = Array.isArray(op.operation_calculations)
        ? op.operation_calculations[0]
        : op.operation_calculations
      const val = calc?.net_value || op.requested_value
      const bInfo = resolveBank(null)
      transactions.push({
        id: `op-out-${op.id}`,
        date: normalizeAccountingDate(op.issue_date),
        type: 'out',
        category: 'Desembolso de Crédito',
        description: `Operação de Crédito — Sacado: ${op.sacado}`,
        value: Number(val || 0),
        bank_account_id: bInfo.id,
        bank_account_info: bInfo.info,
      })
    }
  })

  // 7. Resgates pagos
  ;(reds || []).forEach((red: any) => {
    if (red.status === 'paid') {
      if (treasuryExternalRefs.has(`redemption-${red.id}`)) {
        return
      }
      const prof = Array.isArray(red.profiles) ? red.profiles[0] : red.profiles
      const investor = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
      const bInfo = resolveBank(null)
      transactions.push({
        id: `red-${red.id}`,
        date: normalizeAccountingDate(red.updated_at || red.created_at),
        type: 'out',
        category: 'Resgate de Investimento',
        description: `Resgate — Investidor: ${investor}`,
        value: Number(red.net_value || 0),
        bank_account_id: bInfo.id,
        bank_account_info: bInfo.info,
      })
    }
  })

  // 8. Movimentações de Caixa
  const categoriaLabel: Record<string, string> = {
    liquidação_recebível: 'Liquidação de Recebível',
    liquidacao_recebivel: 'Liquidação de Recebível',
    juros_entrada: 'Juros Recebidos',
    transferencia_entre_contas: 'Transferência entre Contas',
    fornecedor: 'Pagamento Fornecedor',
    despesa: 'Despesa Operacional',
  }

  ;(movs || []).forEach((mov: any) => {
    const catLower = (mov.categoria || '').toLowerCase()
    const refTipo = (mov.referencia_tipo || '').toLowerCase()

    const linkedExpenseId =
      movIdToExpenseId.get(mov.id) || (refTipo === 'despesa' ? mov.referencia_id : null)
    if (linkedExpenseId && expenseMap.has(linkedExpenseId)) {
      return
    }
    if (catLower === 'fornecedor' || catLower === 'despesa') {
      if (linkedExpenseId || (mov.referencia_id && expenseMap.has(mov.referencia_id))) {
        return
      }
    }

    if (refTipo === 'resgate_investimento' && mov.referencia_id) {
      const redId = String(mov.referencia_id)
      const redMatch = redemptionMap.get(redId)
      if (redMatch && redMatch.status === 'paid') {
        return
      }
    }

    let effectiveDate = normalizeAccountingDate(mov.created_at)
    if (
      refTipo === 'resgate_investimento' &&
      mov.referencia_id &&
      redemptionMap.has(mov.referencia_id)
    ) {
      const red = redemptionMap.get(mov.referencia_id)!
      effectiveDate = normalizeAccountingDate(red.updated_at || red.created_at)
    }

    const type: 'in' | 'out' = classifyMovimentacaoCaixaAccounting(mov.tipo)
    const category =
      categoriaLabel[(mov.categoria || '').toLowerCase()] ||
      mov.categoria ||
      'Movimentação de Caixa'
    const bInfo = resolveBank(mov.bank_account_id)
    transactions.push({
      id: `mov-${mov.id}`,
      date: effectiveDate,
      type,
      category,
      description: mov.descricao || category,
      value: Number(mov.valor || 0),
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // Ordenação cronológica crescente
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calcula saldos acumulados e mapa de saldo por conta bancária
  let runningGlobal = 0
  const balancesByAccount: Record<string, number> = {}

  // Inicializa mapa de contas conhecidas
  ;(companyBanks || []).forEach((b: any) => {
    balancesByAccount[b.id] = 0
  })

  const cutoffDate = options.asOfDate || null

  const calculatedTransactions: AccountingTransaction[] = []

  for (const t of transactions) {
    const delta = t.type === 'in' ? t.value : -t.value
    runningGlobal += delta
    const accId = t.bank_account_id || activeBankId || 'default'

    // Se houver asOfDate, só acumula nos saldos de conta se t.date <= cutoffDate
    if (!cutoffDate || t.date <= cutoffDate) {
      balancesByAccount[accId] = (balancesByAccount[accId] ?? 0) + delta
    }

    calculatedTransactions.push({
      ...t,
      accumulated_balance: runningGlobal,
    })
  }

  // Se options.asOfDate foi passado, o saldo total de caixa é a soma de todas as contas da securitizadora até essa data
  const totalCashBalance = Object.values(balancesByAccount).reduce((sum, v) => sum + (v || 0), 0)

  // Monta resumo das contas
  const accountSummaries: BankAccountBalanceSummary[] = (companyBanks || []).map((b: any) => ({
    id: b.id,
    bank_name: b.bank_name,
    branch: b.branch,
    account_number: b.account_number,
    is_active: Boolean(b.is_active),
    balance: balancesByAccount[b.id] ?? 0,
  }))

  // Filtro de exibição por início e fim se solicitado
  let filteredList = calculatedTransactions
  if (options.inicio || options.fim) {
    filteredList = calculatedTransactions.filter((t) => {
      if (options.inicio && t.date < options.inicio) return false
      if (options.fim && t.date > options.fim) return false
      return true
    })
  }

  return {
    transactions: filteredList.reverse(),
    balancesByAccount,
    totalCashBalance,
    accountSummaries,
  }
}
