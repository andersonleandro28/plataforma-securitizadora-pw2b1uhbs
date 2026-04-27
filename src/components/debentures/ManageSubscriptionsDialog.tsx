import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Edit2, Save, X, Plus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, toISODate } from '@/lib/utils'

interface ManageSubscriptionsDialogProps {
  series: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
}

export function ManageSubscriptionsDialog({
  series,
  open,
  onOpenChange,
  onSuccess,
}: ManageSubscriptionsDialogProps) {
  const { user } = useAuth()
  const [subs, setSubs] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos')

  useEffect(() => {
    if (series) {
      setSubs(series.debenture_subscriptions || [])
    } else {
      setSubs([])
    }
  }, [series])

  const startEdit = (sub: any) => {
    setEditingId(sub.id)
    setEditForm({
      ...sub,
      // Garante que a data seja tratada diretamente como YYYY-MM-DD
      subscription_date: toISODate(sub.subscription_date),
    })
    setAddingNew(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setAddingNew(false)
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      const payload = {
        investor_name: editForm.investor_name,
        document_number: editForm.document_number,
        quantity: Number(editForm.quantity),
        unit_price: Number(editForm.unit_price),
        total_amount: Number(editForm.quantity) * Number(editForm.unit_price),
        // Envia apenas a data em formato YYYY-MM-DD restrito
        subscription_date: editForm.subscription_date || null,
      }

      if (addingNew) {
        const { error } = await supabase.from('debenture_subscriptions').insert({
          ...payload,
          series_id: series.id,
          status: 'Ativo',
        })
        if (error) throw error
        toast.success('Subscrição adicionada e sincronizada com os dashboards dos investidores.')
      } else {
        const { error } = await supabase
          .from('debenture_subscriptions')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error

        // Se estiver atrelado a um investimento, também sincroniza dados base
        const currentSub = subs.find((s) => s.id === editingId)
        if (currentSub?.investment_id) {
          await supabase
            .from('investments')
            .update({
              quotas: payload.quantity,
              unit_price: payload.unit_price,
              total_value: payload.total_amount,
              transfer_date: payload.subscription_date,
            })
            .eq('id', currentSub.investment_id)
        }

        toast.success('Sincronizado com dashboards investidores.')
      }
      setEditingId(null)
      setAddingNew(false)

      // Aguarda o sucesso (refetch no pai) para ter os dados atualizados
      await onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir de 'Ativos'? Impacta dashboard investidor imediatamente.")) return
    try {
      setLoading(true)

      const subToDelete = subs.find((s) => s.id === id)

      if (subToDelete?.investment_id) {
        const { error } = await supabase.rpc('cancel_investment', {
          p_investment_id: subToDelete.investment_id,
          p_admin_id: user?.id,
        } as any)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('debenture_subscriptions')
          .update({
            status: 'Excluído',
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id,
          })
          .eq('id', id)

        if (error) throw error
      }

      if (subToDelete) {
        await supabase.from('audit_logs').insert({
          entity_type: 'debenture_subscriptions',
          entity_id: id,
          action: 'subscription_soft_deleted',
          user_id: user?.id,
          details: {
            message: `Investimento ID ${id} marcado Excluído por Admin ${user?.id} em ${new Date().toISOString()}`,
            sub: {
              ...subToDelete,
              debenture_series: {
                series_number: series.series_number,
                debentures: { issuer_name: series.issuer_name },
              },
            },
          },
        })
      }

      toast.success('Sincronizado com dashboards investidores.')
      await onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }
  const startAdd = () => {
    setActiveTab('ativos')
    setAddingNew(true)
    setEditingId('new')

    // Configura a data inicial para hoje no formato exato YYYY-MM-DD
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')

    setEditForm({
      investor_name: '',
      document_number: '',
      quantity: 1,
      unit_price: 1000,
      subscription_date: `${yyyy}-${mm}-${dd}`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b bg-muted/5">
          <DialogTitle>Gerenciar Subscrições</DialogTitle>
          <DialogDescription>
            Série {series?.series_number} • {series?.indexer} • Volume Restante para Captação pode
            ser ajustado com a inserção de registros abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-between items-center bg-muted/20 p-4 rounded-md border">
            <div>
              <p className="text-xs text-muted-foreground">Volume da Série</p>
              <p className="font-mono font-medium">
                R$ {Number(series?.volume || 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Subscrito Ativo</p>
              <p className="font-mono font-medium text-primary">
                R${' '}
                {subs
                  .filter((s: any) => s.status === 'Ativo' || !s.status)
                  .reduce((sum, s) => sum + Number(s.total_amount), 0)
                  .toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className="w-[400px]"
            >
              <TabsList>
                <TabsTrigger value="ativos">Ativos</TabsTrigger>
                <TabsTrigger value="historico">Histórico / Encerrados</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              onClick={startAdd}
              disabled={!!editingId || addingNew || loading || activeTab !== 'ativos'}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Nova Subscrição
            </Button>
          </div>

          <div className="border rounded-md relative mt-2">
            {loading && (
              <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Investidor</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead className="text-right w-20">Qtd</TableHead>
                  <TableHead className="text-right w-28">PU (R$)</TableHead>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead className="w-[100px] text-right">
                    {activeTab === 'ativos' ? 'Ações' : 'Status'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addingNew && activeTab === 'ativos' && (
                  <TableRow className="bg-muted/20">
                    <TableCell className="p-2">
                      <Input
                        className="h-8 text-xs"
                        value={editForm.investor_name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, investor_name: e.target.value })
                        }
                        placeholder="Nome do Investidor"
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        className="h-8 text-xs font-mono"
                        value={editForm.document_number}
                        onChange={(e) =>
                          setEditForm({ ...editForm, document_number: e.target.value })
                        }
                        placeholder="000.000.000-00"
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        className="h-8 text-xs text-right"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        className="h-8 text-xs text-right font-mono"
                        value={editForm.unit_price}
                        onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="date"
                        className="h-8 text-xs w-full"
                        value={editForm.subscription_date}
                        onChange={(e) =>
                          setEditForm({ ...editForm, subscription_date: e.target.value })
                        }
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="p-2 text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary bg-primary/10"
                        onClick={handleSave}
                        disabled={loading}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={cancelEdit}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )}

                {subs.filter((s: any) => {
                  if (s.status === 'Excluído') return false
                  if (activeTab === 'ativos') return s.status === 'Ativo' || !s.status
                  return s.status === 'Encerrado' || s.status === 'Resgatado'
                }).length === 0 &&
                  !addingNew && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                        {activeTab === 'ativos'
                          ? 'Nenhuma subscrição ativa registrada.'
                          : 'Nenhum histórico de resgate.'}
                      </TableCell>
                    </TableRow>
                  )}

                {subs
                  .filter((s: any) => {
                    if (s.status === 'Excluído') return false
                    if (activeTab === 'ativos') return s.status === 'Ativo' || !s.status
                    return s.status === 'Encerrado' || s.status === 'Resgatado'
                  })
                  .map((sub: any) =>
                    editingId === sub.id && activeTab === 'ativos' ? (
                      <TableRow key={sub.id} className="bg-muted/20">
                        <TableCell className="p-2">
                          <Input
                            className="h-8 text-xs"
                            value={editForm.investor_name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, investor_name: e.target.value })
                            }
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            className="h-8 text-xs font-mono"
                            value={editForm.document_number || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, document_number: e.target.value })
                            }
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right font-mono"
                            value={editForm.unit_price}
                            onChange={(e) =>
                              setEditForm({ ...editForm, unit_price: e.target.value })
                            }
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="date"
                            className="h-8 text-xs w-full"
                            value={editForm.subscription_date || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, subscription_date: e.target.value })
                            }
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary bg-primary/10"
                            onClick={handleSave}
                            disabled={loading}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={cancelEdit}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium text-xs">{sub.investor_name}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {sub.document_number || '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs">{sub.quantity}</TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          R$ {Number(sub.unit_price).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(sub.subscription_date)}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {activeTab === 'ativos' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => startEdit(sub)}
                                disabled={!!editingId || loading}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(sub.id)}
                                disabled={!!editingId || loading}
                                title="Excluir investimento (ação imediata)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded">
                              {sub.status}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
