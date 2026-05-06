import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  PieChart,
  AlertCircle,
  AlertTriangle,
  RefreshCcw,
  FolderOpen,
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

const calculateGain = (inv: any) => {
  if (inv.transfer_value == null) return 0
  const total = Number(inv.total_value) || 0
  const transfer = Number(inv.transfer_value) || 0
  return transfer - total
}

const TabContent = ({ status, statusLabel, user, chartConfig, onViewOtherStatus }: any) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    console.log(`Carregando ${statusLabel}... user_id = ${user.id}`)
    console.log('Auth UID:', user.id)

    try {
      const { data: res, error: err } = await supabase
        .from('investments_view')
        .select('*, investment_products(*)')
        .eq('user_id', user.id)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (err) {
        console.log('Erro ao carregar:', err.message)
        throw err
      }

      console.log('Dados retornados:', res?.length || 0, 'registros')
      console.log('Dados carregados:', res)

      if (!res || res.length === 0) {
        console.log('Nenhum investimento nesta aba')
      } else {
        console.log(`Renderizando ${res.length} investimentos`)
      }

      setData(res || [])
    } catch (e: any) {
      console.log('Erro ao carregar:', e.message)
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [status, statusLabel, user?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4 mt-4 opacity-100 visible block">
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (error) {
    const isAuthError =
      error.code === 'PGRST301' ||
      error.code === '401' ||
      error.code === '403' ||
      error.status === 401 ||
      error.status === 403
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10 border-dashed mt-4 animate-in fade-in duration-500 opacity-100 visible block">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">
          {isAuthError
            ? 'Acesso negado. Verifique suas permissoes.'
            : 'Erro ao carregar dados. Tente novamente.'}
        </h3>
        <Button variant="outline" onClick={fetchData} className="mt-4">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10 border-dashed mt-4 animate-in fade-in duration-500 opacity-100 visible block">
        <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Nenhum investimento neste status</h3>
        <div className="flex gap-4 mt-4">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Recarregar
          </Button>
          <Button variant="secondary" onClick={onViewOtherStatus}>
            Ver outros status
          </Button>
        </div>
      </div>
    )
  }

  const individualChartData = data.map((inv: any) => ({
    produto: inv.investment_products?.title || 'Desconhecido',
    ganho: calculateGain(inv),
  }))

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-500 opacity-100 visible block">
      {data.length > 0 && (
        <Card className="opacity-100 visible block">
          <CardHeader>
            <CardTitle>Ganhos por Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                data={individualChartData}
                margin={{ top: 20, right: 0, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="produto"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `R$ ${value}`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ganho" radius={[4, 4, 0, 0]}>
                  {individualChartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.ganho > 0
                          ? 'hsl(var(--success, 142.1 76.2% 36.3%))'
                          : entry.ganho < 0
                            ? 'hsl(var(--destructive, 0 84.2% 60.2%))'
                            : 'hsl(var(--muted-foreground, 215.4 16.3% 46.9%))'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border shadow-sm opacity-100 visible block overflow-hidden">
        <div className="w-full overflow-x-auto bg-card">
          <table
            className="w-full text-sm text-left border-collapse"
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Produto</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Quotas</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Valor Unitário</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Valor Total</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Valor Resgatado</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Ganho</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {data.map((inv: any, index: number) => {
                console.log('Renderizando linha HTML:', inv)
                const unitPrice = inv.unit_price != null ? Number(inv.unit_price) : null
                const totalValue = inv.total_value != null ? Number(inv.total_value) : null
                const transferValue = inv.transfer_value != null ? Number(inv.transfer_value) : null
                const gain = calculateGain(inv)

                return (
                  <tr key={inv.id || index} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {inv.investment_products?.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{inv.quotas ?? '-'}</td>
                    <td className="px-4 py-3 text-foreground">
                      {unitPrice != null ? formatCurrency(unitPrice) : '-'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {totalValue != null ? formatCurrency(totalValue) : '-'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {transferValue != null ? formatCurrency(transferValue) : '-'}
                    </td>
                    <td
                      className={
                        'px-4 py-3 font-medium whitespace-nowrap ' +
                        (gain > 0
                          ? 'text-emerald-600'
                          : gain < 0
                            ? 'text-red-500'
                            : 'text-foreground')
                      }
                    >
                      {formatCurrency(gain)}
                    </td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">
                      {inv.created_at ? formatDate(inv.created_at) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function InvestorDashboard() {
  const { profile, user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [myInvestments, setMyInvestments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('approved')

  const fetchDashboardData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(false)

    console.log('Auth UID (Dashboard):', user.id)

    try {
      const { data, error: fetchErr } = await supabase
        .from('investments_view')
        .select('*, investment_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchErr) {
        console.log('Erro:', fetchErr.message)
        throw fetchErr
      }

      console.log('Dados retornados (Dashboard):', data?.length || 0, 'registros')
      setMyInvestments(data || [])
    } catch (err: any) {
      console.log('Erro:', err.message || err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user && profile?.role === 'investor') {
      fetchDashboardData()
    } else if (!authLoading && user && profile?.role !== 'investor') {
      setLoading(false)
    }
  }, [authLoading, user, profile, fetchDashboardData])

  const sumGains = (invs: any[]) => invs.reduce((acc, curr) => acc + calculateGain(curr), 0)

  const { ativos, resgatados, cancelados, excluidos } = useMemo(() => {
    return {
      ativos: myInvestments.filter((i) => i.status === 'approved'),
      resgatados: myInvestments.filter((i) => i.status === 'resgatado'),
      cancelados: myInvestments.filter((i) => i.status === 'cancelled'),
      excluidos: myInvestments.filter((i) => i.status === 'Excluído'),
    }
  }, [myInvestments])

  const summaryChartData = useMemo(
    () => [
      { status: 'Ativos', ganho: sumGains(ativos), fill: 'hsl(var(--success, 142.1 76.2% 36.3%))' },
      {
        status: 'Resgatados',
        ganho: sumGains(resgatados),
        fill: 'hsl(var(--primary, 221.2 83.2% 53.3%))',
      },
      {
        status: 'Cancelados',
        ganho: sumGains(cancelados),
        fill: 'hsl(var(--destructive, 0 84.2% 60.2%))',
      },
      {
        status: 'Excluídos',
        ganho: sumGains(excluidos),
        fill: 'hsl(var(--muted-foreground, 215.4 16.3% 46.9%))',
      },
    ],
    [ativos, resgatados, cancelados, excluidos],
  )

  const chartConfig = {
    ganho: { label: 'Ganho', color: 'hsl(var(--primary))' },
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6 animate-in fade-in duration-500 opacity-100 visible block">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (profile?.role !== 'investor') {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-in fade-in duration-500 opacity-100 visible block">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar a área de investidor.
        </p>
        <Button onClick={() => (window.location.href = '/login')} size="lg" className="mt-4">
          Voltar ao Login
        </Button>
      </div>
    )
  }

  if (error) {
    const isAuthError =
      error.code === 'PGRST301' ||
      error.code === '401' ||
      error.code === '403' ||
      error.status === 401 ||
      error.status === 403
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-in fade-in duration-500 opacity-100 visible block">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-bold">Erro ao carregar</h2>
        <p className="text-muted-foreground">
          {isAuthError
            ? 'Acesso negado. Verifique suas permissoes.'
            : 'Erro ao carregar dados. Tente novamente.'}
        </p>
        <Button onClick={fetchDashboardData} size="lg" className="mt-4">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    )
  }

  const activeInvestments = myInvestments.filter(
    (i) => i.status === 'approved' || i.status === 'Ativo',
  )
  const totalBalance = activeInvestments.reduce(
    (acc, curr) => acc + (Number(curr.total_value) || 0),
    0,
  )
  const totalYield = activeInvestments.reduce((acc, curr) => {
    const amount = Number(curr.total_value) || 0
    const rateStr = curr.investment_products?.rate || '0'
    const rateMatch = rateStr.match(/(\d+[.,]\d+|\d+)/)
    const rate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) / 100 : 0.01
    return acc + amount * rate
  }, 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-in slide-in-from-bottom-4 fade-in duration-500 opacity-100 visible block pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard do Investidor</h1>
        <p className="text-muted-foreground">Acompanhe seus investimentos e rendimentos.</p>
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
            <CardTitle className="text-sm font-medium">Investimentos Ativos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeInvestments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rendimentos Acumulados</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 font-mono">
              +{formatCurrency(totalYield)}
            </div>
          </CardContent>
        </Card>
      </div>

      {myInvestments.length > 0 && (
        <Card className="opacity-100 visible block">
          <CardHeader>
            <CardTitle>Ganhos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                layout="vertical"
                data={summaryChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `R$ ${value}`} />
                <YAxis type="category" dataKey="status" width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ganho" radius={[0, 4, 4, 0]}>
                  {summaryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Meus Investimentos</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="approved">Ativos</TabsTrigger>
            <TabsTrigger value="resgatado">Resgatados</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
            <TabsTrigger value="Excluído">Excluídos</TabsTrigger>
          </TabsList>

          <TabsContent value="approved">
            <TabContent
              status="approved"
              statusLabel="Ativos"
              user={user}
              chartConfig={chartConfig}
              onViewOtherStatus={() => setActiveTab('resgatado')}
            />
          </TabsContent>
          <TabsContent value="resgatado">
            <TabContent
              status="resgatado"
              statusLabel="Resgatados"
              user={user}
              chartConfig={chartConfig}
              onViewOtherStatus={() => setActiveTab('approved')}
            />
          </TabsContent>
          <TabsContent value="cancelled">
            <TabContent
              status="cancelled"
              statusLabel="Cancelados"
              user={user}
              chartConfig={chartConfig}
              onViewOtherStatus={() => setActiveTab('approved')}
            />
          </TabsContent>
          <TabsContent value="Excluído">
            <TabContent
              status="Excluído"
              statusLabel="Excluídos"
              user={user}
              chartConfig={chartConfig}
              onViewOtherStatus={() => setActiveTab('approved')}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
export default InvestorDashboard
