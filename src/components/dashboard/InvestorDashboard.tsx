import { useEffect, useState } from 'react'
import {
  Wallet,
  TrendingUp,
  Landmark,
  PieChart,
  Receipt,
  CalendarDays,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const chartConfig = {
  rendimento: { label: 'Rendimento Líquido (R$)', color: 'hsl(var(--primary))' },
}

export default function InvestorDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)

  const [metrics, setMetrics] = useState({
    totalInvested: 0,
    grossYield: 0,
    estimatedIR: 0,
    netYield: 0,
    yieldPercentage: 0,
    nextAmortization: 0,
    nextAmortizationDate: '',
    topSeries: 'Nenhuma',
    topIndexer: '-',
    chartData: [] as any[],
  })

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile?.document_number) {
        setLoading(false)
        return
      }

      try {
        const { data: subs, error } = await supabase
          .from('debenture_subscriptions')
          .select(`
            *,
            debenture_series (
              rate, indexer, maturity_date, debenture_id,
              debentures ( issuer_name )
            )
          `)
          .eq('document_number', profile.document_number)

        if (error) throw error

        let totalInvested = 0
        let totalGrossYield = 0
        let totalEstimatedIR = 0
        let nextAmortization = 0
        let nextAmortizationDate: Date | null = null
        let maxInvestment = 0
        let topSeries = 'Nenhuma'
        let topIndexer = '-'

        const today = new Date()

        subs?.forEach((sub: any) => {
          const amount = Number(sub.total_amount)
          totalInvested += amount

          const rate = Number(sub.debenture_series?.rate || 0)
          const subDate = new Date(sub.subscription_date || sub.created_at)

          // Dias corridos desde o aporte
          const days = Math.max(0, (today.getTime() - subDate.getTime()) / (1000 * 3600 * 24))

          // Juros compostos baseados na taxa anual informada na série
          const grossYield = amount * Math.pow(1 + rate / 100, days / 365) - amount
          totalGrossYield += grossYield

          // Tabela Regressiva de IR
          let irRate = 0.225
          if (days > 720) irRate = 0.15
          else if (days > 360) irRate = 0.175
          else if (days > 180) irRate = 0.2

          totalEstimatedIR += grossYield * irRate

          if (amount > maxInvestment) {
            maxInvestment = amount
            topSeries = sub.debenture_series?.debentures?.issuer_name || 'Série'
            topIndexer = `${sub.debenture_series?.indexer} + ${rate}% a.a.`
          }

          const matDate = sub.debenture_series?.maturity_date
            ? new Date(sub.debenture_series.maturity_date)
            : null
          if (matDate && matDate > today) {
            if (!nextAmortizationDate || matDate < nextAmortizationDate) {
              nextAmortizationDate = matDate
              nextAmortization = amount + grossYield // Projeção simplificada na data
            }
          }
        })

        const netYield = totalGrossYield - totalEstimatedIR
        const yieldPercentage = totalInvested > 0 ? (totalGrossYield / totalInvested) * 100 : 0

        // Gráfico: Projeção retroativa dos últimos 6 meses
        const chartData = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          const monthStr = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

          let monthYield = 0
          subs?.forEach((sub: any) => {
            const subDate = new Date(sub.subscription_date || sub.created_at)
            if (subDate <= d) {
              const days = Math.max(0, (d.getTime() - subDate.getTime()) / (1000 * 3600 * 24))
              const rate = Number(sub.debenture_series?.rate || 0)
              const amount = Number(sub.total_amount)
              const gYield = amount * Math.pow(1 + rate / 100, days / 365) - amount

              let irRate = 0.225
              if (days > 720) irRate = 0.15
              else if (days > 360) irRate = 0.175
              else if (days > 180) irRate = 0.2

              monthYield += gYield * (1 - irRate)
            }
          })
          chartData.push({ name: monthStr, rendimento: monthYield })
        }

        setMetrics({
          totalInvested,
          grossYield: totalGrossYield,
          estimatedIR: totalEstimatedIR,
          netYield,
          yieldPercentage,
          nextAmortization,
          nextAmortizationDate: nextAmortizationDate
            ? nextAmortizationDate.toLocaleDateString('pt-BR')
            : '',
          topSeries,
          topIndexer,
          chartData,
        })
      } catch (err) {
        console.error('Error fetching investor data', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [profile])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile?.document_number) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cadastro Incompleto</AlertTitle>
          <AlertDescription className="mt-2">
            É necessário preencher o seu CPF/CNPJ no menu de Perfil para vincularmos seus
            investimentos e exibir os rendimentos da sua carteira.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <p className="text-muted-foreground">
          Acompanhamento do seu portfólio, rendimentos reais e impostos retidos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Patrimônio Investido</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalInvested)}</div>
            <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +{metrics.yieldPercentage.toFixed(2)}% bruto
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Líquido</CardTitle>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              +{formatCurrency(metrics.netYield)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              IR Retido (Est.):{' '}
              <span className="text-destructive font-medium">
                -{formatCurrency(metrics.estimatedIR)}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próxima Amortização</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.nextAmortization > 0 ? formatCurrency(metrics.nextAmortization) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.nextAmortizationDate
                ? `Previsto p/ ${metrics.nextAmortizationDate}`
                : 'Sem previsão'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Maior Posição</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-primary truncate" title={metrics.topSeries}>
              {metrics.topSeries}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ref: {metrics.topIndexer}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução do Rendimento Líquido</CardTitle>
          <CardDescription>
            Crescimento do seu patrimônio com base na data de aporte, já descontada a provisão de IR
            (Tabela Regressiva).
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {metrics.chartData.length > 0 && metrics.totalInvested > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <AreaChart
                data={metrics.chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-rendimento)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-rendimento)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" />
                <YAxis
                  width={80}
                  tickFormatter={(value) =>
                    value >= 1000 ? `R$${(value / 1000).toFixed(1)}k` : `R$${value.toFixed(0)}`
                  }
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="rendimento"
                  stroke="var(--color-rendimento)"
                  fillOpacity={1}
                  fill="url(#colorYield)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed">
              <p>
                Nenhum investimento processado ainda. Realize aportes para visualizar o crescimento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
