import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { Loader2, CalendarDays, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function InvestmentsReview() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [investments, setInvestments] = useState<any[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [selectedInv, setSelectedInv] = useState<any>(null)
  const [datesForm, setDatesForm] = useState({ transfer_date: '' })

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('investments')
      .select('*, profiles(full_name, document_number), investment_products(title, rate)')
      .order('created_at', { ascending: false })

    if (data) setInvestments(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.rpc('approve_investment', { p_investment_id: id })
      if (error) throw error
      toast.success('Aporte aprovado.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleEditDates = (inv: any) => {
    setSelectedInv(inv)
    setDatesForm({
      transfer_date: inv.transfer_date || '',
    })
    setEditOpen(true)
  }

  const handleSaveDates = async () => {
    if (!selectedInv) return
    try {
      const { error } = await supabase
        .from('investments')
        .update({ transfer_date: datesForm.transfer_date || null })
        .eq('id', selectedInv.id)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        entity_type: 'investments',
        entity_id: selectedInv.id,
        action: 'admin_updated_dates',
        details: {
          admin_id: user?.id,
          old_transfer_date: selectedInv.transfer_date,
          new_transfer_date: datesForm.transfer_date,
        },
      })

      toast.success('Datas atualizadas (Migração/Ajuste).')
      setEditOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao atualizar datas: ' + err.message)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aprovação de Aportes</h1>
        <p className="text-muted-foreground">
          Analise os investimentos recebidos e ajuste datas cronológicas se necessário.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aportes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investidor</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data Transferência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investments.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="font-medium">{inv.profiles?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.profiles?.document_number}
                    </div>
                  </TableCell>
                  <TableCell>{inv.investment_products?.title}</TableCell>
                  <TableCell className="font-mono">
                    R$ {Number(inv.total_value).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {inv.transfer_date
                      ? new Date(inv.transfer_date).toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'approved' ? 'default' : 'outline'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {inv.status === 'awaiting_review' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleApprove(inv.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEditDates(inv)}>
                      <CalendarDays className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {investments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum aporte encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Data do Aporte (Migração)</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Data Efetiva de Transferência</Label>
              <Input
                type="date"
                value={datesForm.transfer_date}
                onChange={(e) => setDatesForm({ ...datesForm, transfer_date: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Essa data impacta o cálculo de rendimento para o investidor.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDates}>Salvar Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
