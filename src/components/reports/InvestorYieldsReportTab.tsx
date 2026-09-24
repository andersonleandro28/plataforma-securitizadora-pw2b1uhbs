import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { parseProductRate, computeInterestYield } from '@/lib/yield-calculator'
import { exportToCSV } from '@/lib/export-utils'
import { formatDate, cn } from '@/lib/utils'
import {
  Search,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  TrendingUp,
  Wallet,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Receipt,
  FileCheck,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

interface ProfileInfo {
  id: string
  full_name: string | null
  document_number: string | null
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
  profiles: ProfileInfo | null
  investment_products: (ProductInfo & { quota_value?: number | null }) | null
}

interface RawSubscription {
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

export interface InvestorItemYield {
  id: string
  investorName: string
  documentNumber: string | null
  productTitle: string
  productType: string
  productRate: string
  investmentDate: string | null
  startDate: Date | null
  activeQuotas: number
  unitPrice: number
  investedAmount: number
  yieldMonth: number
  yieldAccumulated: number
  status: string | null
}

export interface InvestorGroupYield {
  key: string
  userId: string | null
  name: string
  document: string
  totalInvested: number
  totalYieldMonth: number
  totalYieldAccumulated: number
  firstInvestmentDate: string | null
  latestInvestmentDate: string | null
  investments: InvestorItemYield[]
}

export interface InvestorPeriodRedemption {
  id: string
  userId: string | null
  investorName: string
  documentNumber: string | null
  contractTitle: string
  redemptionDate: string
  grossValue: number
  taxAmount: number
  taxRate: number
  netValue: number
  status: string
  requestedQuotas: number
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

function resolveInvestment(
  raw: LinkedInvestment | LinkedInvestment[] | null,
): LinkedInvestment | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null
  return raw
}

const ELIGIBLE_INVESTMENT_STATUSES = ['approved', 'pending_transfer']
const DISCARD_RAW_STATUSES = ['encerrado', 'resgatado', 'excluído', 'cancelled']

export function InvestorYieldsReportTab() {
  const [rawSubs, setRawSubs] = useState<RawSubscription[]>([])
  const [productsBySeries, setProductsBySeries] = useState<Record<string, ProductInfo>>({})
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([])
  const [allRedemptions, setAllRedemptions] = useState<InvestorPeriodRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

  // Competência selecionada (formato YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Lista de competências disponíveis (últimos 24 meses até o mês atual)
  const availableMonths = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    // 24 meses para trás a partir do mês atual
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      options.push({ value, label: `${capitalized} (${value})` })
    }
    return options
  }, [])

  /* ------------------------------------------------------------------ */
  /* Carga de Dados                                                     */
  /* ------------------------------------------------------------------ */

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data: subs, error: err } = await supabase
        .from('debenture_subscriptions')
        .select(
          `
          id, investor_name, document_number, total_amount, subscription_date,
          created_at, status, investment_id, series_id,
          investments (
            id, status, user_id, quotas, redeemed_quotas, unit_price, total_value, transfer_date, created_at,
            profiles ( id, full_name, document_number ),
            investment_products ( id, title, type, rate, term, yield_split_pct, interest_type, quota_value )
          )
          `,
        )
        .is('deleted_at', null)
        .order('subscription_date', { ascending: false, nullsFirst: false })

      if (err) throw err
      const subsData = (subs || []) as RawSubscription[]
      setRawSubs(subsData)

      // Produtos por series_id
      const seriesIds = Array.from(new Set(subsData.map((s) => s.series_id).filter(Boolean)))
      const seriesProductsMap: Record<string, ProductInfo> = {}
      if (seriesIds.length > 0) {
        const { data: seriesProducts, error: seriesErr } = await supabase
          .from('investment_products')
          .select(
            'id, title, type, rate, term, yield_split_pct, series_id, interest_type, quota_value',
          )
          .in('series_id', seriesIds)

        if (seriesErr) throw seriesErr
        for (const p of (seriesProducts || []) as (ProductInfo & { series_id: string | null })[]) {
          if (p.series_id) seriesProductsMap[p.series_id] = p
        }
      }
      setProductsBySeries(seriesProductsMap)

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

      if (productIds.length > 0) {
        const { data: entries, error: entriesErr } = await supabase
          .from('manual_yield_entries')
          .select('id, product_id, period, gross_percentage, client_percentage')
          .in('product_id', productIds)
          .order('period', { ascending: true })

        if (entriesErr) throw entriesErr
        setManualEntries((entries || []) as ManualEntry[])
      } else {
        setManualEntries([])
      }

      // 4. Carregar resgates da fonte oficial (investment_redemptions)
      const { data: redsData, error: redsErr } = await supabase
        .from('investment_redemptions')
        .select(
          `
          id,
          user_id,
          investment_id,
          requested_quotas,
          gross_value,
          net_value,
          tax_amount,
          tax_rate,
          status,
          created_at,
          updated_at,
          profiles!investment_redemptions_user_id_fkey(id, full_name, document_number, pj_company_name),
          investments!investment_redemptions_investment_id_fkey(
            id,
            transfer_date,
            created_at,
            investment_products(id, title, type, rate)
          )
          `,
        )
        .order('updated_at', { ascending: false })

      if (redsErr) throw redsErr

      const mappedRedemptions: InvestorPeriodRedemption[] = ((redsData || []) as any[]).map((r) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        const inv = Array.isArray(r.investments) ? r.investments[0] : r.investments
        const prod = Array.isArray(inv?.investment_products)
          ? inv?.investment_products[0]
          : inv?.investment_products

        const investorName =
          prof?.pj_company_name || prof?.full_name || 'Investidor Não Identificado'
        const documentNumber = prof?.document_number || null

        // Título do contrato / aporte
        const productTitle = prod?.title || 'Contrato de Debênture'
        const contractInfo = prod?.rate ? `${productTitle} (${prod.rate})` : productTitle

        // Data real de liquidação/pagamento: updated_at ou created_at
        const effectiveDateStr = r.updated_at || r.created_at || ''
        const realDate = effectiveDateStr ? effectiveDateStr.substring(0, 10) : ''

        return {
          id: r.id,
          userId: r.user_id,
          investorName,
          documentNumber,
          contractTitle: contractInfo,
          redemptionDate: realDate,
          grossValue: Number(r.gross_value || 0),
          taxAmount: Number(r.tax_amount || 0),
          taxRate: Number(r.tax_rate || 0),
          netValue: Number(r.net_value || 0),
          status: r.status || 'paid',
          requestedQuotas: Number(r.requested_quotas || 0),
        }
      })

      setAllRedemptions(mappedRedemptions)
    } catch (e) {
      console.error('Erro ao carregar dados do relatório:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* ------------------------------------------------------------------ */
  /* Cálculo de Rendimento e Consolidação por Mês                       */
  /* ------------------------------------------------------------------ */

  const { investorGroups, summaryTotals } = useMemo(() => {
    // Parâmetros da competência selecionada
    const [selYearStr, selMonthStr] = selectedMonth.split('-')
    const selYear = parseInt(selYearStr, 10)
    const selMonth = parseInt(selMonthStr, 10) // 1-12

    // Início e fim da competência
    const startOfSelectedMonth = new Date(Date.UTC(selYear, selMonth - 1, 1, 0, 0, 0, 0))
    // Fim da competência: último dia do mês às 23:59:59.999 UTC
    const endOfSelectedMonth = new Date(Date.UTC(selYear, selMonth, 0, 23, 59, 59, 999))

    // Se o mês selecionado for o corrente, limitamos a data de referência a hoje
    const now = new Date()
    const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1
    const referenceDateAccrued =
      isCurrentMonth && now < endOfSelectedMonth ? now : endOfSelectedMonth

    // Mapeamento de entradas manuais por produto
    const entriesByProduct: Record<string, ManualEntry[]> = {}
    for (const e of manualEntries) {
      if (!entriesByProduct[e.product_id]) entriesByProduct[e.product_id] = []
      entriesByProduct[e.product_id].push(e)
    }

    const groupMap = new Map<string, InvestorGroupYield>()

    for (const raw of rawSubs) {
      const inv = resolveInvestment(raw.investments)
      const profile = inv?.profiles ?? null
      const product =
        inv?.investment_products ??
        (raw.series_id ? (productsBySeries[raw.series_id] ?? null) : null)

      // Descartar subscrições com raw.status encerradas, canceladas ou resgatadas
      const rawStatusLower = (raw.status || '').toLowerCase()
      if (DISCARD_RAW_STATUSES.includes(rawStatusLower)) {
        continue
      }

      // Se houver inv vinculado, aceitar apenas 'approved' e 'pending_transfer', e descartar 'resgatado'
      if (inv) {
        if (!ELIGIBLE_INVESTMENT_STATUSES.includes(inv.status || '')) {
          continue
        }
        if (inv.status === 'resgatado') {
          continue
        }
      }

      // Cotas ativas e valor investido (Regra oficial: apenas cotas ativas restantes × preço da cota)
      const quotas = Number(inv?.quotas ?? 0)
      const redeemedQuotas = Number(inv?.redeemed_quotas ?? 0)
      const remainingQuotas = Math.max(0, quotas - redeemedQuotas)
      const unitPrice = Number(inv?.unit_price || product?.quota_value || 100)
      const investedAmount = inv ? remainingQuotas * unitPrice : Number(raw.total_amount || 0)

      if (investedAmount <= 0) {
        continue
      }

      // Data efetiva do investimento (data de aporte / transferência original)
      const rawDateStr = raw.subscription_date || (inv as any)?.transfer_date || raw.created_at
      const startDate = rawDateStr ? new Date(rawDateStr + 'T12:00:00Z') : null

      // Se a data de aporte for posterior ao final do mês de competência, este aporte ainda não existia no mês do relatório
      // Mas para uma visão acumulada histórica correta, se startDate > endOfSelectedMonth, o rendimento acumulado até aquele mês é zero.
      // O valor investido no mês selecionado: se o aporte ocorreu depois do mês selecionado, ele não deve somar na competência retroativa.
      // Porém, se o usuário estiver vendo a carteira atual comparada à competência, respeitamos a data de aporte.
      if (startDate && startDate > endOfSelectedMonth) {
        // Aporte realizado após o fechamento daquele mês
        continue
      }

      /* ------------------------------------------------------------------ */
      /* Cálculos de Rendimento: Acumulado até o fim do mês & Apenas no mês */
      /* ------------------------------------------------------------------ */
      let yieldAccumulated = 0
      let yieldMonth = 0

      if (product && startDate && investedAmount > 0) {
        if (product.type === 'Rendimento Variável (Forex Manual)') {
          const allProductEntries = entriesByProduct[product.id] || []
          const split = Number(product.yield_split_pct ?? 0) / 100

          // Acumulado até o final do mês selecionado
          const accEntries = allProductEntries.filter((e) => {
            const ed = new Date(e.period + 'T12:00:00Z')
            return ed >= startDate && ed <= referenceDateAccrued
          })
          const sumAccGross = accEntries.reduce(
            (sum, e) => sum + Number(e.gross_percentage || 0),
            0,
          )
          yieldAccumulated = investedAmount * (sumAccGross / 100) * split

          // Somente no mês selecionado
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
          // Renda Fixa / Debênture proporcional
          const annualRate = parseProductRate(product.rate)
          if (annualRate !== null && annualRate > 0) {
            // 1. Acumulado até o final do mês selecionado (ou até hoje se for mês corrente)
            const msAcc = referenceDateAccrued.getTime() - startDate.getTime()
            const daysAcc = Math.floor(msAcc / (1000 * 60 * 60 * 24))
            if (daysAcc > 0) {
              yieldAccumulated = computeInterestYield(
                investedAmount,
                annualRate,
                daysAcc,
                product.interest_type,
              )
            }

            // 2. Rendimento somente no mês selecionado
            // O período efetivo dentro do mês começa em max(startDate, startOfSelectedMonth)
            // e termina em referenceDateAccrued
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

      const itemYield: InvestorItemYield = {
        id: raw.id,
        investorName: profile?.full_name || raw.investor_name || 'Desconhecido',
        documentNumber: profile?.document_number || raw.document_number,
        productTitle: product?.title || 'Produto de Debênture',
        productType: product?.type || 'Debênture',
        productRate: product?.rate || '—',
        investmentDate: raw.subscription_date || (inv as any)?.transfer_date || raw.created_at,
        startDate,
        activeQuotas: remainingQuotas,
        unitPrice,
        investedAmount,
        yieldMonth: Math.max(0, yieldMonth),
        yieldAccumulated: Math.max(0, yieldAccumulated),
        status: inv?.status || raw.status,
      }

      // Agrupar por investidor
      const userId = inv?.user_id || profile?.id || null
      const name = profile?.full_name || raw.investor_name || 'Desconhecido'
      const document = profile?.document_number || raw.document_number || ''
      const key = userId ? `u:${userId}` : `d:${document || name.toLowerCase()}`

      let group = groupMap.get(key)
      if (!group) {
        group = {
          key,
          userId,
          name,
          document,
          totalInvested: 0,
          totalYieldMonth: 0,
          totalYieldAccumulated: 0,
          firstInvestmentDate: itemYield.investmentDate,
          latestInvestmentDate: itemYield.investmentDate,
          investments: [],
        }
        groupMap.set(key, group)
      }

      if (userId && (!group.userId || group.name === 'Desconhecido')) {
        group.userId = userId
      }
      if (profile?.full_name && group.name === 'Desconhecido') {
        group.name = profile.full_name
      }
      if (profile?.document_number && !group.document) {
        group.document = profile.document_number
      }

      group.totalInvested += itemYield.investedAmount
      group.totalYieldMonth += itemYield.yieldMonth
      group.totalYieldAccumulated += itemYield.yieldAccumulated
      group.investments.push(itemYield)

      // Atualizar primeira/última data
      if (
        itemYield.investmentDate &&
        (!group.firstInvestmentDate || itemYield.investmentDate < group.firstInvestmentDate)
      ) {
        group.firstInvestmentDate = itemYield.investmentDate
      }
      if (
        itemYield.investmentDate &&
        (!group.latestInvestmentDate || itemYield.investmentDate > group.latestInvestmentDate)
      ) {
        group.latestInvestmentDate = itemYield.investmentDate
      }
    }

    const list = Array.from(groupMap.values())
    // Ordenar por nome por padrão
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    // Ordenar aportes dentro de cada grupo
    for (const g of list) {
      g.investments.sort((a, b) => {
        const da = a.investmentDate ? new Date(a.investmentDate).getTime() : 0
        const db = b.investmentDate ? new Date(b.investmentDate).getTime() : 0
        return db - da
      })
    }

    const totals = list.reduce(
      (acc, g) => {
        acc.invested += g.totalInvested
        acc.yieldMonth += g.totalYieldMonth
        acc.yieldAccumulated += g.totalYieldAccumulated
        return acc
      },
      { invested: 0, yieldMonth: 0, yieldAccumulated: 0 },
    )

    return {
      investorGroups: list,
      summaryTotals: totals,
    }
  }, [rawSubs, manualEntries, productsBySeries, selectedMonth])

  /* ------------------------------------------------------------------ */
  /* Resgates Filtrados pela Competência Selecionada                     */
  /* ------------------------------------------------------------------ */

  const periodRedemptions = useMemo(() => {
    // Filtra pela competência selecionada (YYYY-MM na data real redemptionDate)
    return allRedemptions.filter((r) => {
      if (!r.redemptionDate) return false
      return r.redemptionDate.startsWith(selectedMonth)
    })
  }, [allRedemptions, selectedMonth])

  // Resgates filtrados pela busca textual
  const filteredRedemptions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return periodRedemptions
    return periodRedemptions.filter(
      (r) =>
        r.investorName.toLowerCase().includes(term) ||
        (r.documentNumber || '').toLowerCase().includes(term) ||
        r.contractTitle.toLowerCase().includes(term),
    )
  }, [periodRedemptions, search])

  // Totais da seção de resgates
  const redemptionsTotals = useMemo(() => {
    return filteredRedemptions.reduce(
      (acc, r) => {
        acc.gross += r.grossValue
        acc.tax += r.taxAmount
        acc.net += r.netValue
        acc.count += 1
        return acc
      },
      { gross: 0, tax: 0, net: 0, count: 0 },
    )
  }, [filteredRedemptions])

  /* ------------------------------------------------------------------ */
  /* Filtragem por Busca                                                */
  /* ------------------------------------------------------------------ */

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return investorGroups
    return investorGroups.filter(
      (g) => g.name.toLowerCase().includes(term) || (g.document || '').toLowerCase().includes(term),
    )
  }, [investorGroups, search])

  const filteredTotals = useMemo(() => {
    return filteredGroups.reduce(
      (acc, g) => {
        acc.invested += g.totalInvested
        acc.yieldMonth += g.totalYieldMonth
        acc.yieldAccumulated += g.totalYieldAccumulated
        return acc
      },
      { invested: 0, yieldMonth: 0, yieldAccumulated: 0 },
    )
  }, [filteredGroups])

  /* ------------------------------------------------------------------ */
  /* Exportações CSV e Impressão / PDF                                  */
  /* ------------------------------------------------------------------ */

  const handleExportCSV = () => {
    const [year, month] = selectedMonth.split('-')
    const monthObj = new Date(Number(year), Number(month) - 1, 1)
    const monthLabel = monthObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const rows: Record<string, any>[] = []

    // 1. Seção Principal: Rendimentos e Posição por Investidor
    rows.push({
      Seção: '1. RENDIMENTOS E POSIÇÃO DOS INVESTIDORES',
      Investidor: '',
      CPF_CNPJ: '',
      'Contrato / Produto': '',
      'Data de Referência': '',
      'Valor Bruto / Investido (R$)': '',
      'IRRF Retido (R$)': '',
      'Valor Líquido / Rendimento Mês (R$)': '',
      'Rendimento Acumulado (R$)': '',
      Status: '',
    })

    filteredGroups.forEach((g) => {
      g.investments.forEach((inv) => {
        rows.push({
          Seção: 'Rendimentos',
          Investidor: g.name,
          CPF_CNPJ: g.document || 'Não informado',
          'Contrato / Produto': `${inv.productTitle} (${inv.productRate})`,
          'Data de Referência': inv.investmentDate ? formatDate(inv.investmentDate) : '—',
          'Valor Bruto / Investido (R$)': inv.investedAmount.toFixed(2),
          'IRRF Retido (R$)': '—',
          'Valor Líquido / Rendimento Mês (R$)': inv.yieldMonth.toFixed(2),
          'Rendimento Acumulado (R$)': inv.yieldAccumulated.toFixed(2),
          Status: inv.status || 'Ativo',
        })
      })
    })

    rows.push({
      Seção: 'Totais Rendimentos',
      Investidor: `TOTAL GERAL APORTES ATIVOS (${filteredGroups.length} investidores)`,
      CPF_CNPJ: '—',
      'Contrato / Produto': '—',
      'Data de Referência': '—',
      'Valor Bruto / Investido (R$)': filteredTotals.invested.toFixed(2),
      'IRRF Retido (R$)': '—',
      'Valor Líquido / Rendimento Mês (R$)': filteredTotals.yieldMonth.toFixed(2),
      'Rendimento Acumulado (R$)': filteredTotals.yieldAccumulated.toFixed(2),
      Status: '—',
    })

    // Linha em branco separadora
    rows.push({
      Seção: '',
      Investidor: '',
      CPF_CNPJ: '',
      'Contrato / Produto': '',
      'Data de Referência': '',
      'Valor Bruto / Investido (R$)': '',
      'IRRF Retido (R$)': '',
      'Valor Líquido / Rendimento Mês (R$)': '',
      'Rendimento Acumulado (R$)': '',
      Status: '',
    })

    // 2. Seção: Resgates do Período
    rows.push({
      Seção: `2. RESGATES DO PERÍODO — COMPETÊNCIA ${month}/${year}`,
      Investidor: '',
      CPF_CNPJ: '',
      'Contrato / Produto': '',
      'Data de Referência': '',
      'Valor Bruto / Investido (R$)': '',
      'IRRF Retido (R$)': '',
      'Valor Líquido / Rendimento Mês (R$)': '',
      'Rendimento Acumulado (R$)': '',
      Status: '',
    })

    if (filteredRedemptions.length === 0) {
      rows.push({
        Seção: 'Resgates',
        Investidor: 'Nenhum resgate no período selecionado',
        CPF_CNPJ: '—',
        'Contrato / Produto': '—',
        'Data de Referência': '—',
        'Valor Bruto / Investido (R$)': '0.00',
        'IRRF Retido (R$)': '0.00',
        'Valor Líquido / Rendimento Mês (R$)': '0.00',
        'Rendimento Acumulado (R$)': '—',
        Status: '—',
      })
    } else {
      filteredRedemptions.forEach((red) => {
        const taxLabel =
          red.taxRate > 0
            ? `${red.taxAmount.toFixed(2)} (${red.taxRate}%)`
            : red.taxAmount.toFixed(2)

        const statusLabel =
          red.status === 'paid'
            ? 'Pago / Liquidado'
            : red.status === 'approved'
              ? 'Aprovado'
              : red.status === 'rejected'
                ? 'Reprovado'
                : 'Pendente'

        rows.push({
          Seção: 'Resgates',
          Investidor: red.investorName,
          CPF_CNPJ: red.documentNumber || 'Não informado',
          'Contrato / Produto': red.contractTitle,
          'Data de Referência': formatDate(red.redemptionDate),
          'Valor Bruto / Investido (R$)': red.grossValue.toFixed(2),
          'IRRF Retido (R$)': taxLabel,
          'Valor Líquido / Rendimento Mês (R$)': red.netValue.toFixed(2),
          'Rendimento Acumulado (R$)': '—',
          Status: statusLabel,
        })
      })

      rows.push({
        Seção: 'Totais Resgates',
        Investidor: `TOTAL DE RESGATES DO PERÍODO (${filteredRedemptions.length})`,
        CPF_CNPJ: '—',
        'Contrato / Produto': '—',
        'Data de Referência': '—',
        'Valor Bruto / Investido (R$)': redemptionsTotals.gross.toFixed(2),
        'IRRF Retido (R$)': redemptionsTotals.tax.toFixed(2),
        'Valor Líquido / Rendimento Mês (R$)': redemptionsTotals.net.toFixed(2),
        'Rendimento Acumulado (R$)': '—',
        Status: '—',
      })
    }

    exportToCSV(rows, `Relatorio_Rendimentos_e_Resgates_Investidores_${selectedMonth}.csv`)
  }

  const handlePrint = () => {
    window.print()
  }

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    const all: Record<string, boolean> = {}
    filteredGroups.forEach((g) => {
      all[g.key] = true
    })
    setExpandedKeys(all)
  }

  const collapseAll = () => {
    setExpandedKeys({})
  }

  const selectedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-')
    const dateObj = new Date(Number(y), Number(m) - 1, 1)
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [selectedMonth])

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* Estilo embutido para impressão em PDF limpa, paginada e sem cortes */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 12mm 10mm;
        }

        @media print {
          /* Desativa overflow oculto ou scroll de todos os elementos e ancestrais que travam a paginação em navegadores (Chromium / Firefox / Safari) */
          html, body {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            background: white !important;
            color: black !important;
          }

          /* Oculta layout e outros elementos da aplicação */
          body * {
            visibility: hidden;
          }

          /* Garante que os pais e ancestrais do relatório não cortem altura nem restrinjam overflow/flex/grid */
          #root,
          #root > div,
          main,
          header,
          nav,
          aside,
          [data-sidebar="inset"],
          .flex,
          .flex-1,
          .space-y-6,
          .space-y-4 {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            transform: none !important;
            animation: none !important;
          }

          /* Relatório visível em fluxo natural de documento contínuo */
          #print-yields-report,
          #print-yields-report * {
            visibility: visible;
          }

          /* Força as linhas de detalhamento individual de aportes a ficarem sempre visíveis na impressão */
          #print-yields-report .investor-detail-row,
          #print-yields-report .investor-detail-row * {
            display: table-row !important;
            visibility: visible !important;
          }
          #print-yields-report tr.investor-detail-row {
            display: table-row !important;
          }
          #print-yields-report tr.investor-detail-row td {
            display: table-cell !important;
          }
          #print-yields-report tr.investor-detail-row table {
            display: table !important;
          }
          #print-yields-report tr.investor-detail-row thead {
            display: table-header-group !important;
          }
          #print-yields-report tr.investor-detail-row tbody {
            display: table-row-group !important;
          }
          #print-yields-report tr.investor-detail-row tr {
            display: table-row !important;
          }
          #print-yields-report tr.investor-detail-row th,
          #print-yields-report tr.investor-detail-row td {
            display: table-cell !important;
          }
          #print-yields-report tr.investor-detail-row div {
            display: block !important;
          }
          #print-yields-report tr.investor-detail-row span {
            display: inline !important;
          }
          #print-yields-report tr.investor-detail-row span.block {
            display: block !important;
          }

          /* Oculta especificamente elementos com classe no-print dentro do relatório */
          #print-yields-report .no-print,
          #print-yields-report .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          #print-yields-report {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 10px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
          }

          /* Elementos com classe no-print ou print:hidden */
          .no-print {
            display: none !important;
          }

          /* Remover sombras, bordas desnecessárias e ajustar cores de fundo para impressão */
          #print-yields-report .shadow-sm,
          #print-yields-report .shadow-md,
          #print-yields-report .shadow-lg,
          #print-yields-report .shadow {
            box-shadow: none !important;
          }

          /* Permitir que tabelas e wrappers respeitem paginação nativa e não limitem rolagem */
          #print-yields-report .overflow-x-auto,
          #print-yields-report .overflow-y-auto,
          #print-yields-report .overflow-hidden,
          #print-yields-report .overflow-auto,
          #print-yields-report div:has(> table) {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            display: block !important;
          }

          /* Estrutura de tabela para paginação correta com cabeçalho repetido em cada folha */
          #print-yields-report table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          #print-yields-report thead {
            display: table-header-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-yields-report tbody {
            display: table-row-group !important;
          }

          #print-yields-report thead th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #print-yields-report tfoot {
            display: table-footer-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-yields-report tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #print-yields-report th,
          #print-yields-report td {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Evitar quebra de página dentro de cards de resumo e notas de rodapé */
          .print-break-inside-avoid,
          #print-yields-report .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Rendimentos dos Investidores</h3>
          <p className="text-sm text-muted-foreground">
            Relatório de posição e rentabilidade individual e acumulada por competência.
          </p>
        </div>

        {/* Ferramentas e Exportação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Baixar CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
            <Printer className="w-4 h-4 text-blue-600" /> Imprimir / Salvar PDF
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadData}
            disabled={loading}
            title="Recarregar dados"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Barra de Filtros: Competência / Mês e Busca */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Seletor de Mês de Referência */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Mês de Competência
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableMonths.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Buscar Investidor
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome ou CPF/CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Área Imprimível (Cards + Tabela) */}
      <div id="print-yields-report" className="space-y-6">
        {/* Cabeçalho visível na impressão */}
        <div className="hidden print:block border-b pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">NEXUM SECURITY 360º</h1>
              <h2 className="text-lg font-semibold text-muted-foreground">
                Relatório de Rendimentos dos Investidores
              </h2>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                Competência: <strong className="text-foreground">{selectedMonthLabel}</strong>
              </div>
              <div>
                Gerado em: {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Resumo Consolidado (5 cards: 4 de rendimentos + 1 de resgates do período) */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5 print-break-inside-avoid">
          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Investidores Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold font-mono">{filteredGroups.length}</div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Na competência {selectedMonth}
              </p>
            </CardContent>
          </Card>

          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Investido
              </CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(filteredTotals.invested)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Aportes ativos (cotas × valor unitário)
              </p>
            </CardContent>
          </Card>

          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rendimento do Mês
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(filteredTotals.yieldMonth)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Competência de {selectedMonthLabel}
              </p>
            </CardContent>
          </Card>

          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rendimento Acumulado
              </CardTitle>
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-emerald-600">
                  {formatCurrency(filteredTotals.yieldAccumulated)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Até o final de {selectedMonthLabel}
              </p>
            </CardContent>
          </Card>

          <Card className="print-break-inside-avoid col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resgatado no Mês
              </CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-rose-600">
                  {formatCurrency(redemptionsTotals.gross)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Bruto ({redemptionsTotals.count} resgate{redemptionsTotals.count === 1 ? '' : 's'})
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela Individual por Investidor */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Demonstrativo Individual por Investidor — Competência {selectedMonthLabel}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Posição detalhada por investidor: data do investimento, valor investido,
                  rendimento do mês e acumulado.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="no-print flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={expandAll}
                    disabled={filteredGroups.length === 0}
                    title="Expandir todos os contratos de todos os investidores"
                  >
                    Expandir Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={collapseAll}
                    disabled={filteredGroups.length === 0}
                    title="Recolher todos os contratos"
                  >
                    Recolher Todos
                  </Button>
                </div>
                <Badge variant="outline" className="w-fit font-mono">
                  {filteredGroups.length} investidor{filteredGroups.length === 1 ? '' : 'es'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0 sm:p-6">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                <p className="text-destructive font-medium">Erro ao carregar dados do relatório.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
                </Button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Wallet className="h-10 w-10 mb-2 opacity-40" />
                <p className="font-medium">Nenhum investimento encontrado para esta competência.</p>
                <p className="text-xs">Verifique os filtros aplicados ou selecione outro mês.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12 text-center no-print">#</TableHead>
                      <TableHead className="min-w-[200px]">Investidor / CPF ou CNPJ</TableHead>
                      <TableHead className="min-w-[130px]">Data do Investimento</TableHead>
                      <TableHead className="text-right min-w-[130px]">Valor Investido</TableHead>
                      <TableHead className="text-right min-w-[140px] text-blue-700">
                        Rend. no Mês ({selectedMonth})
                      </TableHead>
                      <TableHead className="text-right min-w-[150px] text-emerald-700">
                        Rend. Acumulado até {selectedMonth}
                      </TableHead>
                      <TableHead className="text-center w-20 no-print">Aportes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((g) => {
                      const isExpanded = !!expandedKeys[g.key]
                      const hasMultiple = g.investments.length > 1

                      return (
                        <React.Fragment key={g.key}>
                          <TableRow
                            className={cn(
                              'cursor-pointer transition-colors print-break-inside-avoid',
                              isExpanded ? 'bg-muted/20 font-medium' : 'hover:bg-muted/30',
                            )}
                            onClick={() => toggleGroup(g.key)}
                          >
                            <TableCell className="text-center no-print p-2">
                              {hasMultiple ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">•</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-foreground">{g.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {g.document || 'Documento não informado'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {g.investments.length === 1 ? (
                                formatDate(g.investments[0].investmentDate)
                              ) : (
                                <div className="text-xs">
                                  <span>{formatDate(g.firstInvestmentDate)}</span>
                                  {g.latestInvestmentDate !== g.firstInvestmentDate && (
                                    <span className="text-muted-foreground block text-[10px]">
                                      até {formatDate(g.latestInvestmentDate)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatCurrency(g.totalInvested)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-blue-600">
                              {formatCurrency(g.totalYieldMonth)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600">
                              {formatCurrency(g.totalYieldAccumulated)}
                            </TableCell>
                            <TableCell className="text-center no-print">
                              <Badge variant="secondary" className="text-[11px] font-normal">
                                {g.investments.length}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Linha com os aportes detalhados do investidor: sempre renderizada para sair no PDF/impressão; na tela obedece isExpanded */}
                          <TableRow
                            key={`${g.key}-detail`}
                            className={cn(
                              'bg-muted/10 hover:bg-muted/10 print-break-inside-avoid investor-detail-row',
                              !isExpanded && 'hidden print:table-row',
                            )}
                          >
                            <TableCell colSpan={7} className="p-3 sm:p-4 print:p-2">
                              <div className="rounded-md border bg-background overflow-hidden print:border-slate-300">
                                <div className="px-3 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground border-b flex justify-between items-center print:bg-slate-100 print:text-slate-800">
                                  <span>Contratos / Aportes Individualizados — {g.name}</span>
                                  <span>{g.investments.length} contrato(s) ativo(s)</span>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow className="text-xs print:bg-slate-50">
                                      <TableHead className="min-w-[180px]">
                                        Produto / Taxa
                                      </TableHead>
                                      <TableHead className="min-w-[110px]">
                                        Data do Aporte
                                      </TableHead>
                                      <TableHead className="text-center min-w-[70px]">
                                        Cotas
                                      </TableHead>
                                      <TableHead className="text-right min-w-[110px]">
                                        Valor Aportado
                                      </TableHead>
                                      <TableHead className="text-right min-w-[110px] text-blue-700">
                                        Rend. no Mês
                                      </TableHead>
                                      <TableHead className="text-right min-w-[120px] text-emerald-700">
                                        Rend. Acumulado
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {g.investments.map((inv, invIndex) => (
                                      <TableRow
                                        key={inv.id || `${g.key}-inv-${invIndex}`}
                                        className="text-xs print:border-b print:border-slate-200"
                                      >
                                        <TableCell className="font-medium">
                                          {inv.productTitle}
                                          <span className="block text-[11px] text-muted-foreground print:text-slate-600">
                                            {inv.productRate} • {inv.productType}
                                          </span>
                                        </TableCell>
                                        <TableCell>{formatDate(inv.investmentDate)}</TableCell>
                                        <TableCell className="text-center font-mono">
                                          {inv.activeQuotas}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                          {formatCurrency(inv.investedAmount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-blue-600">
                                          {formatCurrency(inv.yieldMonth)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-emerald-600">
                                          {formatCurrency(inv.yieldAccumulated)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      )
                    })}
                  </TableBody>

                  {/* Linha de Totais no Rodapé */}
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2 border-primary/20 text-sm">
                      <TableCell className="no-print" />
                      <TableCell colSpan={2} className="uppercase tracking-wider">
                        Total de Todos os Investidores ({filteredGroups.length})
                      </TableCell>
                      <TableCell className="text-right font-mono text-base">
                        {formatCurrency(filteredTotals.invested)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-base text-blue-700">
                        {formatCurrency(filteredTotals.yieldMonth)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-base text-emerald-700">
                        {formatCurrency(filteredTotals.yieldAccumulated)}
                      </TableCell>
                      <TableCell className="no-print" />
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* Nova Seção: Resgates do Período                                    */}
        {/* ================================================================= */}
        <Card className="print-break-inside-avoid mt-6">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                  Resgates do Período — Competência {selectedMonthLabel}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Resgates liquidados e pagos aos investidores no mês de competência, informados
                  para conciliação com a contabilidade, Livro Caixa e DFC.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={filteredRedemptions.length > 0 ? 'destructive' : 'outline'}
                  className="w-fit font-mono text-xs"
                >
                  {filteredRedemptions.length} resgate{filteredRedemptions.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0 sm:p-6">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filteredRedemptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Receipt className="h-9 w-9 mb-2 opacity-40 text-muted-foreground" />
                <p className="font-medium text-sm text-foreground">
                  Nenhum resgate no período selecionado
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Não houve liquidação de resgate na competência {selectedMonthLabel}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs">
                      <TableHead className="min-w-[180px]">Investidor / CPF ou CNPJ</TableHead>
                      <TableHead className="min-w-[160px]">Contrato / Aporte</TableHead>
                      <TableHead className="min-w-[110px]">Data do Resgate</TableHead>
                      <TableHead className="text-right min-w-[120px]">Valor Bruto</TableHead>
                      <TableHead className="text-right min-w-[130px] text-amber-700">
                        IRRF Retido
                      </TableHead>
                      <TableHead className="text-right min-w-[120px] text-emerald-700">
                        Valor Líquido Pago
                      </TableHead>
                      <TableHead className="text-center min-w-[110px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRedemptions.map((red) => {
                      const isPaid = red.status === 'paid'
                      return (
                        <TableRow
                          key={red.id}
                          className="text-xs hover:bg-muted/30 transition-colors print-break-inside-avoid"
                        >
                          <TableCell>
                            <div className="font-semibold text-foreground">{red.investorName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {red.documentNumber || 'Documento não informado'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{red.contractTitle}</div>
                            {red.requestedQuotas > 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                {red.requestedQuotas} cota{red.requestedQuotas === 1 ? '' : 's'}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {formatDate(red.redemptionDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground">
                            {formatCurrency(red.grossValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-amber-700 dark:text-amber-400">
                            {red.taxAmount > 0 ? (
                              <div>
                                <span className="font-medium">{formatCurrency(red.taxAmount)}</span>
                                {red.taxRate > 0 && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    ({red.taxRate}%)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">R$ 0,00</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">
                            {formatCurrency(red.netValue)}
                          </TableCell>
                          <TableCell className="text-center">
                            {isPaid ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-0.5">
                                Pago / Liquidado
                              </Badge>
                            ) : red.status === 'approved' ? (
                              <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5">
                                Aprovado
                              </Badge>
                            ) : red.status === 'rejected' ? (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                                Reprovado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-2 py-0.5"
                              >
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  {/* Linha de Totais da Seção de Resgates */}
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2 border-primary/20 text-xs sm:text-sm">
                      <TableCell colSpan={3} className="uppercase tracking-wider">
                        Total Resgates no Período ({filteredRedemptions.length})
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm sm:text-base">
                        {formatCurrency(redemptionsTotals.gross)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm sm:text-base text-amber-700 dark:text-amber-400">
                        {formatCurrency(redemptionsTotals.tax)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm sm:text-base text-emerald-700">
                        {formatCurrency(redemptionsTotals.net)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-normal">
                        —
                      </TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé explicativo do relatório */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/20 rounded-md border border-dashed print-break-inside-avoid">
          <p className="font-semibold text-foreground">Regras e Critérios do Relatório:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>Valor Investido:</strong> Saldo baseado estritamente em cotas ativas restantes
              × preço da cota. Aportes resgatados são deduzidos integralmente.
            </li>
            <li>
              <strong>Rendimento no Mês:</strong> Rendimento proporcional gerado exclusivamente nos
              dias ativos dentro da competência selecionada ({selectedMonthLabel}).
            </li>
            <li>
              <strong>Rendimento Acumulado:</strong> Rendimento acumulado desde a data do
              investimento até o último dia da competência de referência.
            </li>
            <li>
              <strong>Resgates do Período:</strong> Resgates cuja liquidação e efetivo pagamento
              ocorreram na competência selecionada (data real de liquidação). O valor bruto
              representa a saída original do caixa, o IRRF retido é provisionado para recolhimento
              via DARF e o valor líquido é o crédito pago ao investidor.
            </li>
            <li>
              <strong>Data do Investimento:</strong> Data original da subscrição / transferência
              homologada no sistema.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
