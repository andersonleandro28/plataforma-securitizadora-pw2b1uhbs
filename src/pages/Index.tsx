import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

const riskConfig = {
  value: { label: 'Participação' },
}

const issuerConfig = {
  exposure: { label: 'Exposição', color: 'hsl(var(--primary))' },
}

type Status = 'loading' | 'success' | 'error' | 'empty'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export default function Index() {
  const { activeRole, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<{ recebiveis: any[]; investimentos: any[] } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const { toast } = useToast()
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(() => {
    if (activeRole !== 'admin' && activeRole !== 'staff' && activeRole !== 'accountant') return

    if (fetchTimeout.current) clearTimeout(fetchTimeout.current)

    fetchTimeout.current = setTimeout(async () => {
      try {
        setStatus('loading')
        const [{ data: recebiveis, error: err1 }, { data: investimentos, error: err2 }] =
          await Promise.all([
            supabase
              .from('recebiveis_ccb')
              .select(
                '*, tomador:profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
              )
              .eq('status', 'Ativo'),
            supabase
              .from('investments')
              .select('total_value, status')
              .in('status', ['approved', 'Ativo']),
          ])

        if (err1) throw err1
        if (err2) throw err2

        setData({ recebiveis: recebiveis || [], investimentos: investimentos || [] })
        setStatus('success')
      } catch (error: any) {
        setStatus('error')
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Falha na comunicação com o servidor',
          variant: 'destructive',
        })
      }
    }, 300)
  }, [toast, activeRole])

  useEffect(() => {
    if (activeRole !== 'admin' && activeRole !== 'staff' && activeRole !== 'accountant') return

    fetchData()

    const channel = supabase
      .channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () =>
        fetchData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () =>
        fetchData(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, activeRole])

  const processedData = useMemo(() => {
    if (!data) return null
    const { recebiveis, investimentos } = data

    const aumRecebiveis = recebiveis.reduce(
      (acc, curr) => acc + (Number(curr.acquisition_value) || 0),
      0,
    )
    const aumInvestimentos = investimentos.reduce(
      (acc, curr) => acc + (Number(curr.total_value) || 0),
      0,
    )
    const totalAUM = aumRecebiveis + aumInvestimentos

    const receitaMensal = recebiveis.reduce((acc, curr) => {
      const val = Number(curr.acquisition_value) || 0
      const taxa = Number(curr.tir_effective) || 0
      return acc + (val * (taxa / 100)) / 12
    }, 0)

    let sumProd = 0
    let sumVal = 0
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      let maxDate = new Date()
      if (r.boletos && Array.isArray(r.boletos)) {
        const dates = r.boletos
          .map((b) => new Date(b.due_date || b.payment_date || new Date()))
          .filter((d) => !isNaN(d.getTime()))
        if (dates.length > 0) {
          maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
        }
      }
      const days = Math.max(0, (maxDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      sumProd += val * days
      sumVal += val
    })
    const pdlMonths = sumVal > 0 ? sumProd / sumVal / 30 : 0

    const totalEscrituras = recebiveis.length

    const riskMap: Record<string, number> = { AAA: 0, AA: 0, A: 0, BBB: 0, BB: 0 }
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const tir = Number(r.tir_effective) || 0
      let rating = 'BB'
      if (tir < 1.5) rating = 'AAA'
      else if (tir < 2.0) rating = 'AA'
      else if (tir < 3.0) rating = 'A'
      else if (tir < 4.0) rating = 'BBB'
      riskMap[rating] += val
    })
    const riskData = Object.entries(riskMap)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => {
        let fill = '#ef4444'
        if (name === 'AAA') fill = '#22c55e'
        if (name === 'AA') fill = '#84cc16'
        if (name === 'A') fill = '#eab308'
        if (name === 'BBB') fill = '#f97316'
        return { name, value, fill }
      })

    const emissorMap: Record<string, number> = {}
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const emissorObj = Array.isArray(r.tomador) ? r.tomador[0] : r.tomador
      const emissor = emissorObj?.pj_company_name || emissorObj?.full_name || 'Desconhecido'
      emissorMap[emissor] = (emissorMap[emissor] || 0) + val
    })
    const issuerData = Object.entries(emissorMap)
      .map(([name, exposure]) => ({ name, exposure }))
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 3)

    const upcomingBoletos: any[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next30Days = new Date(today)
    next30Days.setDate(today.getDate() + 30)

    recebiveis.forEach((r) => {
      if (r.boletos && Array.isArray(r.boletos)) {
        r.boletos.forEach((b, idx) => {
          if (!b.due_date) return
          const bDate = new Date(b.due_date)
          bDate.setHours(0, 0, 0, 0)
          const bStatus = b.status || 'Pendente'
          if (
            bStatus.toLowerCase() !== 'pago' &&
            bDate.getTime() >= today.getTime() &&
            bDate.getTime() <= next30Days.getTime()
          ) {
            const emissorObj = Array.isArray(r.tomador) ? r.tomador[0] : r.tomador
            upcomingBoletos.push({
              id: `${r.id}-${idx}`,
              date: bDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
              dateObj: bDate,
              issuer: emissorObj?.pj_company_name || emissorObj?.full_name || 'Desconhecido',
              amount: Number(b.unit_value || b.face_value || r.boleto_unit_value) || 0,
              status: bStatus,
            })
          }
        })
      }
    })
    upcomingBoletos.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

    const insights = []

    const upcoming7Days = upcomingBoletos.filter(
      (b) => b.dateObj.getTime() <= today.getTime() + 7 * 24 * 60 * 60 * 1000,
    )
    if (upcoming7Days.length > 0) {
      insights.push({
        id: 'parcelas_7d',
        type: upcoming7Days.length > 5 ? 'critical' : 'warning',
        message: `${upcoming7Days.length} parcela(s) vencem nos próximos 7 dias`,
        actionText: 'Ver parcelas',
        icon: AlertCircle,
        action: 'scrollToBoletos',
      })
    }

    const hasConcentration = Object.entries(emissorMap).some(
      ([_, val]) => totalAUM > 0 && val / totalAUM > 0.3,
    )
    if (hasConcentration) {
      insights.push({
        id: 'concentracao',
        type: 'warning',
        message: 'Concentração acima de 30% em 1 emissor',
        actionText: 'Ver emissores',
        icon: AlertTriangle,
        action: 'scrollToEmissores',
      })
    }

    if (pdlMonths > 0 && pdlMonths < 6) {
      insights.push({
        id: 'pdl_baixo',
        type: 'info',
        message: 'PDL médio abaixo de 6 meses',
        actionText: 'Ver PDL',
        icon: Info,
        action: 'scrollToCards',
      })
    }

    const ratingScores: Record<string, number> = { AAA: 5, AA: 4, A: 3, BBB: 2, BB: 1 }
    let sumRatingScores = 0
    let totalRatedValue = 0
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const tir = Number(r.tir_effective) || 0
      let rating = 'BB'
      if (tir < 1.5) rating = 'AAA'
      else if (tir < 2.0) rating = 'AA'
      else if (tir < 3.0) rating = 'A'
      else if (tir < 4.0) rating = 'BBB'
      sumRatingScores += val * ratingScores[rating]
      totalRatedValue += val
    })
    const avgRatingScore = totalRatedValue > 0 ? sumRatingScores / totalRatedValue : 0
    if (totalRatedValue > 0 && avgRatingScore < 3) {
      insights.push({
        id: 'rating_baixo',
        type: 'critical',
        message: 'Rating médio abaixo de A',
        actionText: 'Ver risco',
        icon: Activity,
        action: 'scrollToRisco',
      })
    }

    return {
      totalAUM,
      receitaMensal,
      pdlMonths,
      totalEscrituras,
      riskData,
      issuerData,
      upcomingBoletos,
      insights,
    }
  }, [data])

  const totalPages = processedData
    ? Math.ceil(processedData.upcomingBoletos.length / itemsPerPage)
    : 0
  const paginatedBoletos = processedData
    ? processedData.upcomingBoletos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      )
    : []

  const cards = processedData
    ? [
        {
          title: 'Total AUM',
          icon: DollarSign,
          value: formatCurrency(processedData.totalAUM),
          sub: 'Soma de todas as emissões',
          delay: '0ms',
        },
        {
          title: 'Receita Estimada (Fees)',
          icon: TrendingUp,
          value: `${formatCurrency(processedData.receitaMensal)}/mês`,
          sub: 'Projeção mensal baseada em taxa anual',
          delay: '50ms',
        },
        {
          title: 'PDL Médio',
          icon: Calendar,
          value: `${processedData.pdlMonths.toFixed(1).replace('.', ',')} meses`,
          sub: 'Prazo médio ponderado',
          delay: '100ms',
        },
        {
          title: 'Escrituras Base',
          icon: FileText,
          value: String(processedData.totalEscrituras),
          sub: 'Emissões ativas no fundo',
          delay: '150ms',
        },
      ]
    : []

  const isEmpty = processedData?.totalAUM === 0 && processedData?.totalEscrituras === 0

  if (authLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (activeRole === 'investor') {
    return <Navigate to="/investidor" replace />
  }

  if (activeRole === 'borrower') {
    return <Navigate to="/tomador" replace />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
        <p className="text-muted-foreground">Visão geral das operações e portfólio.</p>
      </div>

      {status === 'loading' && !processedData ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isEmpty ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhum dado encontrado</AlertTitle>
          <AlertDescription>Ainda não há operações ou investimentos registrados.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => (
              <Card key={i} className="animate-fade-in" style={{ animationDelay: card.delay }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {processedData && processedData.insights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Insights e Alertas</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {processedData.insights.map((insight) => (
                  <Alert
                    key={insight.id}
                    variant={insight.type === 'critical' ? 'destructive' : 'default'}
                    className={insight.type === 'warning' ? 'border-amber-500 text-amber-600' : ''}
                  >
                    <insight.icon className="h-4 w-4" />
                    <AlertTitle className="mb-1">
                      {insight.type === 'critical' ? 'Atenção' : 'Aviso'}
                    </AlertTitle>
                    <AlertDescription className="flex flex-col gap-2 mt-2 sm:flex-row sm:justify-between sm:items-center">
                      <span>{insight.message}</span>
                      <Button variant="link" size="sm" className="p-0 h-auto font-semibold">
                        {insight.actionText} <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Exposição por Risco</CardTitle>
                <CardDescription>Distribuição do AUM por rating</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ChartContainer config={riskConfig} className="h-full w-full">
                  <PieChart>
                    <Pie
                      data={processedData?.riskData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {processedData?.riskData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maiores Emissores</CardTitle>
                <CardDescription>Top 3 emissores por volume</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ChartContainer config={issuerConfig} className="h-full w-full">
                  <BarChart
                    data={processedData?.issuerData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => `R$ ${(val / 1000000).toFixed(1)}M`}
                    />
                    <YAxis dataKey="name" type="category" width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="exposure" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Próximos Vencimentos</CardTitle>
                <CardDescription>Parcelas a receber nos próximos 30 dias</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedBoletos.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum vencimento previsto para os próximos 30 dias.
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Emissor</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBoletos.map((boleto) => (
                        <TableRow key={boleto.id}>
                          <TableCell className="font-medium">{boleto.date}</TableCell>
                          <TableCell>{boleto.issuer}</TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(boleto.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                boleto.status === 'Pago'
                                  ? 'default'
                                  : boleto.dateObj < new Date()
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className={boleto.status === 'Pago' ? 'bg-emerald-500' : ''}
                            >
                              {boleto.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
