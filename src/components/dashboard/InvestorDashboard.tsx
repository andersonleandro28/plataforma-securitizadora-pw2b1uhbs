import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  Activity,
  ArrowRight,
  FileText,
  ArrowDownToLine,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  calculateTotalAccruedYield,
  generateYieldChartData,
  isManualYieldProduct,
  type InvestmentWithProduct,
} from '@/lib/yield-calculator'
import { fetchManualYieldsForInvestment, type ManualYieldEntry } from '@/services/manual-yield'
import {
  calculateManualYieldAmount,
  generateManualYieldChartData,
} from '@/lib/manual-yield-calculator'
import { evaluateGracePeriod } from '@/lib/redemption-utils'
import { InvestorRedemptionDialog } from '@/components/investor/InvestorRedemptionDialog'
import { InvestorRedemptionStatement } from '@/components/investor/InvestorRedemptionStatement'
import { InvestorTaxReport } from '@/components/investor/InvestorTaxReport'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">Aprovado</Badge>
    case 'pending_transfer':
      return <Badge variant="secondary">Pendente de Transferência</Badge>
    case 'awaiting_review':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
          Em Análise
        </Badge>
      )
    case 'rejected':
      return <Badge variant="destructive">Reprovado</Badge>
    case 'resgatado':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          Resgatado
        </Badge>
      )
    case 'Excluído':
    case 'cancelled':
      return <Badge variant="destructive">Cancelado</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

interface InvestmentListProps {
  data: any[]
  pendingRedemptionsByInv?: Record<string, number>
  onOpenRedeemModal?: (inv: any) => void
}

