import { useEffect, useState, useCallback } from 'react'
import { Wallet, TrendingUp, PieChart, AlertCircle, AlertTriangle } from 'lucide-react'
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
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function InvestorDashboard() {
  const { profile, user, activeRole, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [myInvestments, setMyInvestments] = useState<any[]>([])

  const fetchDashboardData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(false)
    try {
      const { data, error: fetchErr } = await supabase
        .from('investments')
        .select('*, investment_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setMyInvestments(data || [])
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user && activeRole === 'investor') {
      fetchDashboardData()
    } else if (!authLoading && user && activeRole !== 'investor') {
      setLoading(false)
    }
  }, [authLoading, user, activeRole, fetchDashboardData])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  if (authLoading || loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6 animate-fade-in">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (activeRole !== 'investor') {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-fade-in">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar a área de investidor.
        </p>
        <Button onClick={() => (window.location.href = '/')} size="lg" className="mt-4">
          Voltar
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-fade-in">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-3xl font-bold">Erro ao carregar</h2>
        <p className="text-muted-foreground">Ocorreu um erro ao buscar seus investimentos.</p>
        <Button onClick={fetchDashboardData} variant="outline" size="lg" className="mt-4">
          Tentar Novamente
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
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-fade-in-up pb-10">
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

      <Card>
        <CardHeader>
          <CardTitle>Meus Investimentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Rendimento Est.</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myInvestments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Wallet className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p>Nenhum investimento</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                myInvestments.map((inv) => {
                  const amount = Number(inv.total_value) || 0
                  const rateStr = inv.investment_products?.rate || '0'
                  const rateMatch = rateStr.match(/(\d+[.,]\d+|\d+)/)
                  const rate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) / 100 : 0.01
                  const estYield = amount * rate

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.investment_products?.title || 'Produto Desconhecido'}
                      </TableCell>
                      <TableCell className="font-mono text-primary">
                        {formatCurrency(amount)}
                      </TableCell>
                      <TableCell className="font-mono text-emerald-600">
                        +{formatCurrency(estYield)}
                      </TableCell>
                      <TableCell>{formatDate(inv.transfer_date || inv.created_at)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
export default InvestorDashboard
