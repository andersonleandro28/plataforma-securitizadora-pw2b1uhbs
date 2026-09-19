import { computeInterestYield, parseProductRate } from '@/lib/yield-calculator'
import { calculateManualYieldAmount } from '@/lib/manual-yield-calculator'
import type { ManualYieldEntry } from '@/services/manual-yield'

export interface ProductRedemptionRules {
  id?: string
  title?: string | null
  type?: string | null
  rate?: string | null
  term?: string | null
  quota_value?: number | null
  min_grace_period_months?: number | null
  grace_period?: string | null
  allow_early_redemption?: boolean | null
  early_redemption_penalty_pct?: number | null
  early_redemption_discount_pct?: number | null
  redemption_cotization_months?: number | null
  redemption_rules?: string | null
  ir_rules?: string | null
  interest_type?: string | null
  yield_split_pct?: number | null
}

export interface InvestmentForRedemption {
  id: string
  user_id: string
  product_id: string
  quotas: number
  redeemed_quotas?: number | null
  unit_price: number
  total_value: number
  status?: string | null
  transfer_date?: string | null
  created_at?: string | null
  investment_products?: ProductRedemptionRules | null
}

export interface GracePeriodEvaluation {
  canRedeem: boolean
  isWithinGracePeriod: boolean
  allowEarlyRedemption: boolean
  gracePeriodMonths: number
  startDate: Date
  graceReleaseDate: Date | null
  monthsElapsed: number
  daysElapsed: number
  explanationMessage: string
  isBlocked: boolean
}

export interface RedemptionCalculation {
  requestedQuotas: number
  unitPrice: number
  principal: number
  yieldAmount: number
  grossValue: number
  penaltyPct: number
  penaltyAmount: number
  discountPct: number
  discountAmount: number
  taxRatePct: number
  taxAmount: number
  netValue: number
  isEarlyRedemption: boolean
  daysElapsed: number
}

/**
 * Retorna a data de início válida de um investimento (transfer_date preferencial, ou created_at).
 */
