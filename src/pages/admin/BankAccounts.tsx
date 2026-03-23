import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Landmark, Loader2, Plus, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function BankAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    id: '',
    bank_code: '',
    bank_name: '',
    branch: '',
    account_number: '',
    pix_key: '',
    owner_name: '',
    owner_document: '',
    notes: '',
  })

  const fetchAccounts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setAccounts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...formData, updated_by: user?.id, updated_at: new Date().toISOString() }
      if (formData.id) {
        await supabase
          .from('company_bank_accounts')
          .update(payload as any)
          .eq('id', formData.id)
      } else {
        await supabase.from('company_bank_accounts').insert({ ...payload, id: undefined } as any)
      }
      toast.success('Conta bancária salva com sucesso.')
      setOpen(false)
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      await supabase.rpc('set_active_bank_account', { p_account_id: id })
      toast.success('Conta ativada com sucesso.')
      fetchAccounts()
    } catch {
      toast.error('Erro ao ativar conta.')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dados Bancários</h1>
          <p className="text-muted-foreground">
            Gerencie as contas para depósito da Securitizadora.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData({
              id: '',
              bank_code: '',
              bank_name: '',
              branch: '',
              account_number: '',
              pix_key: '',
              owner_name: '',
              owner_document: '',
              notes: '',
            })
            setOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" /> Contas Cadastradas
          </CardTitle>
          <CardDescription>
            Apenas uma conta pode ficar ativa para receber os depósitos dos investidores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Agência / Conta</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Titularidade</TableHead>
                <TableHead className="text-center">Status</TableHead>
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
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">
                      {acc.bank_code && (
                        <span className="text-muted-foreground mr-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {String(acc.bank_code).padStart(3, '0')}
                        </span>
                      )}
                      {acc.bank_name}
                    </TableCell>
                    <TableCell>
                      {acc.branch} / {acc.account_number}
                    </TableCell>
                    <TableCell>{acc.pix_key || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{acc.owner_name}</div>
                      <div className="text-xs text-muted-foreground">{acc.owner_document}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {acc.is_active ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!acc.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => handleSetActive(acc.id)}>
                          Tornar Ativa
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({
                            ...acc,
                            bank_code: acc.bank_code || '',
                          })
                          setOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{formData.id ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label>Código do Banco (COMPE/FEBRABAN)</Label>
                <Input
                  required
                  type="number"
                  min="1"
                  max="999"
                  placeholder="Ex: 001 (BB), 104 (Caixa), 547 (BNK Digital)"
                  value={formData.bank_code}
                  onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Instituição Financeira (Banco)</Label>
                <Input
                  required
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Conta Corrente</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pix_key}
                  onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Nome do Titular</Label>
                <Input
                  required
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>CNPJ/CPF do Titular</Label>
                <Input
                  required
                  value={formData.owner_document}
                  onChange={(e) => setFormData({ ...formData, owner_document: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observações de Transferência</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Transferências apenas via TED ou PIX"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
