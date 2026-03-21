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
import { format } from 'date-fns'

interface ManageSubscriptionsDialogProps {
  series: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ManageSubscriptionsDialog({
  series,
  open,
  onOpenChange,
  onSuccess,
}: ManageSubscriptionsDialogProps) {
  const [subs, setSubs] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  useEffect(() => {
    if (series) {
      setSubs(series.debenture_subscriptions || [])
    } else {
      setSubs([])
    }
  }, [series])

  const startEdit = (sub: any) => {
    setEditingId(sub.id)
    setEditForm({ ...sub })
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
        subscription_date: editForm.subscription_date || null,
      }

      if (addingNew) {
        const { error } = await supabase.from('debenture_subscriptions').insert({
          ...payload,
          series_id: series.id,
        })
        if (error) throw error
        toast.success('Subscrição adicionada com sucesso!')
      } else {
        const { error } = await supabase
          .from('debenture_subscriptions')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Subscrição atualizada com sucesso!')
      }

      setEditingId(null)
      setAddingNew(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta subscrição?')) return
    try {
      setLoading(true)
      const { error } = await supabase.from('debenture_subscriptions').delete().eq('id', id)
      if (error) throw error
      toast.success('Subscrição removida.')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startAdd = () => {
    setAddingNew(true)
    setEditingId('new')
    setEditForm({
      investor_name: '',
      document_number: '',
      quantity: 1,
      unit_price: 1000,
      subscription_date: new Date().toISOString().split('T')[0],
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
              <p className="text-xs text-muted-foreground">Total Subscrito Atual</p>
              <p className="font-mono font-medium text-primary">
                R${' '}
                {subs.reduce((sum, s) => sum + Number(s.total_amount), 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button
              size="sm"
              onClick={startAdd}
              disabled={!!editingId || addingNew}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Nova Subscrição
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Investidor</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead className="text-right w-20">Qtd</TableHead>
                  <TableHead className="text-right w-28">PU (R$)</TableHead>
                  <TableHead className="w-32">Data</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addingNew && (
                  <TableRow className="bg-muted/20">
                    <TableCell className="p-2">
                      <Input
                        className="h-8 text-xs"
                        value={editForm.investor_name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, investor_name: e.target.value })
                        }
                        placeholder="Nome do Investidor"
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
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        className="h-8 text-xs text-right"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        className="h-8 text-xs text-right font-mono"
                        value={editForm.unit_price}
                        onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={editForm.subscription_date}
                        onChange={(e) =>
                          setEditForm({ ...editForm, subscription_date: e.target.value })
                        }
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

                {subs.length === 0 && !addingNew && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      Nenhuma subscrição registrada para esta série.
                    </TableCell>
                  </TableRow>
                )}

                {subs.map((sub) =>
                  editingId === sub.id ? (
                    <TableRow key={sub.id} className="bg-muted/20">
                      <TableCell className="p-2">
                        <Input
                          className="h-8 text-xs"
                          value={editForm.investor_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, investor_name: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          className="h-8 text-xs font-mono"
                          value={editForm.document_number || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, document_number: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          className="h-8 text-xs text-right"
                          value={editForm.quantity}
                          onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          className="h-8 text-xs text-right font-mono"
                          value={editForm.unit_price}
                          onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={editForm.subscription_date || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, subscription_date: e.target.value })
                          }
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
                        {sub.subscription_date
                          ? format(new Date(sub.subscription_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => startEdit(sub)}
                          disabled={!!editingId}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(sub.id)}
                          disabled={!!editingId}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
