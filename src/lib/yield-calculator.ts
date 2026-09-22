export type InterestType = 'simples' | 'composto'

export interface InvestmentWithProduct {
  id: string
  total_value: number | null
  transfer_date: string | null
  created_at: string | null
  unit_price?: number | null
  quotas?: number | null
  redeemed_quotas?: number | null
  investment_products?: {
    id: string
    title: string
    rate: string | null
    term: string | null
    quota_value: number | null
    unit_price?: number | null
    type?: string | null
    interest_type?: string | null
  } | null
}

export function isManualYieldProduct(inv: InvestmentWithProduct): boolean {
  return inv.investment_products?.type === 'Rendimento Variável (Forex Manual)'
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export function parseProductRate(rate: string | null | undefined): number | null {
  if (!rate) return null

  const rateMatch = rate.match(/(\d+[.,]?\d*)\s*%/)
  if (!rateMatch) {
    console.warn(`[YieldCalculator] Could not parse rate: "${rate}"`)
    return null
  }

  const numericRate = parseFloat(rateMatch[1].replace(',', '.'))
  if (isNaN(numericRate)) {
    console.warn(`[YieldCalculator] Could not parse numeric rate: "${rate}"`)
    return null
  }

  const isMonthly = /a\.\s*m\.|ao\s+m[eê]s|mensal/i.test(rate)
  return isMonthly ? numericRate * 12 : numericRate
}

export function parseProductTerm(term: string | null | undefined): number | null {
  if (!term) return null
  const monthsMatch = term.match(/(\d+)\s*(?:meses|months|m\b)/i)
  if (monthsMatch) return parseInt(monthsMatch[1], 10)
  const yearsMatch = term.match(/(\d+)\s*(?:anos|years|a\b)/i)
  if (yearsMatch) return parseInt(yearsMatch[1], 10) * 12
  const numericMatch = term.match(/(\d+)/)
  return numericMatch ? parseInt(numericMatch[1], 10) : null
}

export function getInvestmentStartDate(inv: InvestmentWithProduct): Date | null {
  const dateStr = inv.transfer_date || inv.created_at
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Calcula o rendimento proporcional diário de um aporte, considerando se o juro é simples ou composto.
 *
 * - Juro simples: juros = capital × (taxa / 100) × (dias / 365)
 * - Juro composto: juros = capital × ((1 + taxa / 100) ^ (dias / 365) - 1)
 */
export function computeInterestYield(
  capital: number,
  annualRatePct: number,
  days: number,
  interestType?: string | null,
): number {
  if (capital <= 0 || annualRatePct <= 0 || days <= 0) return 0

  const rate = annualRatePct / 100
  const timeInYears = days / 365

  const type = (interestType || '').toLowerCase().trim()
  if (type === 'composto') {
    // Juro composto: M = C * (1 + i)^t => J = M - C = C * ((1 + i)^t - 1)
    return capital * (Math.pow(1 + rate, timeInYears) - 1)
  }

  // Padrão / Juro simples: J = C * i * t
  return capital * rate * timeInYears
}

export function calculateAccruedYield(
  inv: InvestmentWithProduct,
  referenceDate: Date = new Date(),
): number {
  if (!inv.investment_products) return 0

  // Calcula valor base considerando cotas ativas restantes
  const unitPrice = Number(inv.unit_price || inv.investment_products.quota_value || 1000)
  const remainingQuotas = Math.max(0, Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0))
  const calculatedActive = remainingQuotas * unitPrice
  const baseValue = Math.min(Number(inv.total_value || 0), calculatedActive)

  if (baseValue <= 0) return 0

  const annualRate = parseProductRate(inv.investment_products.rate)
  if (annualRate === null) return 0

  const startDate = getInvestmentStartDate(inv)
  if (!startDate) return 0

  const daysDiff = Math.floor(
    (referenceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (daysDiff <= 0) return 0

  return computeInterestYield(
    baseValue,
    annualRate,
    daysDiff,
    inv.investment_products.interest_type,
  )
}

export function calculateTotalAccruedYield(
  investments: InvestmentWithProduct[],
  referenceDate: Date = new Date(),
): number {
  return investments.reduce((sum, inv) => sum + calculateAccruedYield(inv, referenceDate), 0)
}

export function generateYieldChartData(
  investments: InvestmentWithProduct[],
  referenceDate: Date = new Date(),
): { date: string; value: number }[] {
  const eligible = investments.filter((inv) => {
    const startDate = getInvestmentStartDate(inv)
    const annualRate = parseProductRate(inv.investment_products?.rate)
    const remainingQuotas = Math.max(0, Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0))
    return startDate && annualRate !== null && (inv.total_value || 0) > 0 && remainingQuotas > 0
  })

  if (eligible.length === 0) return []

  const earliest = eligible.reduce((min, inv) => {
    const d = getInvestmentStartDate(inv)!
    return d < min ? d : min
  }, getInvestmentStartDate(eligible[0])!)

  const dataPoints: { date: string; value: number }[] = []
  const startMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const endMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const cursor = new Date(startMonth)

  while (cursor <= endMonth) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
    const effectiveDate = monthEnd > referenceDate ? referenceDate : monthEnd

    const totalYield = eligible.reduce(
      (sum, inv) => sum + calculateAccruedYield(inv, effectiveDate),
      0,
    )

    const monthLabel = `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`
    dataPoints.push({ date: monthLabel, value: totalYield })

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return dataPoints
}
