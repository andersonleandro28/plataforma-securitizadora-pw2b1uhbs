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
  FileText,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

const chartConfig = {
  rendimento: { label: 'Rendimento Líquido (R$)', color: 'hsl(var(--primary))' },
}

export default function InvestorDashboard() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [myInvestments, setMyInvestments] = useState<any[]>([])

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
      if (!profile?.document_number || !user) {
        setLoading(false)
        return
      }

      try {
        // Fetch legacy subscriptions for charts
        const { data: subs } = await supabase
          .from('debenture_subscriptions')
          .select('*, debenture_series(rate, indexer, maturity_date, debentures(issuer_name))')
          .eq('document_number', profile.document_number)

        // Fetch new investments flow
        const { data: investmentsData } = await supabase
          .from('investments')
          .select('*, investment_products(title)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        setMyInvestments(investmentsData || [])

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
          const days = Math.max(0, (today.getTime() - subDate.getTime()) / (1000 * 3600 * 24))
          const grossYield = amount * Math.pow(1 + rate / 100, days / 365) - amount
          totalGrossYield += grossYield

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
              nextAmortization = amount + grossYield
            }
          }
        })

        const netYield = totalGrossYield - totalEstimatedIR
        const yieldPercentage = totalInvested > 0 ? (totalGrossYield / totalInvested) * 100 : 0
        const chartData = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          let monthYield = 0
          subs?.forEach((sub: any) => {
            const subDate = new Date(sub.subscription_date || sub.created_at)
            if (subDate <= d) {
              const days = Math.max(0, (d.getTime() - subDate.getTime()) / (1000 * 3600 * 24))
              const rate = Number(sub.debenture_series?.rate || 0)
              const amount = Number(sub.total_amount)
              const gYield = amount * Math.pow(1 + rate / 100, days / 365) - amount
              monthYield += gYield * 0.8 // simplified IR for chart
            }
          })
          chartData.push({
            name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            rendimento: monthYield,
          })
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
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [profile, user])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!profile?.document_number)
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cadastro Incompleto</AlertTitle>
          <AlertDescription className="mt-2">
            É necessário preencher o seu CPF/CNPJ no menu de Perfil para visualizar seus
            investimentos.
          </AlertDescription>
        </Alert>
      </div>
    )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <p className="text-muted-foreground">
          Acompanhamento do seu portfólio, rendimentos reais e impostos retidos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Patrimônio Investido</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalInvested)}</div>
            <p className="text-xs text-emerald-500 mt-1">
              +{metrics.yieldPercentage.toFixed(2)}% bruto
            </p>
          </CardContent>
        </Card>
        <Card>
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
        <Card>
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
        <Card>
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
          <CardTitle>Evolução do Rendimento</CardTitle>
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
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
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
              <p>Nenhum investimento processado ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Meus Aportes e Solicitações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cotas</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myInvestments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhuma solicitação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                myInvestments.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.investment_products?.title}</TableCell>
                    <TableCell>{inv.quotas}</TableCell>
                    <TableCell className="font-mono text-primary font-medium">
                      {formatCurrency(inv.total_value)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {inv.created_at ? format(new Date(inv.created_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {inv.status === 'approved' ? (
                        <Badge className="bg-emerald-500">Aprovado</Badge>
                      ) : inv.status === 'awaiting_review' ? (
                        <Badge className="bg-amber-500">Em Conferência</Badge>
                      ) : inv.status === 'rejected' ? (
                        <Badge variant="destructive">Reprovado</Badge>
                      ) : (
                        <Badge variant="outline">Aguardando Depósito</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'pending_transfer' && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/investments/checkout/${inv.id}`)}
                          className="gap-2"
                        >
                          Enviar Comprovante <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