function InvestmentList({
  data,
  pendingRedemptionsByInv = {},
  onOpenRedeemModal,
}: InvestmentListProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 border border-dashed rounded-lg">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-foreground">Nenhum investimento encontrado</p>
        <p className="text-sm text-muted-foreground">Não há registros para esta categoria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((inv) => {
        const pendingQuotas = pendingRedemptionsByInv[inv.id] || 0
        const totalQuotas = Number(inv.quotas) || 0
        const redeemedQuotas = Number(inv.redeemed_quotas) || 0
        const availableQuotas = Math.max(0, totalQuotas - redeemedQuotas - pendingQuotas)

        const graceEval = evaluateGracePeriod(inv)
        const isApproved = inv.status === 'approved'

        return (
          <Card key={inv.id} className="transition-all hover:border-primary/50">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-primary">
                    {inv.investment_products?.title || 'Produto Desconhecido'}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Operação registrada em: {formatDate(inv.created_at)}
                    {inv.transfer_date && (
                      <span className="ml-2">
                        • Início dos Rendimentos: {formatDate(inv.transfer_date)}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {pendingQuotas > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-800 border-blue-300 gap-1"
                    >
                      <Clock className="w-3 h-3 text-blue-600" />
                      Saque Pendente ({pendingQuotas} cota{pendingQuotas > 1 ? 's' : ''})
                    </Badge>
                  )}
                  {getStatusBadge(inv.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/10 p-3 rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Valor Ativo
                  </p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(
                      Math.max(0, Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0)) *
                        Number(inv.unit_price || inv.investment_products?.quota_value || 1000),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Cotas
                  </p>
                  <p className="font-semibold text-foreground">
                    {inv.quotas} cota(s)
                    {availableQuotas < totalQuotas && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        ({availableQuotas} disp. para saque)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Taxa / Alvo
                  </p>
                  <p className="font-semibold text-emerald-600">
                    {inv.investment_products?.rate || '-'}
                  </p>
                  {inv.investment_products?.interest_type && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {inv.investment_products.interest_type === 'composto'
                        ? 'Juro Composto'
                        : 'Juro Simples'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Contrato
                  </p>
                  {inv.contract_url ? (
                    <a
                      href={inv.contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver PDF
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              {/* Mensagem explicativa inline sobre a carência do produto */}
              {isApproved && graceEval && (
                <div
                  className={`text-xs p-2.5 rounded-md flex items-start gap-2 ${
                    graceEval.isBlocked
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-300'
                      : graceEval.isWithinGracePeriod
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300'
                        : 'bg-muted/40 text-muted-foreground border border-border/40'
                  }`}
                >
                  {graceEval.isBlocked ? (
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  ) : (
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <span className="font-medium block">
                      {graceEval.isBlocked
                        ? 'Carência Mínima em Andamento (Saque Bloqueado)'
                        : graceEval.isWithinGracePeriod
                          ? 'Período de Carência (Permite Saque com Penalidade)'
                          : 'Carência'}
                    </span>
                    <span className="leading-relaxed">{graceEval.explanationMessage}</span>
                  </div>
                </div>
              )}

              {/* Barra de Ação: Botão Solicitar Saque */}
              {isApproved && onOpenRedeemModal && (
                <div className="flex items-center justify-between pt-1 border-t">
                  <div className="text-xs text-muted-foreground">
                    {availableQuotas > 0
                      ? `${availableQuotas} cota(s) disponível(is) para resgate.`
                      : 'Todas as cotas deste aporte já foram resgatadas ou estão em análise.'}
                  </div>

                  <Button
                    variant={graceEval.isBlocked ? 'outline' : 'default'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onOpenRedeemModal(inv)}
                    disabled={availableQuotas <= 0 && !graceEval.isBlocked}
                    title={
                      graceEval.isBlocked
                        ? 'Ver detalhes da carência'
                        : 'Solicitar saque deste investimento'
                    }
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Solicitar Saque
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function InvestorDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const [investments, setInvestments] = useState<any[]>([])
  const [manualYieldMap, setManualYieldMap] = useState<Record<string, ManualYieldEntry[]>>({})
  const [allRedemptions, setAllRedemptions] = useState<any[]>([])
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<string>('all')

  // Estado do modal de resgate
  const [redeemModalOpen, setRedeemModalOpen] = useState(false)
  const [selectedInvestmentForRedeem, setSelectedInvestmentForRedeem] = useState<any | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return

    try {
      const [{ data, error }, { data: redData, error: redError }] = await Promise.all([
        supabase
          .from('investments_view')
          .select(
            `*,
            investment_products(
              id,
              title,
              type,
              rate,
              term,
              quota_value,
              interest_type,
              min_grace_period_months,
              grace_period,
              allow_early_redemption,
              early_redemption_penalty_pct,
              early_redemption_discount_pct,
              redemption_cotization_months,
              redemption_rules,
              ir_rules,
              yield_split_pct
            )`,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('investment_redemptions')
          .select(
            `*,
            investments(
              id,
              unit_price,
              transfer_date,
              created_at,
              investment_products(
                title,
                rate,
                type
              )
            )`,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (error) throw error
      if (redError) {
        console.warn('Erro ao carregar resgates:', redError)
      }

      setInvestments(data || [])
      setAllRedemptions(redData || [])
      setPendingRedemptions((redData || []).filter((r: any) => r.status === 'pending'))

      const manualProducts = (data || []).filter(
        (inv: any) =>
          inv.investment_products?.type === 'Rendimento Variável (Forex Manual)' &&
          inv.investment_products?.id,
      )

      const yieldMap: Record<string, ManualYieldEntry[]> = {}
      await Promise.all(
        manualProducts.map(async (inv: any) => {
          try {
            const entries = await fetchManualYieldsForInvestment(inv.investment_products.id)
            yieldMap[inv.investment_products.id] = entries
          } catch {
            yieldMap[inv.investment_products.id] = []
          }
        }),
      )
      setManualYieldMap(yieldMap)
    } catch (err) {
      console.error('Error fetching investor data:', err)
      toast.error('Erro ao carregar dados de investimento.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) {
      fetchData()
    }
  }, [authLoading, fetchData])

  // Mapeia cotas em solicitação pendente agrupadas por investment_id
  const pendingRedemptionsByInv = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of pendingRedemptions) {
      if (r.investment_id) {
        map[r.investment_id] = (map[r.investment_id] || 0) + Number(r.requested_quotas || 0)
      }
    }
    return map
  }, [pendingRedemptions])

  const handleOpenRedeemModal = (inv: any) => {
    setSelectedInvestmentForRedeem(inv)
    setRedeemModalOpen(true)
  }

  const walletBalance = profile?.wallet_balance || 0

  const activeInvestments = investments.filter(
    (inv) => inv.status === 'approved' || inv.status === 'pending_transfer',
  )
  const redeemedInvestments = investments.filter((inv) => inv.status === 'resgatado')
  const cancelledInvestments = investments.filter(
    (inv) => inv.status === 'Excluído' || inv.status === 'cancelled' || inv.status === 'rejected',
  )

  const totalInvestedValue = activeInvestments
    .filter((inv) => inv.status === 'approved')
    .reduce((acc, inv) => {
      const unitPrice = Number(inv.unit_price || inv.investment_products?.quota_value || 1000)
      const remainingQuotas = Math.max(
        0,
        Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0),
      )
      const calculatedActive = remainingQuotas * unitPrice
      const totalVal = Number(inv.total_value)
      // Se total_value já está decrementado ou válido, usa o menor entre total_value e calculatedActive se houver resgates
      const activeValue =
        !isNaN(totalVal) && totalVal >= 0 && totalVal <= calculatedActive
          ? totalVal
          : calculatedActive
      return acc + activeValue
    }, 0)

  const totalBalance = walletBalance + totalInvestedValue

  const accumulatedYield = useMemo(() => {
    const fixedYield = calculateTotalAccruedYield(
      activeInvestments.filter(
        (inv) => !isManualYieldProduct(inv as InvestmentWithProduct),
      ) as InvestmentWithProduct[],
    )

    const manualYield = activeInvestments
      .filter((inv) => isManualYieldProduct(inv as InvestmentWithProduct))
      .reduce((sum, inv) => {
        const entries = manualYieldMap[inv.investment_products?.id] || []
        const startDate = inv.transfer_date
          ? new Date(inv.transfer_date)
          : inv.created_at
            ? new Date(inv.created_at)
            : null
        const unitPrice = Number(inv.unit_price || inv.investment_products?.quota_value || 1000)
        const remainingQuotas = Math.max(
          0,
          Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0),
        )
        const baseValue = Math.min(Number(inv.total_value || 0), remainingQuotas * unitPrice)
        return sum + calculateManualYieldAmount(baseValue, entries, startDate)
      }, 0)

    return fixedYield + manualYield
  }, [activeInvestments, manualYieldMap])

  const uniqueProducts = useMemo(() => {
    const productsMap = new Map()
    investments.forEach((inv) => {
      if (inv.investment_products) {
        productsMap.set(inv.investment_products.id, inv.investment_products.title)
      }
    })
    return Array.from(productsMap.entries()).map(([id, title]) => ({ id, title }))
  }, [investments])

  const chartData = useMemo(() => {
    let filteredInvs = activeInvestments
    if (selectedProduct !== 'all') {
      filteredInvs = filteredInvs.filter((inv) => inv.product_id === selectedProduct)
    }

    const fixedInvs = filteredInvs.filter(
      (inv) => !isManualYieldProduct(inv as InvestmentWithProduct),
    )
    const manualInvs = filteredInvs.filter((inv) =>
      isManualYieldProduct(inv as InvestmentWithProduct),
    )

    const fixedChartData = generateYieldChartData(fixedInvs as InvestmentWithProduct[])

    const manualChartData = manualInvs.flatMap((inv) => {
      const entries = manualYieldMap[inv.investment_products?.id] || []
      const startDate = inv.transfer_date
        ? new Date(inv.transfer_date)
        : inv.created_at
          ? new Date(inv.created_at)
          : null
      const unitPrice = Number(inv.unit_price || inv.investment_products?.quota_value || 1000)
      const remainingQuotas = Math.max(
        0,
        Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0),
      )
      const baseValue = Math.min(Number(inv.total_value || 0), remainingQuotas * unitPrice)
      return generateManualYieldChartData(baseValue, entries, startDate)
    })

    if (fixedChartData.length === 0 && manualChartData.length === 0) return []

    if (fixedChartData.length > 0 && manualChartData.length === 0) return fixedChartData
    if (fixedChartData.length === 0 && manualChartData.length > 0) return manualChartData

    const merged = new Map<string, number>()
    for (const point of fixedChartData) {
      merged.set(point.date, (merged.get(point.date) || 0) + point.value)
    }
    for (const point of manualChartData) {
      merged.set(point.date, (merged.get(point.date) || 0) + point.value)
    }

    const sortedDates = Array.from(merged.keys()).sort((a, b) => {
      const parseDate = (s: string) => {
        const [month, year] = s.split(' ')
        const months = [
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
        return new Date(Number(year), months.indexOf(month), 1).getTime()
      }
      return parseDate(a) - parseDate(b)
    })

    return sortedDates.map((date) => ({ date, value: merged.get(date) || 0 }))
  }, [activeInvestments, selectedProduct, manualYieldMap])

  if (authLoading || loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard do Investidor</h1>
          <p className="text-muted-foreground">
            Acompanhe seu portfólio e performance de investimentos.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/investments">
            Novas Oportunidades <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Caixa livre + Investimentos aprovados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Investimentos Ativos
            </CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInvestments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Operações em andamento ou pendentes
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rendimento Acumulado
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(accumulatedYield)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rendimento projetado sobre investimentos ativos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Evolução do Portfólio</CardTitle>
            <CardDescription>Rendimento acumulado projetado mês a mês</CardDescription>
          </div>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visão Geral (Todos)</SelectItem>
              {uniqueProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="w-full mt-4">
              <ChartContainer
                config={{ value: { label: 'Rendimento Acumulado', color: 'hsl(var(--primary))' } }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={80}
                    />
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(val) => formatCurrency(Number(val))}
                          labelKey="value"
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorYield)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground bg-muted/10 border border-dashed rounded-lg mt-4">
              <Activity className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p>Nenhum dado disponível para exibir o gráfico.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestão da Carteira</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe investimentos ativos, extrato completo de resgates e informe de rendimentos
            para o Imposto de Renda.
          </p>
        </div>

        <Tabs defaultValue="ativos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="resgatados">Resgatados</TabsTrigger>
            <TabsTrigger value="extrato-resgates">
              Extrato Resgates
              {allRedemptions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                  {allRedemptions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="informe-ir">Informe IR</TabsTrigger>
            <TabsTrigger value="cancelados">Cancelados</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="ativos" className="m-0">
              <InvestmentList
                data={activeInvestments}
                pendingRedemptionsByInv={pendingRedemptionsByInv}
                onOpenRedeemModal={handleOpenRedeemModal}
              />
            </TabsContent>

            <TabsContent value="resgatados" className="m-0">
              <InvestmentList data={redeemedInvestments} />
            </TabsContent>

            <TabsContent value="extrato-resgates" className="m-0">
              <InvestorRedemptionStatement
                redemptions={allRedemptions}
                loading={loading}
                onRefresh={fetchData}
                onOpenNewRedemption={
                  activeInvestments.length > 0
                    ? () => handleOpenRedeemModal(activeInvestments[0])
                    : undefined
                }
              />
            </TabsContent>

            <TabsContent value="informe-ir" className="m-0">
              <InvestorTaxReport
                investorProfile={profile}
                investments={investments}
                redemptions={allRedemptions}
                manualYieldMap={manualYieldMap}
              />
            </TabsContent>

            <TabsContent value="cancelados" className="m-0">
              <InvestmentList data={cancelledInvestments} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Dialog de Solicitação de Saque do Investidor */}
      <InvestorRedemptionDialog
        open={redeemModalOpen}
        onOpenChange={setRedeemModalOpen}
        investment={selectedInvestmentForRedeem}
        manualYieldEntries={
          selectedInvestmentForRedeem?.investment_products?.id
            ? manualYieldMap[selectedInvestmentForRedeem.investment_products.id] || []
            : []
        }
        pendingRequestedQuotas={
          selectedInvestmentForRedeem?.id
            ? pendingRedemptionsByInv[selectedInvestmentForRedeem.id] || 0
            : 0
        }
        onSuccess={fetchData}
      />
    </div>
  )
}
