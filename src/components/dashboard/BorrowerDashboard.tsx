import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, Clock, AlertCircle, FileText, AlertTriangle, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/lib/utils'

export function BorrowerDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [operations, setOperations] = useState<any[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ valor: '', data_vencimento: '', descricao: '' })
  const [submitting, setSubmitting] = useState(false)

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
    if (!authLoading && user && profile?.role === 'borrower') {
      fetchDashboardData()
    } else if (!authLoading && user && profile?.role !== 'borrower') {
      setLoading(false)
    }
  }, [authLoading, user, profile])

  const handleSolicitar = async () => {
    if (!formData.valor || !formData.data_vencimento) return
    setSubmitting(true)
    try {
      const { error: insertErr } = await supabase.from('credit_operations').insert({
        borrower_id: user?.id,
        receivable_type: 'outro',
        requested_value: Number(formData.valor),
        face_value: Number(formData.valor),
        due_date: formData.data_vencimento,
        observations: formData.descricao,
        status: 'enviado',
        cedente: profile?.full_name || 'N/A',
        sacado: 'Não informado',
        document_number: 'S/N',
        issue_date: new Date().toISOString().split('T')[0],
      })
      if (insertErr) throw insertErr
      setIsModalOpen(false)
      setFormData({ valor: '', data_vencimento: '', descricao: '' })
      fetchDashboardData()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

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

  if (profile?.role !== 'borrower') {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-4 animate-fade-in"></div>
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
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Solicitar Recebível
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Disponível
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{formatCurrency(availableBalance)}</div>
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

      <Card>
        <CardHeader>
          <CardTitle>Meus Recebíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Vencimento</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p>Nenhum recebível</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono font-medium">
                      {formatCurrency(op.requested_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {op.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(op.due_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Recebível</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 5000"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes do recebível..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSolicitar}
              disabled={submitting || !formData.valor || !formData.data_vencimento}
            >
              {submitting ? 'Enviando...' : 'Confirmar Solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default BorrowerDashboard
