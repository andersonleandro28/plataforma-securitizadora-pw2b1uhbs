import { useEffect, useState, useMemo, useCallback } from 'react'
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
import { parseProductRate, parseProductTerm } from '@/lib/yield-calculator'
import { formatDate, cn } from '@/lib/utils'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Wallet,
  TrendingUp,
  Users,
  RefreshCw,
  AlertCircle,
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
}

interface ProfileInfo {
  id: string
  full_name: string | null
  document_number: string | null
}

interface LinkedInvestment {
  status: string | null
  user_id: string
  profiles: ProfileInfo | null
  investment_products: ProductInfo | null
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

interface EnrichedSubscription {
  id: string
  investorName: string
  documentNumber: string | null
  totalAmount: number
  subscriptionDate: string | null
  createdAt: string
  status: string | null
  investmentId: string | null
  product: ProductInfo | null
  startDate: Date | null
  maturityDate: Date | null
  yieldAmount: number
}

interface InvestorGroup {
  key: string
  userId: string | null
  name: string
  document: string
  totalInvested: number
  totalYield: number
  subscriptions: EnrichedSubscription[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

/** Whole months elapsed between two dates (floor, never negative). */
function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  d.setMonth(d.getMonth() + months)
  return d
}

const ELIGIBLE_INVESTMENT_STATUSES = ['approved', 'pending_transfer']

/**
 * Resolve the (possibly nested) investments relation returned by PostgREST
 * into a single object or null.
 */
function resolveInvestment(
  raw: LinkedInvestment | LinkedInvestment[] | null,
): LinkedInvestment | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null
  return raw
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InvestorsPortfolio() {
  const [rawSubs, setRawSubs] = useState<RawSubscription[]>([])
  const [productsBySeries, setProductsBySeries] = useState<Record<string, ProductInfo>>({})
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'invested' | 'yield'>('name')
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

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
            status, user_id,
            profiles ( id, full_name, document_number ),
            investment_products ( id, title, type, rate, term, yield_split_pct )
          )
          `,
        )
        .is('deleted_at', null)
        .order('subscription_date', { ascending: false, nullsFirst: false })

      if (err) throw err
      const subsData = (subs || []) as RawSubscription[]
      setRawSubs(subsData)

      // Muitas subscrições têm investment_id = NULL, então o JOIN
      // investments → investment_products retorna vazio. Como fallback,
      // buscamos os investment_products diretamente via series_id (presente
      // em toda subscrição) e fazemos o merge em memória.
      const seriesIds = Array.from(new Set(subsData.map((s) => s.series_id).filter(Boolean)))

      const seriesProductsMap: Record<string, ProductInfo> = {}
      if (seriesIds.length > 0) {
        const { data: seriesProducts, error: seriesErr } = await supabase
          .from('investment_products')
          .select('id, title, type, rate, term, yield_split_pct, series_id')
          .in('series_id', seriesIds)

        if (seriesErr) throw seriesErr
        for (const p of (seriesProducts || []) as (ProductInfo & { series_id: string | null })[]) {
          if (p.series_id) seriesProductsMap[p.series_id] = p
        }
      }
      setProductsBySeries(seriesProductsMap)

      // Fetch manual yield entries for every product referenced by the
      // subscriptions (only needed for "Rendimento Variável (Forex Manual)").
      const productIds = Array.from(
        new Set(
          subsData
            .map((s) => {
              const linked = resolveInvestment(s.investments)?.investment_products
              if (linked?.id) return linked.id
              // Fallback: produto resolvido via series_id
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
    } catch (e) {
      console.error(e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* ----------------------- enrichment & grouping ----------------------- */

  const groups = useMemo<InvestorGroup[]>(() => {
    const now = new Date()
    const entriesByProduct: Record<string, ManualEntry[]> = {}
    for (const e of manualEntries) {
      if (!entriesByProduct[e.product_id]) entriesByProduct[e.product_id] = []
      entriesByProduct[e.product_id].push(e)
    }

    const computeYield = (sub: EnrichedSubscription): number => {
      const product = sub.product
      if (!product || !sub.startDate || !sub.totalAmount) return 0

      if (product.type === 'Rendimento Variável (Forex Manual)') {
        // Soma de todos os lançamentos manuais do produto a partir da data
        // do aporte, multiplicada pela porção do cliente (yield_split_pct)
        // e aplicada sobre o valor do aporte.
        const entries = (entriesByProduct[product.id] || []).filter((e) => {
          const ed = new Date(e.period + 'T12:00:00Z')
          return ed >= sub.startDate!
        })
        const sumGrossPct = entries.reduce((sum, e) => sum + Number(e.gross_percentage || 0), 0)
        const split = Number(product.yield_split_pct ?? 0) / 100
        return sub.totalAmount * (sumGrossPct / 100) * split
      }

      // Renda fixa / Debênture: cálculo diário proporcional (idêntico à área do investidor)
      const annualRate = parseProductRate(product.rate)
      if (annualRate === null) return 0
      const daysDiff = Math.floor((now.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff <= 0) return 0
      return (sub.totalAmount * (annualRate / 100) * daysDiff) / 365
    }

    const groupMap = new Map<string, InvestorGroup>()

    for (const raw of rawSubs) {
      const inv = resolveInvestment(raw.investments)
      const profile = inv?.profiles ?? null
      const product =
        inv?.investment_products ??
        (raw.series_id ? (productsBySeries[raw.series_id] ?? null) : null)

      // "Considerar apenas subscrições com status approved ou pending_transfer".
      // Subscrições sem vínculo de investment (investment_id nulo) são mantidas
      // pois carregam dados próprios (investor_name, document_number, total_amount)
      // e o produto é resolvido via series_id.
      if (inv && !ELIGIBLE_INVESTMENT_STATUSES.includes(inv.status || '')) {
        continue
      }

      const startDateStr = raw.subscription_date || raw.created_at
      const startDate = startDateStr ? new Date(startDateStr + 'T12:00:00Z') : null
      const termMonths = product ? parseProductTerm(product.term) : null
      const maturityDate = startDate && termMonths ? addMonths(startDate, termMonths) : null

      const enriched: EnrichedSubscription = {
        id: raw.id,
        investorName: profile?.full_name || raw.investor_name || 'Desconhecido',
        documentNumber: profile?.document_number || raw.document_number,
        totalAmount: Number(raw.total_amount || 0),
        subscriptionDate: raw.subscription_date,
        createdAt: raw.created_at,
        status: inv?.status || raw.status,
        investmentId: raw.investment_id,
        product,
        startDate,
        maturityDate,
        yieldAmount: 0,
      }
      enriched.yieldAmount = computeYield(enriched)

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
          totalYield: 0,
          subscriptions: [],
        }
        groupMap.set(key, group)
      }
      // Prefer a real profile name/document over a synthetic one once known.
      if (userId && (!group.userId || group.name === 'Desconhecido')) {
        group.userId = userId
      }
      if (profile?.full_name && group.name === 'Desconhecido') {
        group.name = profile.full_name
      }
      if (profile?.document_number && !group.document) {
        group.document = profile.document_number
      }
      group.totalInvested += enriched.totalAmount
      group.totalYield += enriched.yieldAmount
      group.subscriptions.push(enriched)
    }

    const list = Array.from(groupMap.values())
    // Sort subscriptions inside each group by subscription date desc
    for (const g of list) {
      g.subscriptions.sort(
        (a, b) =>
          new Date(b.subscriptionDate || b.createdAt).getTime() -
          new Date(a.subscriptionDate || a.createdAt).getTime(),
      )
    }
    return list
  }, [rawSubs, manualEntries, productsBySeries])

  /* ----------------------- filtering & sorting ----------------------- */

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let out = groups
    if (term) {
      out = out.filter(
        (g) =>
          g.name.toLowerCase().includes(term) || (g.document || '').toLowerCase().includes(term),
      )
    }
    const sorted = [...out]
    sorted.sort((a, b) => {
      if (sortBy === 'invested') return b.totalInvested - a.totalInvested
      if (sortBy === 'yield') return b.totalYield - a.totalYield
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    return sorted
  }, [groups, search, sortBy])

  /* ----------------------- totals ----------------------- */
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, g) => {
        acc.invested += g.totalInvested
        acc.yield += g.totalYield
        return acc
      },
      { invested: 0, yield: 0 },
    )
  }, [filtered])

  /* ----------------------- ui helpers ----------------------- */
  const toggle = (key: string) => setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))

  const statusBadge = (status: string | null) => {
    const s = (status || '').toLowerCase()
    if (s === 'approved') {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Aprovado</Badge>
    }
    if (s === 'pending_transfer') {
      return (
        <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950">
          Transferência Pendente
        </Badge>
      )
    }
    if (s === 'ativo') {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Ativo</Badge>
    }
    return <Badge variant="outline">{status || '—'}</Badge>
  }

  /* ----------------------- render ----------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carteira de Investidores</h1>
        <p className="text-muted-foreground">
          Visão consolidada por investidor: aportes, rentabilidade acumulada e detalhamento por
          produto.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full dark:bg-blue-900/20 dark:text-blue-400">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Investidores</p>
                {loading ? (
                  <Skeleton className="h-8 w-1/3 mt-1" />
                ) : (
                  <h2 className="text-2xl font-bold">{filtered.length}</h2>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full dark:bg-emerald-900/20 dark:text-emerald-400">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Total Investido</p>
                {loading ? (
                  <Skeleton className="h-8 w-1/2 mt-1" />
                ) : (
                  <h2 className="text-2xl font-bold">{formatCurrency(totals.invested)}</h2>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-violet-100 text-violet-600 rounded-full dark:bg-violet-900/20 dark:text-violet-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Rentabilidade Acumulada</p>
                {loading ? (
                  <Skeleton className="h-8 w-1/2 mt-1" />
                ) : (
                  <h2 className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(totals.yield)}
                  </h2>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Investidores</CardTitle>
            <CardDescription>
              Clique em um investidor para expandir o detalhamento por produto.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 sm:w-72"
                disabled={loading || error}
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
              disabled={loading || error}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="invested">Valor Total Investido</SelectItem>
                <SelectItem value="yield">Rentabilidade Acumulada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-destructive font-medium">Erro ao carregar dados.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Wallet className="h-8 w-8 mb-2" />
              <p>Nenhum investimento encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((g) => {
                const isOpen = !!expandedKeys[g.key]
                return (
                  <div key={g.key} className="rounded-md border overflow-hidden">
                    {/* Investor summary row (clickable) */}
                    <button
                      type="button"
                      onClick={() => toggle(g.key)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left bg-card hover:bg-muted/50 transition-colors',
                      )}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{g.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.document || 'Documento não informado'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Total Investido</div>
                        <div className="font-mono font-medium">
                          {formatCurrency(g.totalInvested)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Rentabilidade</div>
                        <div className="font-mono font-medium text-emerald-600">
                          {formatCurrency(g.totalYield)}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {g.subscriptions.length}{' '}
                        {g.subscriptions.length === 1 ? 'aporte' : 'aportes'}
                      </Badge>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="bg-muted/30 p-4 border-t">
                        <div className="rounded-md border bg-background overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Taxa</TableHead>
                                <TableHead className="text-right">Valor do Aporte</TableHead>
                                <TableHead>Data do Aporte</TableHead>
                                <TableHead>Data de Vencimento</TableHead>
                                <TableHead className="text-right">Rendimento Acumulado</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.subscriptions.map((s) => (
                                <TableRow key={s.id}>
                                  <TableCell className="font-medium">
                                    {s.product?.title || '—'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {s.product?.type || '—'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {s.product?.rate || '—'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(s.totalAmount)}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(s.subscriptionDate || s.createdAt)}
                                  </TableCell>
                                  <TableCell>
                                    {s.maturityDate ? formatDate(s.maturityDate) : '—'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-emerald-600">
                                    {formatCurrency(s.yieldAmount)}
                                  </TableCell>
                                  <TableCell>{statusBadge(s.status)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
