/**
 * Utilitário centralizado para recuperação e consistência de captações de investidores.
 *
 * Fonte da verdade: tabela `investments` (a mesma da Carteira de Investidores),
 * com cruzamento bidirecional e deduplicação com `debenture_subscriptions`.
 *
 * Regras cruciais:
 * 1. Todos os aportes (ativos, resgatados, encerrados) são considerados nas demonstrações
 *    financeiras (DRE, DFC, Livro Caixa). O valor histórico original deve ser mantido
 *    mesmo após o resgate.
 * 2. Somente aportes rejeitados ou cancelados ('cancelled', 'cancelado', 'rejected', 'rejeitado')
 *    são descartados.
 * 3. A cadeia de valor histórico para um investimento é:
 *    - total_value original (quando > 0)
 *    - fallback transfer_value (quando > 0)
 *    - fallback (quotas + redeemed_quotas) * unit_price
 *    - fallback subscrição total_amount se houver vínculo
 * 4. A data é a data real de transferência (transfer_date) ou subscription_date, com fallback para created_at.
 * 5. Deduplicação infalível: se um aporte existe em investments e debenture_subscriptions,
 *    conta EXATAMENTE uma vez.
 */

export interface CaptacaoItem {
  id: string // ex: inv-{id} ou sub-{id}
  source: 'investments' | 'debenture_subscriptions'
  investmentId: string | null
  subscriptionId: string | null
  investorName: string
  investorDocument?: string | null
  date: string // YYYY-MM-DD
  valor: number
  status: string
  quotas: number
  redeemedQuotas: number
  unitPrice: number
}

export interface RawInvestment {
  id: string
  user_id?: string | null
  quotas?: number | null
  redeemed_quotas?: number | null
  unit_price?: number | null
  total_value?: number | null
  transfer_value?: number | null
  transfer_date?: string | null
  status?: string | null
  created_at?: string | null
  profiles?:
    | {
        id?: string
        full_name?: string | null
        document_number?: string | null
        pj_company_name?: string | null
      }
    | {
        id?: string
        full_name?: string | null
        document_number?: string | null
        pj_company_name?: string | null
      }[]
    | null
  investment_products?:
    | {
        id?: string
        title?: string | null
        quota_value?: number | null
      }
    | {
        id?: string
        title?: string | null
        quota_value?: number | null
      }[]
    | null
  debenture_subscriptions?:
    | {
        id?: string
        total_amount?: number | null
        subscription_date?: string | null
        status?: string | null
      }[]
    | null
}

export interface RawSubscription {
  id: string
  investor_name?: string | null
  document_number?: string | null
  total_amount?: number | null
  unit_price?: number | null
  quantity?: number | null
  subscription_date?: string | null
  created_at?: string | null
  status?: string | null
  investment_id?: string | null
  investments?: any
}

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD evitando fuso.
 */
export function normalizeDateOnly(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0]
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

const CANCELLED_STATUSES = new Set(['cancelado', 'cancelled', 'rejeitado', 'rejected'])

/**
 * Consolida todas as captações de investidores de forma unificada e deduplicada.
 * Itera prioritariamente sobre a tabela investments e, em seguida, cobre eventuais
 * debenture_subscriptions avulsas (que não tenham investment_id ou cujo investimento
 * não tenha sido recuperado).
 */
