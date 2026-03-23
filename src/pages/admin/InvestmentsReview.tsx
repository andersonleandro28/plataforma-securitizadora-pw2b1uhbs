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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckSquare, Loader2, Eye, XCircle, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function InvestmentsReview() {
  const [investments, setInvestments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchInvestments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('investments')
      .select('*, profiles(full_name, email), investment_products(title)')
      .order('created_at', { ascending: false })
    if (data) setInvestments(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchInvestments()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.rpc('approve_investment', { p_investment_id: id })
      if (error) throw error
      toast.success('Investimento aprovado e cotas atualizadas.')
      fetchInvestments()
    } catch (err: any) {
      toast.error('Erro ao aprovar: ' + err.message)
    }
  }

  const handleReject = async () => {
    if (!rejectReason) return toast.error('Motivo obrigatório')
    try {
      await supabase
        .from('investments')
        .update({ status: 'rejected', rejection_reason: rejectReason })
        .eq('id', rejectId)
      toast.success('Investimento reprovado.')
      setRejectId(null)
      setRejectReason('')
      fetchInvestments()
    } catch (err: any) {
      toast.error('Erro ao reprovar: ' + err.message)
    }
  }

  const handleViewProof = async (invId: string) => {
    const { data: proofs } = await supabase
      .from('investment_proofs')
      .select('*')
      .eq('investment_id', invId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
    if (proofs && proofs.length > 0) {
      const { data } = await supabase.storage
        .from('investment-proofs')
        .createSignedUrl(proofs[0].file_path, 300)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } else {
      toast.error('Nenhum comprovante enviado.')
    }
  }

  const filtered = investments.filter(
    (i) =>
      i.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.investment_products?.title?.toLowerCase().includes(search.toLowerCase()),
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500">Aprovado</Badge>
      case 'awaiting_review':
        return <Badge className="bg-amber-500">Em Conferência</Badge>
      case 'rejected':
        return <Badge variant="destructive">Reprovado</Badge>
      default:
        return <Badge variant="outline">Aguardando Pagamento</Badge>
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aprovações de Aportes</h1>
        <p className="text-muted-foreground">
          Confira comprovantes e aprove cotas de investimentos.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center pb-4">
          <CardTitle>Fila de Análise</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar investidor ou produto..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investidor</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor Declarado</TableHead>
                <TableHead>Data Solicitação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.profiles?.full_name || inv.profiles?.email}
                    </TableCell>
                    <TableCell>
                      {inv.investment_products?.title} <br />
                      <span className="text-xs text-muted-foreground">{inv.quotas} cotas</span>
                    </TableCell>
                    <TableCell className="font-mono text-primary font-medium">
                      {formatCurrency(inv.transfer_value || inv.total_value)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {inv.created_at ? format(new Date(inv.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewProof(inv.id)}>
                        <Eye className="h-4 w-4 mr-1" /> Comprovante
                      </Button>
                      {inv.status === 'awaiting_review' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleApprove(inv.id)}
                          >
                            <CheckSquare className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRejectId(inv.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Comprovante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Motivo da Reprovação</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Valor incorreto, comprovante ilegível..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
