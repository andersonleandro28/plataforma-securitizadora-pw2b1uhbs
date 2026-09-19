import {
  computeInterestYield,
  parseProductRate,
  type InvestmentWithProduct,
  isManualYieldProduct,
} from '@/lib/yield-calculator'
import { calculateManualYieldAmount } from '@/lib/manual-yield-calculator'
import type { ManualYieldEntry } from '@/services/manual-yield'
import { getTaxRate, getStartDate } from '@/lib/redemption-utils'

/**
 * Normaliza uma data para o formato YYYY-MM-DD sem deslocamento de timezone,
 * alinhado ao padrão de use-accounting.ts.
 */
export function normalizeDate(value: string | null | undefined): string {
  if (!value) return ''
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]

  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

export interface TaxReportProductSummary {
  productId: string
  productTitle: string
  productRate?: string | null
  interestType?: string | null
  // Saldo aplicado no produto ao final do ano
  appliedBalance: number
  // Rendimentos brutos recebidos/acumulados no ano-calendário
  grossYield: number
  // IRRF retido no período
  taxAmount: number
  // Resgates pagos no ano (valor líquido)
  paidRedemptionsNet: number
  // Resgates pagos no ano (principal devolvido)
  paidRedemptionsPrincipal: number
  // Quantidade de cotas ativas no final do ano
  quotas: number
}

export interface TaxReportAnnualData {
  year: number
  investorName: string
  investorDocument: string
  investorEmail: string
  generatedAt: string
  products: TaxReportProductSummary[]
  totals: {
    appliedBalance: number
    grossYield: number
    taxAmount: number
    paidRedemptionsNet: number
    paidRedemptionsPrincipal: number
  }
}

/**
 * Gera a consolidação fiscal para o Informe de Rendimentos do ano-calendário selecionado.
 */
