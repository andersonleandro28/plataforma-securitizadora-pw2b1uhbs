import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, Activity, ArrowRight, FileText } from 'lucide-react'
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
  type InvestmentWithProduct,
} from '@/lib/yield-calculator'

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

function InvestmentList({ data }: { data: any[] }) {
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
      {data.map((inv) => (
        <Card key={inv.id} className="transition-all hover:border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base text-primary">
                  {inv.investment_products?.title || 'Produto Desconhecido'}
                </CardTitle>
                <CardDescription className="mt-1">
                  Operação registrada em: {formatDate(inv.created_at)}
                </CardDescription>
              </div>
              {getStatusBadge(inv.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/10 p-3 rounded-md">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Valor Total
                </p>
                <p className="font-semibold text-foreground">{formatCurrency(inv.total_value)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cotas</p>
                <p className="font-semibold text-foreground">{inv.quotas} cota(s)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Taxa / Alvo
                </p>
                <p className="font-semibold text-emerald-600">
                  {inv.investment_products?.rate || '-'}
                </p>
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
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function InvestorDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const [investments, setInvestments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('investments_view')
          .select('*, investment_products(id, title, type, rate, term, quota_value)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        setInvestments(data || [])
      } catch (err) {
        console.error('Error fetching investor data:', err)
        toast.error('Erro ao carregar dados de investimento.')
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchData()
    }
  }, [user, authLoading])

  const walletBalance = profile?.wallet_balance || 0

  const activeInvestments = investments.filter(
    (inv) => inv.status === 'approved' || inv.status === 'pending_transfer',
  )
  const redeemedInvestments = investments.filter((inv) => inv.status === 'resgatado')
  const cancelledInvestments = investments.filter(
    (inv) => inv.status === 'Excluído' || inv.status === 'cancelled',
  )

  const totalInvestedValue = activeInvestments
    .filter((inv) => inv.status === 'approved')
    .reduce((acc, inv) => acc + (inv.total_value || 0), 0)

  const totalBalance = walletBalance + totalInvestedValue

  const accumulatedYield = useMemo(
    () => calculateTotalAccruedYield(activeInvestments as InvestmentWithProduct[]),
    [activeInvestments],
  )

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
    return generateYieldChartData(filteredInvs as InvestmentWithProduct[])
  }, [activeInvestments, selectedProduct])

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
          <h2 className="text-xl font-bold tracking-tight">Meus Investimentos</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas cotas e subscrições.</p>
        </div>

        <Tabs defaultValue="ativos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="resgatados">Resgatados</TabsTrigger>
            <TabsTrigger value="cancelados">Cancelados</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="ativos" className="m-0">
              <InvestmentList data={activeInvestments} />
            </TabsContent>

            <TabsContent value="resgatados" className="m-0">
              <InvestmentList data={redeemedInvestments} />
            </TabsContent>

            <TabsContent value="cancelados" className="m-0">
              <InvestmentList data={cancelledInvestments} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