export function getStartDate(inv: {
  transfer_date?: string | null
  created_at?: string | null
}): Date {
  if (inv.transfer_date) {
    const d = new Date(inv.transfer_date + (inv.transfer_date.includes('T') ? '' : 'T12:00:00Z'))
    if (!isNaN(d.getTime())) return d
  }
  if (inv.created_at) {
    const d = new Date(inv.created_at)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Adiciona meses a uma data mantendo a consistência de calendário.
 */
export function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Avalia o status da carência mínima do investimento.
 */
export function evaluateGracePeriod(
  investment: InvestmentForRedemption,
  referenceDate: Date = new Date(),
): GracePeriodEvaluation {
  const product = investment.investment_products || {}
  const graceMonths = Number(product.min_grace_period_months ?? 0)
  const allowEarly = Boolean(product.allow_early_redemption)

  const startDate = getStartDate(investment)
  const startZero = new Date(startDate)
  startZero.setUTCHours(0, 0, 0, 0)

  const refZero = new Date(referenceDate)
  refZero.setUTCHours(0, 0, 0, 0)

  const daysElapsed = Math.max(
    0,
    Math.floor((refZero.getTime() - startZero.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const monthsElapsed = daysElapsed / 30.4375

  const graceReleaseDate = graceMonths > 0 ? addMonthsToDate(startZero, graceMonths) : null
  const isWithinGracePeriod = graceMonths > 0 ? monthsElapsed < graceMonths : false

  const formattedRelease = graceReleaseDate
    ? graceReleaseDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : '-'
  const formattedStart = startZero.toLocaleDateString('pt-BR', { timeZone: 'UTC' })

  let explanationMessage = ''
  let canRedeem = true
  let isBlocked = false

  if (isWithinGracePeriod) {
    if (!allowEarly) {
      canRedeem = false
      isBlocked = true
      explanationMessage = `Este investimento possui carência mínima de ${graceMonths} meses e não permite resgate antecipado. O saque estará liberado apenas a partir de ${formattedRelease} (aplicação iniciada em ${formattedStart}).`
    } else {
      canRedeem = true
      isBlocked = false
      const penaltyPct = Number(product.early_redemption_penalty_pct ?? 0)
      const discountPct = Number(product.early_redemption_discount_pct ?? 0)
      explanationMessage = `Este investimento está dentro do período de carência (término em ${formattedRelease}, carência de ${graceMonths} meses). O produto permite resgate antecipado com aplicação de penalidade/deságio (${penaltyPct}% sobre o principal e ${discountPct}% sobre os rendimentos).`
    }
  } else {
    canRedeem = true
    isBlocked = false
    if (graceMonths > 0) {
      explanationMessage = `Carência cumprida (${graceMonths} meses). Saque liberado sem penalidades de resgate antecipado.`
    } else {
      explanationMessage = 'Investimento sem carência mínima obrigatória. Saque liberado.'
    }
  }

  return {
    canRedeem,
    isWithinGracePeriod,
    allowEarlyRedemption: allowEarly,
    gracePeriodMonths: graceMonths,
    startDate: startZero,
    graceReleaseDate,
    monthsElapsed,
    daysElapsed,
    explanationMessage,
    isBlocked,
  }
}

/**
 * Calcula a tabela regressiva de IR (renda fixa padrão).
 */
export function getTaxRate(daysElapsed: number): number {
  if (daysElapsed <= 180) return 22.5
  if (daysElapsed <= 360) return 20.0
  if (daysElapsed <= 720) return 17.5
  return 15.0
}

/**
 * Calcula todos os valores do resgate para a quantidade de cotas solicitada.
 */
export function calculateRedemptionMetrics(
  investment: InvestmentForRedemption,
  requestedQuotas: number,
  manualYieldEntries: ManualYieldEntry[] = [],
  referenceDate: Date = new Date(),
): RedemptionCalculation {
  const product = investment.investment_products || {}
  const unitPrice = Number(investment.unit_price || product.quota_value || 1000)
  const principal = Math.max(0, requestedQuotas * unitPrice)

  const graceEval = evaluateGracePeriod(investment, referenceDate)
  const daysElapsed = graceEval.daysElapsed

  let yieldAmount = 0

  if (principal > 0) {
    if (product.type === 'Rendimento Variável (Forex Manual)') {
      const split = Number(product.yield_split_pct ?? 50) / 100
      const entries = manualYieldEntries.filter((e) => {
        const ed = new Date(e.period + 'T12:00:00Z')
        return ed >= graceEval.startDate
      })
      const sumGrossPct = entries.reduce((acc, curr) => acc + Number(curr.gross_percentage || 0), 0)
      yieldAmount = principal * (sumGrossPct / 100) * split
    } else {
      const annualRate = parseProductRate(product.rate) || 0
      yieldAmount = computeInterestYield(principal, annualRate, daysElapsed, product.interest_type)
    }
  }

  yieldAmount = Math.max(0, yieldAmount)

  let penaltyPct = 0
  let discountPct = 0
  let penaltyAmount = 0
  let discountAmount = 0

  if (graceEval.isWithinGracePeriod && graceEval.allowEarlyRedemption) {
    penaltyPct = Number(product.early_redemption_penalty_pct ?? 0)
    discountPct = Number(product.early_redemption_discount_pct ?? 0)
    penaltyAmount = principal * (penaltyPct / 100)
    discountAmount = yieldAmount * (discountPct / 100)
  }

  const taxRatePct = getTaxRate(daysElapsed)
  const taxableYield = Math.max(0, yieldAmount - discountAmount)
  const taxAmount = taxableYield * (taxRatePct / 100)

  const grossValue = principal + yieldAmount
  const netValue = Math.max(0, principal + yieldAmount - penaltyAmount - discountAmount - taxAmount)

  return {
    requestedQuotas,
    unitPrice,
    principal,
    yieldAmount,
    grossValue,
    penaltyPct,
    penaltyAmount,
    discountPct,
    discountAmount,
    taxRatePct,
    taxAmount,
    netValue,
    isEarlyRedemption: graceEval.isWithinGracePeriod,
    daysElapsed,
  }
}
