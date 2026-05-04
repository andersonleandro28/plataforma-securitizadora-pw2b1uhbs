import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, Clock, AlertCircle, AlertTriangle, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { BorrowerNewOperation } from './BorrowerNewOperation'
import { BorrowerOperationsList } from './BorrowerOperationsList'

export function BorrowerDashboard() {
  const { user, profile, activeRole, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [operations, setOperations] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  const fetchDashboardData = async () => {
    if (!user) return
    setLoading(true)
    setError(false)
    try {
      const { data, error: fetchErr } = await supabase
        .from('credit_operations')
        .select('*')
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setOperations(data || [])
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user && activeRole === 'borrower') {
      fetchDashboardData()

      const channel = supabase
        .channel('borrower_operations_dash')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'credit_operations',
            filter: `borrower_id=eq.${user.id}`,
          },
          (payload) => {
            const newStatus = payload.new.status
            const oldStatus = payload.old.status
            if (newStatus !== oldStatus) {
              toast.info(`Sua solicitação de recebível mudou para o status: ${newStatus}`)
              fetchDashboardData()
            }
          },
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else if (!authLoading && user && activeRole !== 'borrower') {
      setLoading(false)
    }
  }, [authLoading, user, activeRole])

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

  if (activeRole !== 'borrower') {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-fade-in">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar a área de tomador.
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
        <p className="text-muted-foreground">Ocorreu um erro ao buscar seus recebíveis.</p>
        <Button onClick={fetchDashboardData} variant="outline" size="lg" className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  const totalLimit = profile?.credit_limit || 100000
  const usedAmount = operations.reduce((acc, curr) => acc + (Number(curr.requested_value) || 0), 0)
  const availableBalance = Math.max(0, totalLimit - usedAmount)
  const pendingReceivables = operations.filter(
    (op) => !['pago', 'liquidado', 'cancelado', 'reprovado'].includes(op.status || ''),
  ).length

  let nextMaturity = '-'
  const maturities = operations
    .map((op) => new Date(op.due_date))
    .filter((d) => !isNaN(d.getTime()) && d > new Date())
    .sort((a, b) => a.getTime() - b.getTime())
  if (maturities.length > 0) {
    nextMaturity = formatDate(maturities[0].toISOString())
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard do Tomador</h1>
          <p className="text-muted-foreground">Gerencie seus recebíveis e limite de crédito.</p>
        </div>
        <Button onClick={() => setActiveTab('new_operation')} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Solicitação
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="new_operation">Nova Operação</TabsTrigger>
          <TabsTrigger value="operations">Minhas Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saldo Disponível
                </CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">
                  {formatCurrency(availableBalance)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recebíveis Pendentes
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{pendingReceivables}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Próximo Vencimento
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{nextMaturity}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Deseja antecipar um recebível?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Utilize nosso simulador dinâmico para prever taxas, impostos e o valor líquido que
                  cairá na sua conta de forma transparente.
                </p>
                <Button onClick={() => setActiveTab('new_operation')} className="w-full sm:w-auto">
                  Simular Agora
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-dashed shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Acompanhe suas solicitações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Veja o status das suas operações em tempo real, assine digitalmente seus aditivos
                  e acompanhe as liquidações.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('operations')}
                  className="w-full sm:w-auto"
                >
                  Ver Minhas Solicitações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="new_operation">
          <BorrowerNewOperation
            onSuccess={() => {
              setActiveTab('operations')
              fetchDashboardData()
            }}
          />
        </TabsContent>

        <TabsContent value="operations">
          <BorrowerOperationsList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
