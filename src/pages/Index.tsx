import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { RefreshCw, DollarSign, TrendingUp, Calendar, FileText, AlertCircle } from 'lucide-react'
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
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<{ recebiveis: any[]; investimentos: any[] } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const { toast } = useToast()
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(() => {
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
  }, [toast])

  useEffect(() => {
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
  }, [fetchData])

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

    return {
      totalAUM,
      receitaMensal,
      pdlMonths,
      totalEscrituras,
      riskData,
      issuerData,
      upcomingBoletos,
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

  return (
    <div className="flex flex-col gap-6 p-6 w-full animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Visão geral do fundo e saúde financeira</p>
        </div>
        <Button onClick={fetchData} disabled={status === 'loading'}>
          <RefreshCw className={cn('w-4 h-4 mr-2', status === 'loading' && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>Falha ao carregar os dados do dashboard.</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="w-fit">
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === 'success' && isEmpty && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sem Dados</AlertTitle>
          <AlertDescription>Nenhum dado disponível no momento.</AlertDescription>
        </Alert>
      )}

      {(status === 'loading' || (status === 'success' && !isEmpty)) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {status === 'loading' ? (
                    <div className="space-y-2 mt-1">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <div className="animate-fade-in-up" style={{ animationDelay: card.delay }}>
                      <div className="text-2xl font-bold">{card.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Risco da Carteira</CardTitle>
                <CardDescription>Distribuição por rating</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {status === 'loading' ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                  </div>
                ) : (
                  <div
                    className="h-[300px] w-full animate-fade-in-up"
                    style={{ animationDelay: '200ms' }}
                  >
                    <ChartContainer config={riskConfig} className="h-full w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          data={processedData?.riskData || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {processedData?.riskData?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Top 3 Emissores</CardTitle>
                <CardDescription>Maiores exposições (R$)</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {status === 'loading' ? (
                  <div className="space-y-4 pt-4 h-[300px]">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-[90%]" />
                    <Skeleton className="h-12 w-[80%]" />
                  </div>
                ) : (
                  <div
                    className="h-[300px] w-full animate-fade-in-up"
                    style={{ animationDelay: '250ms' }}
                  >
                    <ChartContainer config={issuerConfig} className="h-full w-full">
                      <BarChart
                        data={processedData?.issuerData || []}
                        layout="vertical"
                        margin={{ left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(0)}M`}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          width={100}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                            />
                          }
                        />
                        <Bar
                          dataKey="exposure"
                          fill="var(--color-exposure)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volume Vencendo (Próximos 30 dias)</CardTitle>
              <CardDescription>Próximas parcelas e amortizações a vencer</CardDescription>
            </CardHeader>
            <CardContent>
              {status === 'loading' ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Emissor</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBoletos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma parcela vencendo nos próximos 30 dias
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedBoletos.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell>{row.issuer}</TableCell>
                            <TableCell className="text-right">
                              R$ {row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-end space-x-2 py-4">
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
