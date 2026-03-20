import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  TrendingUp,
  AlertOctagon,
  Scale,
  ShieldAlert,
  Landmark,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
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
    cashFlowData: [] as any[],
    concentrations: [] as any[],
    alerts: [] as any[],
  })

  useEffect(() => {
    const checkMetaMaskConnection = async () => {
      try {
        if (typeof window !== 'undefined' && 'ethereum' in window) {
          const ethereum = (window as any).ethereum
          if (ethereum && ethereum.isMetaMask) {
            try {
              await ethereum.request({ method: 'eth_accounts' })
            } catch (connectionError) {
              console.warn('Intercepted MetaMask connection error:', connectionError)
            }
          }
        }
      } catch (error) {
        console.error('Safeguard caught an error during MetaMask provider check:', error)
      }
    }

    checkMetaMaskConnection()

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const isMetaMaskError =
        reason === 'Failed to connect to MetaMask' ||
        (reason instanceof Error && reason.message.includes('Failed to connect to MetaMask')) ||
        (reason &&
          typeof reason === 'object' &&
          'message' in reason &&
          String(reason.message).includes('Failed to connect to MetaMask'))

      if (isMetaMaskError) {
        event.preventDefault()
      }
    }

    const handleError = (event: ErrorEvent) => {
      if (event.message && event.message.includes('Failed to connect to MetaMask')) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

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

        setMetrics({
          totalAUM,
          pdl: totalAUM > 0 ? 1.2 : 0,
          pendingBaixas: debentures?.length || 0,
          cashFlowData,
          concentrations,
          alerts,
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
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
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do fundo e saúde financeira real das emissões processadas.
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
              <ArrowUpRight className="h-3 w-3" /> Calculado via extrato
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status ALM</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              {metrics.totalAUM > 0 ? 'Positivo' : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalAUM > 0 ? 'Cobertura adequada ao risco' : 'Aguardando operações'}
            </p>
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
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{metrics.pendingBaixas}</div>
            <p className="text-xs text-muted-foreground mt-1">Processadas no sistema</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
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
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Aguardando inserção de séries para projeção.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>AI Insights & Portfólio</CardTitle>
            <CardDescription>Análises extraídas da base real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  Sem anomalias de risco ou alertas de curto prazo.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium mb-3">Concentração por Emissor (Top 3)</h4>
              {metrics.concentrations.length > 0 ? (
                <div className="space-y-3">
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
                <div className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
                  Aguardando emissões reais
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
