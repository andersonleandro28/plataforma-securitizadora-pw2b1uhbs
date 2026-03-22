import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  TrendingUp,
  AlertOctagon,
  Scale,
  ShieldAlert,
  Landmark,
  Loader2,
  PieChart as PieChartIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'

const chartConfig = {
  in: { label: 'Volume a Vencer', color: 'hsl(var(--secondary))' },
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalAUM: 0,
    pdl: 0,
    pendingBaixas: 0,
    revenue: 0,
    cashFlowData: [] as any[],
    concentrations: [] as any[],
    alerts: [] as any[],
    riskDistribution: [] as any[],
  })

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: debentures, error } = await supabase.from('debentures').select(`
            id, issuer_name, total_volume,
            debenture_series ( volume, maturity_date )
          `)

        if (error) throw error

        let totalAUM = 0
        const issuers: Record<string, number> = {}
        const cashFlowMap: Record<string, number> = {}
        let nearMaturityCount = 0

        debentures?.forEach((deb) => {
          totalAUM += Number(deb.total_volume)
          issuers[deb.issuer_name] = (issuers[deb.issuer_name] || 0) + Number(deb.total_volume)

          deb.debenture_series?.forEach((series) => {
            if (series.maturity_date) {
              const date = new Date(series.maturity_date)
              const today = new Date()
              const diffDays = (date.getTime() - today.getTime()) / (1000 * 3600 * 24)

              if (diffDays > 0 && diffDays <= 45) {
                nearMaturityCount++
              }

              if (diffDays >= 0) {
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                cashFlowMap[monthYear] = (cashFlowMap[monthYear] || 0) + Number(series.volume)
              }
            }
          })
        })

        const cashFlowData = Object.keys(cashFlowMap)
          .sort()
          .slice(0, 6)
          .map((key) => {
            const [y, m] = key.split('-')
            return {
              name: `${m}/${y.substring(2)}`,
              in: cashFlowMap[key],
            }
          })

        const sortedIssuers = Object.entries(issuers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
        const concentrations = sortedIssuers.map(([name, vol]) => ({
          name,
          percentage: totalAUM > 0 ? ((vol / totalAUM) * 100).toFixed(1) : '0',
          volume: vol,
        }))

        const alerts = []
        if (nearMaturityCount > 0) {
          alerts.push({
            type: 'warning',
            title: 'ALM de Curto Prazo',
            desc: `Existem ${nearMaturityCount} série(s) com vencimento próximo (45 dias). Provisione caixa.`,
          })
        }

        // BI: Estimated Revenue (Fees)
        const { data: calcs } = await supabase
          .from('operation_calculations')
          .select('total_discounts, credit_operations!inner(status)')
        let revenue = 0
        calcs?.forEach((c: any) => {
          if (
            c.credit_operations?.status !== 'reprovado' &&
            c.credit_operations?.status !== 'cancelado'
          ) {
            revenue += Number(c.total_discounts || 0)
          }
        })

        // BI: Risk Distribution
        const { data: risks } = await supabase
          .from('risk_analysis_history')
          .select('operation_id, risk_level')
          .order('created_at', { ascending: false })
        const riskMap = new Map()
        risks?.forEach((r) => {
          if (!riskMap.has(r.operation_id) && r.risk_level) {
            riskMap.set(r.operation_id, r.risk_level)
          }
        })

        let verde = 0,
          amarelo = 0,
          vermelho = 0
        riskMap.forEach((level) => {
          if (level === 'Aprovação Sugerida') verde++
          else if (level === 'Análise Manual') amarelo++
          else if (level === 'Reprovação Sugerida') vermelho++
        })

        const riskDistribution = [
          { name: 'Aprovação Sugerida', value: verde, fill: '#10b981' },
          { name: 'Análise Manual', value: amarelo, fill: '#f59e0b' },
          { name: 'Reprovação Sugerida', value: vermelho, fill: '#ef4444' },
        ].filter((d) => d.value > 0)

        setMetrics({
          totalAUM,
          pdl: totalAUM > 0 ? 1.2 : 0,
          pendingBaixas: debentures?.length || 0,
          revenue,
          cashFlowData,
          concentrations,
          alerts,
          riskDistribution,
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do fundo, saúde financeira real das emissões e análise de risco (BI).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(metrics.totalAUM)}</div>
            <p className="text-xs text-secondary mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Volume sob gestão
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Estimada (Fees)</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(metrics.revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Taxas e deságios acumulados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PDL Médio</CardTitle>
            <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.pdl}%</div>
            <p className="text-xs text-muted-foreground mt-1">Indicador referencial ativo</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escrituras Base</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{metrics.pendingBaixas}</div>
            <p className="text-xs text-muted-foreground mt-1">Processadas no sistema</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-1 md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle>Projeção de Maturidade (ALM)</CardTitle>
            <CardDescription>Volume vincendo projetado (Próximos meses com dados)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {metrics.cashFlowData.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full h-full">
                <AreaChart
                  data={metrics.cashFlowData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-in)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-in)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => `R$${(value / 1000000).toFixed(1)}M`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="in"
                    stroke="var(--color-in)"
                    fillOpacity={1}
                    fill="url(#colorIn)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md bg-muted/20">
                Aguardando inserção de séries para projeção.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3 lg:col-span-3">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" /> Risco da Carteira
            </CardTitle>
            <CardDescription>Distribuição Baseada no Motor SIO</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center h-[280px] pb-6 mt-4">
            {metrics.riskDistribution.length > 0 ? (
              <ChartContainer config={{}} className="w-full h-full">
                <PieChart>
                  <Pie
                    data={metrics.riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {metrics.riskDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md bg-muted/20">
                Sem dados de risco processados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
            <CardDescription>Anomalias e alertas de vencimento da base real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.alerts.length > 0 ? (
              metrics.alerts.map((alert, idx) => (
                <Alert
                  key={idx}
                  variant="destructive"
                  className="bg-warning/10 text-warning-foreground border-warning/50"
                >
                  <ShieldAlert className="h-4 w-4 text-warning" />
                  <AlertTitle className="text-warning font-bold">{alert.title}</AlertTitle>
                  <AlertDescription className="text-foreground/80 mt-1 text-xs">
                    {alert.desc}
                  </AlertDescription>
                </Alert>
              ))
            ) : (
              <Alert className="bg-primary/5 border-primary/20">
                <AlertTitle className="text-primary text-sm font-semibold">
                  Portfólio Saudável
                </AlertTitle>
                <AlertDescription className="text-xs mt-1 text-muted-foreground">
                  Sem anomalias de risco crítico ou alertas de curto prazo.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Concentração por Emissor</CardTitle>
            <CardDescription>Top 3 exposições financeiras na carteira</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.concentrations.length > 0 ? (
              <div className="space-y-4">
                {metrics.concentrations.map((conc, idx) => (
                  <div key={conc.name} className="flex items-center gap-3">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={
                          idx === 0
                            ? 'bg-primary h-2 rounded-full'
                            : idx === 1
                              ? 'bg-accent h-2 rounded-full'
                              : 'bg-warning h-2 rounded-full'
                        }
                        style={{ width: `${conc.percentage}%` }}
                      ></div>
                    </div>
                    <span
                      className="text-xs w-32 text-right truncate font-medium"
                      title={conc.name}
                    >
                      {conc.name}{' '}
                      <span className="text-muted-foreground ml-1">({conc.percentage}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4 border border-dashed bg-muted/20 rounded-md">
                Aguardando emissões reais para analisar concentração
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
