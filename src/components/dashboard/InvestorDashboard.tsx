import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  LineChart as LineChartIcon,
  FolderOpen,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

const TabContent = ({ data, statusLabel, onRefresh }: any) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10 border-dashed mt-4 animate-in fade-in duration-500">
        <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Nenhum investimento encontrado</h3>
        <Button variant="outline" onClick={onRefresh} className="mt-4">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    )
  }

  return (
    <Card className="border border-border shadow-sm mt-4 overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="pb-0 pt-6 px-6">
        <CardTitle className="text-lg font-semibold">{statusLabel}</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Produto</TableHead>
              <TableHead className="whitespace-nowrap">Quotas</TableHead>
              <TableHead className="whitespace-nowrap">Valor Unitário</TableHead>
              <TableHead className="whitespace-nowrap">Valor Total</TableHead>
              <TableHead className="whitespace-nowrap">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((inv: any, index: number) => {
              const unitPrice = inv.unit_price != null ? Number(inv.unit_price) : null
              const totalValue = inv.total_value != null ? Number(inv.total_value) : null

              return (
                <TableRow key={inv.id || index}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {inv.investment_products?.title || '-'}
                  </TableCell>
                  <TableCell>{inv.quotas ?? '-'}</TableCell>
                  <TableCell>{unitPrice != null ? formatCurrency(unitPrice) : '-'}</TableCell>
                  <TableCell>{totalValue != null ? formatCurrency(totalValue) : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {inv.created_at ? formatDate(inv.created_at) : '-'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

export function InvestorDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [myInvestments, setMyInvestments] = useState<any[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [yieldAmount, setYieldAmount] = useState(0)
  const [activeTab, setActiveTab] = useState('ativos')
  const [chartSelection, setChartSelection] = useState('geral')

  const fetchDashboardData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const [invRes, redRes, profRes] = await Promise.all([
        supabase
          .from('investments_view')
          .select('*, investment_products(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('investment_redemptions')
          .select('yield_amount')
          .eq('user_id', user.id)
          .eq('status', 'paid'),
        supabase.from('profiles').select('wallet_balance, kyc_status').eq('id', user.id).single(),
      ])

      if (invRes.error) throw invRes.error
      if (redRes.error) throw redRes.error
      if (profRes.error) throw profRes.error

      setMyInvestments(invRes.data || [])

      const totalYield = (redRes.data || []).reduce(
        (acc, curr) => acc + (Number(curr.yield_amount) || 0),
        0,
      )
      setYieldAmount(totalYield)

      setWalletBalance(Number(profRes.data?.wallet_balance) || 0)
    } catch (err: any) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData()
    }
  }, [authLoading, user, fetchDashboardData])

  const { ativos, resgatados, cancelados } = useMemo(() => {
    const ativosArr: any[] = []
    const resgatadosArr: any[] = []
    const canceladosArr: any[] = []

    myInvestments.forEach((i) => {
      const st = (i.status || '').toLowerCase().trim()
      if (st === 'excluído' || st === 'excluido' || st === 'deleted') return

      if (st === 'approved') {
        ativosArr.push(i)
      } else if (st === 'resgatado' || st === 'paid') {
        resgatadosArr.push(i)
      } else if (st === 'cancelled' || st === 'cancelado') {
        canceladosArr.push(i)
      }
    })

    return { ativos: ativosArr, resgatados: resgatadosArr, cancelados: canceladosArr }
  }, [myInvestments])

  const totalAtivosValue = ativos.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0)
  const totalBalance = walletBalance + totalAtivosValue
  const activeCount = ativos.length

  const { chartData, todayMonthStr } = useMemo(() => {
    const today = new Date()
    const tStr = today.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    const invsToChart =
      chartSelection === 'geral' ? ativos : ativos.filter((i) => i.id === chartSelection)
    if (invsToChart.length === 0) return { chartData: [], todayMonthStr: tStr }

    let minDate = new Date()
    invsToChart.forEach((inv) => {
      const d = new Date(inv.transfer_date || inv.created_at)
      if (d < minDate) minDate = d
    })

    const data = []
    const endDate = new Date(today.getFullYear() + 1, today.getMonth(), 1)

    let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    const thisMonthTime = new Date(today.getFullYear(), today.getMonth(), 1).getTime()

    while (current <= endDate) {
      let monthValue = 0

      invsToChart.forEach((inv) => {
        const startD = new Date(inv.transfer_date || inv.created_at)
        if (current >= new Date(startD.getFullYear(), startD.getMonth(), 1)) {
          const diffTime = Math.abs(current.getTime() - startD.getTime())
          const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))

          const rateStr = inv.investment_products?.rate || ''
          let monthlyRate = 0.01
          const match = rateStr.match(/(\d+[.,]\d+|\d+)/)
          if (match) {
            const val = parseFloat(match[1].replace(',', '.')) / 100
            if (rateStr.toLowerCase().includes('a.a')) {
              monthlyRate = Math.pow(1 + val, 1 / 12) - 1
            } else {
              monthlyRate = val
            }
          }

          const initialValue = Number(inv.total_value) || 0
          monthValue += initialValue * Math.pow(1 + monthlyRate, diffMonths)
        }
      })

      data.push({
        date: current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: parseFloat(monthValue.toFixed(2)),
        isProjection: current.getTime() > thisMonthTime,
      })

      current.setMonth(current.getMonth() + 1)
    }
    return { chartData: data, todayMonthStr: tStr }
  }, [ativos, chartSelection])

  const chartConfig = {
    valor: { label: 'Valor Projetado', color: 'hsl(var(--primary))' },
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-in fade-in duration-500">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-bold">Erro ao carregar dados</h2>
        <p className="text-muted-foreground">Ocorreu um erro inesperado. Tente novamente.</p>
        <Button onClick={fetchDashboardData} size="lg" className="mt-4">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-in slide-in-from-bottom-4 fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h1>
        <p className="text-muted-foreground">
          Acompanhe a performance do seu portfólio de investimentos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">
              Saldo Total
            </CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{formatCurrency(totalBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Número de Investimentos Ativos</CardTitle>
            <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Acumulado</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 font-mono">
              {formatCurrency(yieldAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Evolução dos Investimentos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Crescimento projetado com base nas taxas dos ativos.
            </p>
          </div>
          <Select value={chartSelection} onValueChange={setChartSelection}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Geral (Todos Ativos)</SelectItem>
              {ativos.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {inv.investment_products?.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(val) =>
                      `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`
                    }
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine
                    x={todayMonthStr}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                    label={{
                      position: 'insideTopLeft',
                      value: 'Hoje',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="var(--color-valor)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: 'var(--color-valor)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              Nenhum dado disponível para o gráfico.
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Meus Investimentos</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="resgatados">Resgatados</TabsTrigger>
            <TabsTrigger value="cancelados">Cancelados</TabsTrigger>
          </TabsList>

          <TabsContent value="ativos">
            <TabContent
              data={ativos}
              statusLabel="Investimentos Ativos"
              onRefresh={fetchDashboardData}
            />
          </TabsContent>
          <TabsContent value="resgatados">
            <TabContent
              data={resgatados}
              statusLabel="Investimentos Resgatados"
              onRefresh={fetchDashboardData}
            />
          </TabsContent>
          <TabsContent value="cancelados">
            <TabContent
              data={cancelados}
              statusLabel="Investimentos Cancelados"
              onRefresh={fetchDashboardData}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
export default InvestorDashboard
