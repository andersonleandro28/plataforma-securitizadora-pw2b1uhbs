import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Check, X, Search, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function InvestmentsReview() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchInvestments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('investments')
      .select('*, profiles(full_name, document_number, email), investment_products(title)')
      .order('created_at', { ascending: false })

    if (data) setInvestments(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchInvestments()

    const channel = supabase
      .channel('admin-investments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () => {
        fetchInvestments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete') {
      if (
        !confirm(
          'Deseja realmente EXCLUIR este investimento?\nAção imediata e irreversível que refletirá no dashboard do investidor.',
        )
      )
        return
    } else if (action === 'reject') {
      if (!confirm('Deseja reprovar este investimento?')) return
    }

    setProcessingId(id)
    try {
      if (action === 'approve') {
        const { error } = await supabase.rpc('approve_investment', { p_investment_id: id })
        if (error) throw error
        toast.success('Investimento aprovado. Sincronizado com dashboards investidores.')
      } else if (action === 'reject') {
        const { error } = await supabase
          .from('investments')
          .update({ status: 'rejected' })
          .eq('id', id)
        if (error) throw error
        toast.success('Investimento reprovado. Dashboard do investidor atualizado.')
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('investments')
          .update({ status: 'cancelled' })
          .eq('id', id)
        if (error) throw error

        await supabase.from('audit_logs').insert({
          entity_type: 'investments',
          entity_id: id,
          action: 'admin_deleted_investment',
          user_id: user?.id,
          details: { message: `Investimento ${id} excluído/cancelado pelo Admin.` },
        })

        toast.success('Investimento excluído. Sincronizado com dashboards investidores.')
      }
      fetchInvestments()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar.')
    } finally {
      setProcessingId(null)
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const filtered = investments.filter(
    (inv) =>
      inv.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.profiles?.document_number?.includes(searchTerm) ||
      inv.investment_products?.title?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revisão de Investimentos</h1>
        <p className="text-muted-foreground">
          Gerencie aportes e comprovantes enviados pelos investidores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Aporte</CardTitle>
          <CardDescription>
            Qualquer alteração ou exclusão refletirá instantaneamente nos dashboards dos
            investidores afetados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por investidor, CPF ou produto..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investidor</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cotas</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum investimento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium">{inv.profiles?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.profiles?.document_number}
                        </div>
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={inv.investment_products?.title}
                      >
                        {inv.investment_products?.title}
                      </TableCell>
                      <TableCell>{inv.quotas}</TableCell>
                      <TableCell className="font-mono text-primary font-medium text-right">
                        {formatCurrency(inv.total_value)}
                      </TableCell>
                      <TableCell>
                        {inv.created_at ? format(new Date(inv.created_at), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {inv.status === 'approved' ? (
                          <Badge className="bg-emerald-500">Aprovado</Badge>
                        ) : inv.status === 'awaiting_review' ? (
                          <Badge className="bg-amber-500">Em Conferência</Badge>
                        ) : inv.status === 'rejected' ? (
                          <Badge variant="destructive">Reprovado</Badge>
                        ) : inv.status === 'cancelled' ? (
                          <Badge variant="secondary">Excluído/Cancelado</Badge>
                        ) : inv.status === 'resgatado' ? (
                          <Badge className="bg-blue-500">Resgatado</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {inv.status === 'awaiting_review' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8 px-2"
                              onClick={() => handleAction(inv.id, 'approve')}
                              disabled={!!processingId}
                              title="Aprovar Investimento"
                            >
                              {processingId === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-2"
                              onClick={() => handleAction(inv.id, 'reject')}
                              disabled={!!processingId}
                              title="Rejeitar Investimento"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleAction(inv.id, 'delete')}
                          disabled={!!processingId || inv.status === 'cancelled'}
                          title="Excluir investimento permanentemente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