export function generateAnnualTaxReport({
  year,
  investorProfile,
  investments,
  redemptions,
  manualYieldMap = {},
}: {
  year: number
  investorProfile: any
  investments: any[]
  redemptions: any[]
  manualYieldMap?: Record<string, ManualYieldEntry[]>
}): TaxReportAnnualData {
  const startOfYearStr = `${year}-01-01`
  const endOfYearStr = `${year}-12-31`
  const endOfYearDate = new Date(`${year}-12-31T23:59:59.999Z`)

  // Mapear resgates pagos no ano por investment_id
  const redemptionsInYearByInvestment: Record<
    string,
    { net: number; principal: number; yield: number; tax: number }
  > = {}

  redemptions.forEach((red) => {
    if (red.status !== 'paid') return

    const redDateStr = normalizeDate(red.updated_at || red.created_at)
    if (redDateStr >= startOfYearStr && redDateStr <= endOfYearStr) {
      const invId = red.investment_id
      if (!redemptionsInYearByInvestment[invId]) {
        redemptionsInYearByInvestment[invId] = { net: 0, principal: 0, yield: 0, tax: 0 }
      }

      const gross = Number(red.gross_value) || 0
      const net = Number(red.net_value) || 0
      const tax = Number(red.tax_amount) || 0
      const yieldAmt = Number(red.yield_amount) || 0
      const principal = Math.max(0, gross - yieldAmt)

      redemptionsInYearByInvestment[invId].net += net
      redemptionsInYearByInvestment[invId].principal += principal
      redemptionsInYearByInvestment[invId].yield += yieldAmt
      redemptionsInYearByInvestment[invId].tax += tax
    }
  })

  // Agrupar e consolidar por produto
  const productSummaryMap = new Map<string, TaxReportProductSummary>()

  investments.forEach((inv) => {
    const prod = inv.investment_products || {}
    const prodId = prod.id || inv.product_id || 'unknown'
    const prodTitle = prod.title || 'Produto de Investimento'

    const startDateStr = normalizeDate(inv.transfer_date || inv.created_at)
    // Se a aplicação iniciou após o ano-calendário, ignorar
    if (startDateStr > endOfYearStr) return

    // Cotas e saldo no fechamento do ano
    const totalQuotas = Number(inv.quotas) || 0
    const redeemedQuotas = Number(inv.redeemed_quotas) || 0
    const activeQuotasAtYearEnd = Math.max(0, totalQuotas - redeemedQuotas)
    const unitPrice = Number(inv.unit_price || prod.quota_value || 1000)
    const appliedBalance = activeQuotasAtYearEnd * unitPrice

    // Resgates vinculados a este aporte
    const redInYear = redemptionsInYearByInvestment[inv.id] || {
      net: 0,
      principal: 0,
      yield: 0,
      tax: 0,
    }

    // Cálculo do rendimento proporcional ao ano-calendário
    let annualYield = 0
    let annualTax = redInYear.tax

    const startDate = getStartDate(inv)
    const calcStartDate =
      startDateStr < startOfYearStr ? new Date(`${year}-01-01T00:00:00Z`) : startDate

    // Se o aporte ainda esteve ativo durante o ano
    if (calcStartDate <= endOfYearDate && (appliedBalance > 0 || redInYear.yield > 0)) {
      if (isManualYieldProduct(inv as InvestmentWithProduct)) {
        const entries = manualYieldMap[prod.id] || []
        // Filtrar entradas pertencentes ao ano
        const entriesInYear = entries.filter((e) => {
          const p = normalizeDate(e.period)
          return p >= startOfYearStr && p <= endOfYearStr
        })
        const manualYieldVal = calculateManualYieldAmount(
          appliedBalance > 0 ? appliedBalance : Number(inv.total_value) || 0,
          entriesInYear,
          calcStartDate,
        )
        annualYield = manualYieldVal + redInYear.yield
      } else {
        const annualRate = parseProductRate(prod.rate) || 0
        const daysInYear = Math.max(
          0,
          Math.floor((endOfYearDate.getTime() - calcStartDate.getTime()) / (1000 * 60 * 60 * 24)),
        )

        // Rendimento acumulado no ano sobre o saldo ativo
        const accruedInYear = computeInterestYield(
          appliedBalance,
          annualRate,
          daysInYear,
          prod.interest_type,
        )

        annualYield = accruedInYear + redInYear.yield
      }
    }

    // Se houve rendimento e não há IR calculado via resgate pago, calcular o IR projetado
    if (annualYield > 0 && annualTax === 0) {
      const daysTotal = Math.max(
        0,
        Math.floor((endOfYearDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      )
      const taxRate = getTaxRate(daysTotal)
      annualTax = annualYield * (taxRate / 100)
    }

    // Consolidar no mapa do produto
    if (!productSummaryMap.has(prodId)) {
      productSummaryMap.set(prodId, {
        productId: prodId,
        productTitle: prodTitle,
        productRate: prod.rate,
        interestType: prod.interest_type,
        appliedBalance: 0,
        grossYield: 0,
        taxAmount: 0,
        paidRedemptionsNet: 0,
        paidRedemptionsPrincipal: 0,
        quotas: 0,
      })
    }

    const current = productSummaryMap.get(prodId)!
    current.appliedBalance += appliedBalance
    current.grossYield += annualYield
    current.taxAmount += annualTax
    current.paidRedemptionsNet += redInYear.net
    current.paidRedemptionsPrincipal += redInYear.principal
    current.quotas += activeQuotasAtYearEnd
  })

  const productsList = Array.from(productSummaryMap.values())

  const totals = productsList.reduce(
    (acc, p) => {
      acc.appliedBalance += p.appliedBalance
      acc.grossYield += p.grossYield
      acc.taxAmount += p.taxAmount
      acc.paidRedemptionsNet += p.paidRedemptionsNet
      acc.paidRedemptionsPrincipal += p.paidRedemptionsPrincipal
      return acc
    },
    {
      appliedBalance: 0,
      grossYield: 0,
      taxAmount: 0,
      paidRedemptionsNet: 0,
      paidRedemptionsPrincipal: 0,
    },
  )

  return {
    year,
    investorName:
      investorProfile?.full_name || investorProfile?.pj_company_name || 'Investidor Cadastrado',
    investorDocument: investorProfile?.document_number || 'Não informado',
    investorEmail: investorProfile?.email || '',
    generatedAt: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    products: productsList,
    totals,
  }
}
