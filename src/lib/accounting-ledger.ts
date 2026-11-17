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
  /**
   * true quando o lançamento é ESPELHO CONTÁBIL automático (parcela de CCB/
   * Operação, liquidação, resgate ou imposto de resgate — criado por trigger de
   * banco). Alimenta DRE/DFC/Livro Caixa e TAMBÉM o saldo bancário: provado em
   * dados, os espelhos representam fluxo real da conta (entradas de parcelas e
   * saídas de resgate passaram pelo banco). A deduplicação contra
   * movimentacoes_caixa (passo 8) e contra boletos/expenses garante que cada
   * evento entre uma única vez no saldo.
   */
  is_bank_mirror?: boolean
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
  /**
   * Líquido (entradas − saídas) das transações de tesouraria que são ESPELHOS
   * contábeis automáticos (criadas por trigger) por conta bancária — apenas
   * diagnóstico: quanto do saldo vem de espelhos automáticos.
   */
  bankMirrorNetByAccount: Record<string, number>
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
 * Cada transação carrega is_bank_mirror: true quando é espelho contábil
 * automático (parcela/liquidação/resgate criado por trigger). Os espelhos
 * permanecem na lista (DRE/DFC/Livro Caixa continuam vendo tudo) e TAMBÉM
 * somam no saldo por conta bancária (balancesByAccount / accountSummaries):
 * representam fluxo bancário real, já deduplicado contra movimentacoes_caixa.
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
        'id, amount, description, payment_date, due_date, status, bank_account_id, suppliers(company_name), supplier_id, category, recurrence_group_id',
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
        'id, type, category, amount, description, date, external_ref, expense_id, bank_account_id, created_by, referencia_tipo, reference_id',
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

  // Lançamento sem conta explícita NÃO é atribuído a nenhuma conta bancária:
  // cai apenas no saldo global (Livro Caixa/DRE/DFC). Atribuir tudo à conta
  // ativa inflava artificialmente o caixa da conta principal (BNK Digital),
  // absorvendo lançamentos operacionais que não passaram por ela.
  const resolveBank = (id?: string | null) => {
    if (id && bankMap.has(id)) {
      return { id, info: bankMap.get(id)! }
    }
    return { id: null, info: null }
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

  // Padrões de external_ref criados por TRIGGER de banco (espelhos contábeis
  // automáticos, sem fluxo bancário real): parcelas de CCB (ccb-bol-…), parcelas
  // de operação (op-bol-…), liquidação integral (op-liq-…), resgates
  // (redemption-…) e imposto retido no resgate (tax-redemption-…). Lançamentos
  // manuais de tesouraria (ex.: manual-credit-…) NÃO são espelhos.
  const MIRROR_REF = /^(ccb-bol|op-bol|op-liq|redemption|tax-redemption)-/

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

  // Coleta referências já presentes em movimentações de caixa, guardando também o
  // SENTIDO do fluxo (in/out) de cada movimentação. Usada no passo 3 para suprimir
  // a transação de tesouraria espelho — de forma SIMÉTRICA: um espelho real de
  // parcela/liquidação/resgate sempre tem o mesmo sentido do evento; colisão de
  // referência com sentido oposto indica um lançamento legítimo e distinto, que
  // deve ser mantido (corrige a supressão assimétrica do passo 3).
  const movsExternalRefs = new Map<string, 'in' | 'out'>()
  ;(movs || []).forEach((m: any) => {
    if (!m.referencia_id) return
    const flow: 'in' | 'out' = classifyMovimentacaoCaixaAccounting(m.tipo)
    const refs = [`op-liq-${m.referencia_id}`, `redemption-${m.referencia_id}`]
    if (m.referencia_numero) {
      refs.push(`op-bol-${m.referencia_id}-${m.referencia_numero}`)
      refs.push(`ccb-bol-${m.referencia_id}-${m.referencia_numero}`)
      refs.push(String(m.referencia_numero))
    }
    refs.forEach((ref) => {
      if (!movsExternalRefs.has(ref)) movsExternalRefs.set(ref, flow)
    })
  })

  // 3. Transações do Tesoureiro
  const treasuryExternalRefs = new Set<string>()
  // Mapa external_ref -> { sentido, valor } das transações de tesouraria MANTIDAS
  // no livro. Usado na deduplicação simétrica com movimentacoes_caixa (passo 8):
  // uma movimentação de caixa que referencia o mesmo evento (mesma parcela,
  // liquidação ou resgate) com o mesmo sentido não pode somar duas vezes no
  // saldo da conta.
  const treasuryRefTypes = new Map<string, { type: 'in' | 'out'; value: number; date: string }>()
  ;(tt || []).forEach((tx: any) => {
    if (isTaxProvisionTransaction(tx)) return

    const txType: 'in' | 'out' = tx.type === 'out' ? 'out' : 'in'
    const ref = tx.external_ref ? String(tx.external_ref) : null
    if (ref) {
      const movFlow = movsExternalRefs.get(ref)
      // Espelho já lançado como movimentação de caixa, no MESMO sentido: suprime
      // a transação para não duplicar o evento no saldo. Sentido oposto não
      // suprime — é lançamento legítimo e complementar. IMPORTANTE: mesmo
      // suprimida, a referência fica registrada em treasuryRefTypes — é o passo 8
      // que a consulta para NÃO lançar também a movimentação espelho. Registrar
      // depois do return (como antes) fazia a dedup do passo 8 nunca casar.
      if (movFlow && movFlow === txType) {
        if (!treasuryRefTypes.has(ref)) {
          treasuryRefTypes.set(ref, {
            type: txType,
            value: Number(tx.amount || 0),
            date: normalizeAccountingDate(tx.date),
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
          date: normalizeAccountingDate(tx.date),
        })
      }
    }

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
      is_bank_mirror: Boolean(ref && MIRROR_REF.test(ref)),
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // Mapa recebível -> external_refs das parcelas (boletos) pagas, nas formas
  // usadas pela tesouraria: ccb-bol-{recId}-{indice} e op-bol-{recId}-{indice},
  // onde o índice é a posição 1-based no array boletos — que pode diferir do
  // campo numero do boleto. Usado no passo 8 para casar movimentações de caixa
  // que apontam para o recebível (ou para a parcela) com as transações espelho.
  const recebivelParcelaRefs = new Map<string, Set<string>>()
  ;(recs || []).forEach((rec: any) => {
    const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
    const refs = new Set<string>()
    boletos.forEach((bol: any, i: number) => {
      const bolStatus = (bol.status || '').toLowerCase()
      if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return
      refs.add(`ccb-bol-${rec.id}-${i + 1}`)
      refs.add(`op-bol-${rec.id}-${i + 1}`)
    })
    if (refs.size > 0) recebivelParcelaRefs.set(rec.id, refs)
  })

  // Ponte operação ↔ recebível: movimentações de caixa de parcelas apontam para a
  // OPERAÇÃO de crédito (referencia_id = credit_operations.id), enquanto as refs
  // de tesouraria das parcelas usam o id do RECEBÍVEL (ccb-bol-{recId}-{n}).
  // recebiveis_ccb.ccb_id liga os dois mundos; sem essa ponte o casamento do
  // passo 8 nunca casa (causa do saldo ~R$ 172 mil acima na conta ativa).
  const opIdToRecIds = new Map<string, string[]>()
  ;(recs || []).forEach((rec: any) => {
    if (rec.ccb_id) {
      const key = String(rec.ccb_id)
      const list = opIdToRecIds.get(key) || []
      list.push(String(rec.id))
      opIdToRecIds.set(key, list)
    }
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
      // A tesouraria pode ter registrado a mesma parcela com a forma op-bol-...
      // (Operação) — ambas apontam para o índice 1-based do array boletos.
      const altRef = `op-bol-${rec.id}-${parcela}`

      // Já lançada pela tesouraria em QUALQUER uma das formas — a parcela entra
      // uma única vez no livro.
      if (treasuryExternalRefs.has(extRef) || treasuryExternalRefs.has(altRef)) return

      const val =
        Number(bol.valor || bol.unit_value || 0) +
        Number(bol.interest_applied || 0) +
        Number(bol.penalty_applied || 0)
      if (!val) return
      treasuryExternalRefs.add(extRef)
      treasuryExternalRefs.add(altRef)
      const dataPagBoleto = normalizeAccountingDate(pDate)
      treasuryRefTypes.set(extRef, { type: 'in', value: val, date: dataPagBoleto })
      treasuryRefTypes.set(altRef, { type: 'in', value: val, date: dataPagBoleto })

      const bInfo = resolveBank(bol.bank_account_id)
      transactions.push({
        id: `ccb-bol-${rec.id}-${parcela}`,
        date: normalizeAccountingDate(pDate),
        type: 'in',
        category: 'Recebimento de Parcelas - CCB',
        description: `Recebimento Parcela ${bol.numero || bol.number || parcela} - CCB nº ${rec.ccb_id ? String(rec.ccb_id).substring(0, 8) : String(rec.id).substring(0, 8)} - Tomador: ${tomador}`,
        value: val,
        is_bank_mirror: true,
        bank_account_id: bInfo.id,
        bank_account_info: bInfo.info,
      })
    })
  })

  // 5. Despesas pagas
  ;(exps || []).forEach((exp: any) => {
    if (exp.status === 'paid') {
      // Despesa recorrente sem pagamento realizado não entra no livro caixa
      if (exp.recurrence_group_id && !exp.payment_date) return
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
        is_bank_mirror: true,
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

    // Deduplicação simétrica Tesouraria ↔ Movimentações de Caixa (o espelho do
    // passo 3): se esta movimentação referencia o MESMO evento financeiro que
    // uma transação de tesouraria já lançada (mesma parcela de CCB/Operação,
    // liquidação de recebível ou resgate), com o MESMO sentido de fluxo, ela
    // NÃO pode somar de novo no saldo da conta. Formas de referência cobertas:
    // op-liq-{id}, redemption-{id}, op-bol-{id}-{n} e ccb-bol-{id}-{n} — além do
    // casamento complementar por índice de boleto + valor (parcela individual ou
    // soma das já recebidas), que cobre o desalinhamento entre o campo numero da
    // parcela e o índice 1-based usado pela tesouraria. Lançamentos de sentido
    // oposto (ex.: tarifa complementar) nunca são suprimidos.
    if (mov.referencia_id) {
      const rid = String(mov.referencia_id)
      // A movimentação pode apontar para a OPERAÇÃO de crédito (parcela_operacao)
      // em vez do recebível — resolve via ponte ccb_id (opIdToRecIds).
      const recIdsDaOperacao = opIdToRecIds.get(rid) || []
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
      const mesmoSentidoExato = refsCandidatas.some(
        (ref) => treasuryRefTypes.get(ref)?.type === type,
      )

      // Casamento complementar por índice de boleto: a movimentação referencia o
      // recebível de CCB (diretamente ou via operação) e as transações de
      // tesouraria das parcelas usam ccb-bol-{recId}-{indice}. Exige mesmo
      // sentido de fluxo e valor compatível para só suprimir o espelho real.
      let casouPorIndice = false
      if (!mesmoSentidoExato) {
        const conjuntos = [recebivelParcelaRefs.get(rid)]
        recIdsDaOperacao.forEach((recId) => conjuntos.push(recebivelParcelaRefs.get(recId)))
        const refsParcelas = conjuntos.find((s) => s && s.size > 0)
        if (refsParcelas) {
          const valoresMesmoSentido: number[] = []
          treasuryRefTypes.forEach((info, ref) => {
            if (refsParcelas.has(ref) && info.type === type) {
              valoresMesmoSentido.push(info.value)
            }
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

      // Última rede de segurança: movimentações que espelham um evento (parcela
      // da operação, recebível, liquidação) casadas por valor + data + sentido
      // contra as refs de evento da tesouraria — cobre ccb_id nulo/desalinhado.
      let casouPorValorData = false
      if (!mesmoSentidoExato && !casouPorIndice) {
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
          const movMs = new Date(mov.created_at).getTime()
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

      if (mesmoSentidoExato || casouPorIndice || casouPorValorData) return
    }

    // Movimentação de caixa que referencia um evento automático (parcela,
    // recebível, liquidação, resgate) é espelho contábil: entrou no livro por
    // trigger, não por fluxo bancário manual. Não soma no saldo da conta.
    const refTipoNormMirror = refTipo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    const ehMovEspelho =
      Boolean(mov.referencia_id) &&
      [
        'parcela_operacao',
        'recebivel',
        'liquidacao_recebivel',
        'parcela',
        'boleto',
        'resgate_investimento',
        'credit_operation',
      ].includes(refTipoNormMirror)

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
      is_bank_mirror: ehMovEspelho,
      bank_account_id: bInfo.id,
      bank_account_info: bInfo.info,
    })
  })

  // Ordenação cronológica crescente
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calcula saldos acumulados e mapa de saldo por conta bancária
  let runningGlobal = 0
  const balancesByAccount: Record<string, number> = {}
  // Líquido (in − out) dos ESPELHOS contábeis por conta — apenas diagnóstico.
  const bankMirrorNetByAccount: Record<string, number> = {}

  // Inicializa mapa de contas conhecidas
  ;(companyBanks || []).forEach((b: any) => {
    balancesByAccount[b.id] = 0
  })

  const cutoffDate = options.asOfDate || null

  const calculatedTransactions: AccountingTransaction[] = []

  for (const t of transactions) {
    const delta = t.type === 'in' ? t.value : -t.value
    runningGlobal += delta

    // Espelho contábil (parcela ccb-bol/op-bol, liquidação op-liq, resgate
    // redemption) representa FLUXO BANCÁRIO REAL e volta a somar no saldo da
    // conta: provado em dados vivos, as entradas de parcelas e as saídas de
    // resgate passaram pela conta (a supressão v0.0.1183 zerava ~R$ 172 mil de
    // entradas reais na BNK Digital, produzindo o saldo −R$ 31.991,44). Cada
    // evento entra uma única vez porque o passo 8 deduplica as movimentações de
    // caixa que repetem o mesmo evento (mesmo sentido) e o passo 4/5/7 dedup
    // boletos, despesas e resgates contra a tesouraria.
    const effectiveDelta = delta
    if (effectiveDelta !== 0 && (!cutoffDate || t.date <= cutoffDate)) {
      const accId = t.bank_account_id || activeBankId || 'default'
      balancesByAccount[accId] = (balancesByAccount[accId] ?? 0) + effectiveDelta
    }
    if (t.is_bank_mirror && (!cutoffDate || t.date <= cutoffDate)) {
      const accId = t.bank_account_id || activeBankId || 'default'
      bankMirrorNetByAccount[accId] = (bankMirrorNetByAccount[accId] ?? 0) + delta
    }

    calculatedTransactions.push({
      ...t,
      accumulated_balance: runningGlobal,
    })
  }

  // Se options.asOfDate foi passado, o saldo total de caixa é a soma de todas as contas da securitizadora até essa data
  const totalCashBalance = Object.entries(balancesByAccount)
    .filter(([accId]) => accId !== 'default')
    .reduce((sum, [, v]) => sum + (v || 0), 0)

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
    bankMirrorNetByAccount,
  }
}