export function getConsolidatedCaptacoes(
  investments: RawInvestment[] = [],
  subscriptions: RawSubscription[] = [],
): CaptacaoItem[] {
  const result: CaptacaoItem[] = []
  const processedInvIds = new Set<string>()
  const processedSubIds = new Set<string>()

  // 1. Processa todos os registros de `investments`
  for (const inv of investments) {
    if (!inv || !inv.id) continue
    const invStatus = (inv.status || '').toLowerCase().trim()
    if (CANCELLED_STATUSES.has(invStatus)) continue

    processedInvIds.add(inv.id)

    // Se houver subscrições vinculadas neste investimento, marcar como processadas
    if (Array.isArray(inv.debenture_subscriptions)) {
      for (const s of inv.debenture_subscriptions) {
        if (s?.id) processedSubIds.add(s.id)
      }
    }

    const quotas = Number(inv.quotas || 0)
    const redeemedQuotas = Number(inv.redeemed_quotas || 0)
    const totalQuotas = quotas + redeemedQuotas
    const unitPrice = Number(inv.unit_price || 100)

    // Cadeia de valor histórico:
    // 1. Se status for ativo ('approved', etc.) e total_value > 0 -> total_value
    // 2. Se status for 'resgatado'/'encerrado', total_value no banco pode ter sido zerado (0).
    //    Então: transfer_value -> totalQuotas * unitPrice -> total_value
    const totalVal = Number(inv.total_value || 0)
    const transferVal = Number(inv.transfer_value || 0)
    const calculatedQuotasVal = totalQuotas * unitPrice

    // Subscrição vinculada se houver
    const linkedSub =
      Array.isArray(inv.debenture_subscriptions) && inv.debenture_subscriptions.length > 0
        ? inv.debenture_subscriptions[0]
        : null
    const subAmount = linkedSub ? Number(linkedSub.total_amount || 0) : 0

    let valorHistorico = 0
    if (invStatus === 'resgatado' || invStatus === 'encerrado') {
      if (transferVal > 0) {
        valorHistorico = transferVal
      } else if (subAmount > 0) {
        valorHistorico = subAmount
      } else if (calculatedQuotasVal > 0) {
        valorHistorico = calculatedQuotasVal
      } else if (totalVal > 0) {
        valorHistorico = totalVal
      }
    } else {
      if (totalVal > 0) {
        valorHistorico = totalVal
      } else if (transferVal > 0) {
        valorHistorico = transferVal
      } else if (calculatedQuotasVal > 0) {
        valorHistorico = calculatedQuotasVal
      } else if (subAmount > 0) {
        valorHistorico = subAmount
      }
    }

    if (valorHistorico <= 0) continue

    // Data histórica da captação: transfer_date -> subscription_date -> created_at
    const rawDate = inv.transfer_date || linkedSub?.subscription_date || inv.created_at
    const date = normalizeDateOnly(rawDate)

    // Nome do investidor
    const prof = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles
    const investorName = prof?.full_name || prof?.pj_company_name || 'Investidor'
    const investorDoc = prof?.document_number || null

    result.push({
      id: `inv-${inv.id}`,
      source: 'investments',
      investmentId: inv.id,
      subscriptionId: linkedSub?.id || null,
      investorName,
      investorDocument: investorDoc,
      date,
      valor: valorHistorico,
      status: inv.status || 'approved',
      quotas,
      redeemedQuotas,
      unitPrice,
    })
  }

  // 2. Processa subscrições avulsas (que não estejam vinculadas a um investment já processado)
  for (const sub of subscriptions) {
    if (!sub || !sub.id) continue
    if (processedSubIds.has(sub.id)) continue

    // Se estiver vinculada a um investment que já processamos, ignore (deduplicação)
    if (sub.investment_id && processedInvIds.has(sub.investment_id)) {
      continue
    }

    const st = (sub.status || '').toLowerCase().trim()
    if (CANCELLED_STATUSES.has(st) || st === 'excluído' || st === 'excluido') continue

    const inv = Array.isArray(sub.investments) ? sub.investments[0] : sub.investments
    const invStatus = (inv?.status || '').toLowerCase().trim()
    if (CANCELLED_STATUSES.has(invStatus)) continue

    const subTotal = Number(sub.total_amount || 0)
    const transferVal = Number(inv?.transfer_value || 0)
    const unitP = Number(inv?.unit_price || sub.unit_price || 100)
    const totalQuotas = Number(inv?.quotas || 0) + Number(inv?.redeemed_quotas || 0)
    const calculatedByQuotas = totalQuotas * unitP

    let valorHistorico = 0
    if (subTotal > 0) {
      valorHistorico = subTotal
    } else if (transferVal > 0) {
      valorHistorico = transferVal
    } else if (calculatedByQuotas > 0) {
      valorHistorico = calculatedByQuotas
    }

    if (valorHistorico <= 0) continue

    const rawDate = sub.subscription_date || inv?.transfer_date || sub.created_at
    const date = normalizeDateOnly(rawDate)

    result.push({
      id: `sub-${sub.id}`,
      source: 'debenture_subscriptions',
      investmentId: sub.investment_id || null,
      subscriptionId: sub.id,
      investorName: sub.investor_name || 'Investidor',
      investorDocument: sub.document_number || null,
      date,
      valor: valorHistorico,
      status: sub.status || 'Ativo',
      quotas: Number(inv?.quotas || sub.quantity || 0),
      redeemedQuotas: Number(inv?.redeemed_quotas || 0),
      unitPrice: unitP,
    })

    processedSubIds.add(sub.id)
    if (sub.investment_id) {
      processedInvIds.add(sub.investment_id)
    }
  }

  return result
}

export interface ConsistencyCheckReport {
  totalAportesBase: number
  totalAtivos: number
  totalResgatados: number
  totalEncerrados: number
  totalAportesCaptados: number
  valorTotalCaptado: number
  divergencias: {
    id: string
    investorName: string
    status: string
    valor: number
    date: string
    motivo: string
  }[]
  isConsistent: boolean
}

/**
 * Realiza uma auditoria de consistência automática cruzando a base de investimentos
 * contra a lista de captações gerada.
 */
export function auditCaptacoesConsistency(
  investments: RawInvestment[] = [],
  subscriptions: RawSubscription[] = [],
): ConsistencyCheckReport {
  const captacoes = getConsolidatedCaptacoes(investments, subscriptions)
  const captacoesByInvId = new Map<string, CaptacaoItem>()
  for (const c of captacoes) {
    if (c.investmentId) {
      captacoesByInvId.set(c.investmentId, c)
    }
  }

  let totalAtivos = 0
  let totalResgatados = 0
  let totalEncerrados = 0
  const divergencias: ConsistencyCheckReport['divergencias'] = []

  for (const inv of investments) {
    const st = (inv.status || '').toLowerCase().trim()
    if (CANCELLED_STATUSES.has(st)) continue

    if (st === 'resgatado') totalResgatados++
    else if (st === 'encerrado') totalEncerrados++
    else totalAtivos++

    const cap = captacoesByInvId.get(inv.id)
    const prof = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles
    const name = prof?.full_name || prof?.pj_company_name || 'Investidor'

    if (!cap) {
      divergencias.push({
        id: inv.id,
        investorName: name,
        status: inv.status || 'desconhecido',
        valor: Number(inv.transfer_value || inv.total_value || 0),
        date: inv.transfer_date || inv.created_at || '',
        motivo: 'Aporte presente na tabela investments não foi gerado no fluxo de captação',
      })
    } else if (cap.valor <= 0) {
      divergencias.push({
        id: inv.id,
        investorName: name,
        status: inv.status || 'desconhecido',
        valor: 0,
        date: cap.date,
        motivo: 'Aporte gerou lançamento com valor histórico zerado ou negativo',
      })
    }
  }

  const valorTotalCaptado = captacoes.reduce((acc, cur) => acc + cur.valor, 0)

  return {
    totalAportesBase: investments.length,
    totalAtivos,
    totalResgatados,
    totalEncerrados,
    totalAportesCaptados: captacoes.length,
    valorTotalCaptado,
    divergencias,
    isConsistent: divergencias.length === 0,
  }
}
