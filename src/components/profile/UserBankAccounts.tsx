import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Loader2, Plus, Landmark, Copy, CheckCircle2, Trash2, Edit } from 'lucide-react'

export function UserBankAccounts({ userId }: { userId?: string }) {
  const { user } = useAuth()
  const targetUserId = userId || user?.id
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    bank_code: '',
    bank_name: '',
    branch: '',
    account_number: '',
    account_type: 'corrente',
    pix_key: '',
    owner_name: '',
    owner_document: '',
    notes: '',
  })

  const loadAccounts = async () => {
    if (!targetUserId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_bank_accounts' as any)
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true })
    if (data) setAccounts(data)
    setLoading(false)
  }

  useEffect(() => {
    loadAccounts()
  }, [targetUserId])

  const handleOpenNew = () => {
    if (accounts.length >= 3) return toast.error('Limite máximo de 3 contas atingido.')
    setEditId(null)
    setFormData({
      bank_code: '',
      bank_name: '',
      branch: '',
      account_number: '',
      account_type: 'corrente',
      pix_key: '',
      owner_name: '',
      owner_document: '',
      notes: '',
    })
    setOpen(true)
  }

  const handleOpenEdit = (acc: any) => {
    setEditId(acc.id)
    setFormData({
      bank_code: acc.bank_code || '',
      bank_name: acc.bank_name || '',
      branch: acc.branch || '',
      account_number: acc.account_number || '',
      account_type: acc.account_type || 'corrente',
      pix_key: acc.pix_key || '',
      owner_name: acc.owner_name || '',
      owner_document: acc.owner_document || '',
      notes: acc.notes || '',
    })
    setOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId) return
    setSaving(true)

    try {
      const payload = {
        user_id: targetUserId,
        ...formData,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const { error } = await supabase
          .from('user_bank_accounts' as any)
          .update(payload)
          .eq('id', editId)
        if (error) throw error
        toast.success('Conta atualizada com sucesso.')
      } else {
        const isFirst = accounts.length === 0
        const { error } = await supabase
          .from('user_bank_accounts' as any)
          .insert([{ ...payload, is_active: isFirst }])
        if (error) throw error
        toast.success('Conta cadastrada com sucesso.')
      }
      setOpen(false)
      loadAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('user_bank_accounts' as any)
      .delete()
      .eq('id', id)
    if (error) {
      toast.error('Erro ao remover conta.')
    } else {
      toast.success('Conta removida.')
      loadAccounts()
    }
  }

  const handleSetActive = async (id: string) => {
    const { error } = await supabase.rpc('set_active_user_bank_account', {
      p_account_id: id,
      p_user_id: targetUserId,
    })
    if (error) {
      toast.error('Erro ao definir conta ativa.')
    } else {
      toast.success('Conta definida como ativa.')
      loadAccounts()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência.')
  }

  if (loading)
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" /> Dados Bancários
        </h3>
        <Button onClick={handleOpenNew} disabled={accounts.length >= 3} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Conta
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Adicionar'} Conta Bancária</DialogTitle>
              <DialogDescription>
                Preencha os dados bancários para depósitos e liquidações.
              </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Código do Banco (COMPE) *</Label>
                <Input
                  type="number"
                  required
                  min="1"
                  max="999"
                  placeholder="Ex: 001, 104"
                  value={formData.bank_code}
                  onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Banco *</Label>
                <Input
                  required
                  placeholder="Ex: Banco do Brasil"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Conta *</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(v) => setFormData({ ...formData, account_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupança</SelectItem>
                    <SelectItem value="pix">Apenas PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  placeholder="CPF, Celular, E-mail..."
                  value={formData.pix_key}
                  onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                />
              </div>
              {formData.account_type !== 'pix' && (
                <>
                  <div className="space-y-2">
                    <Label>Agência *</Label>
                    <Input
                      required
                      placeholder="Ex: 0001"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta com Dígito *</Label>
                    <Input
                      required
                      placeholder="Ex: 12345-6"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label>Titular da Conta *</Label>
                <Input
                  required
                  placeholder="Nome completo ou Razão Social"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>CPF/CNPJ do Titular *</Label>
                <Input
                  required
                  placeholder="000.000.000-00"
                  value={formData.owner_document}
                  onChange={(e) => setFormData({ ...formData, owner_document: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Instruções adicionais..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Conta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {accounts.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 border border-dashed rounded-lg text-muted-foreground text-sm">
          Nenhuma conta bancária cadastrada.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card
              key={acc.id}
              className={`relative overflow-hidden ${acc.is_active ? 'border-primary/50 shadow-sm bg-primary/5' : ''}`}
            >
              {acc.is_active && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1 z-10">
                  <CheckCircle2 className="w-3 h-3" /> ATIVA
                </div>
              )}
              <CardContent className="p-4 space-y-3 pt-6">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {acc.bank_code} - {acc.bank_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {acc.account_type.replace('poupanca', 'poupança')}
                  </div>
                </div>

                <div className="text-sm space-y-1 bg-background/80 p-2 rounded-md font-mono border">
                  {acc.account_type !== 'pix' && (
                    <>
                      <div className="flex justify-between items-center group">
                        <span className="text-muted-foreground text-xs font-sans">Ag:</span>
                        <span>
                          {acc.branch}{' '}
                          <Copy
                            className="inline w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                            onClick={() => copyToClipboard(acc.branch)}
                          />
                        </span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-muted-foreground text-xs font-sans">Cc:</span>
                        <span>
                          {acc.account_number}{' '}
                          <Copy
                            className="inline w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                            onClick={() => copyToClipboard(acc.account_number)}
                          />
                        </span>
                      </div>
                    </>
                  )}
                  {acc.pix_key && (
                    <div className="flex justify-between items-center group pt-1 border-t mt-1">
                      <span className="text-muted-foreground text-xs font-sans">PIX:</span>
                      <span className="truncate max-w-[120px]" title={acc.pix_key}>
                        {acc.pix_key}{' '}
                        <Copy
                          className="inline w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                          onClick={() => copyToClipboard(acc.pix_key)}
                        />
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs space-y-0.5 pt-1">
                  <p className="font-medium truncate" title={acc.owner_name}>
                    {acc.owner_name}
                  </p>
                  <p className="text-muted-foreground">{acc.owner_document}</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  {!acc.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSetActive(acc.id)}
                    >
                      Tornar Ativa
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleOpenEdit(acc)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover conta bancária?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A conta será removida da sua lista de
                          opções.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(acc.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
