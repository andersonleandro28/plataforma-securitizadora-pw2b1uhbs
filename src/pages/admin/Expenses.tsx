import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Plus, Receipt, Users, FileUp, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function Expenses() {
  const { activeRole } = useAuth()
  const isReadOnly = activeRole === 'accountant'

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  const [supplierOpen, setSupplierOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [supForm, setSupForm] = useState({
    company_name: '',
    document_number: '',
    contact_name: '',
    email: '',
    phone: '',
    category: '',
  })
  const [expForm, setExpForm] = useState({
    supplier_id: '',
    description: '',
    category: '',
    amount: '',
    due_date: '',
    status: 'pending',
  })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [supRes, expRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*, suppliers(company_name)')
        .order('created_at', { ascending: false }),
    ])
    if (supRes.data) setSuppliers(supRes.data)
    if (expRes.data) setExpenses(expRes.data)
    setLoading(false)
  }

  const handleSaveSupplier = async () => {
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert(supForm)
    if (error) toast.error(error.message)
    else {
      toast.success('Fornecedor cadastrado.')
      setSupplierOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleSaveExpense = async () => {
    setSaving(true)
    let filePath = null

    if (file) {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('operation-docs')
        .upload(`expenses/${fileName}`, file)
      if (error) {
        toast.error('Erro no upload: ' + error.message)
        setSaving(false)
        return
      }
      filePath = data.path
    }

    const payload = {
      ...expForm,
      amount: Number(expForm.amount),
      invoice_file_path: filePath,
    }

    const { error } = await supabase.from('expenses').insert(payload)
    if (error) toast.error(error.message)
    else {
      toast.success('Despesa cadastrada.')
      setExpenseOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleMarkPaid = async (id: string) => {
    if (isReadOnly) return
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
      .eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Despesa marcada como paga.')
      fetchData()
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Fornecedores e Despesas</h1>
        <p className="text-muted-foreground">
          Cadastre fornecedores e lance notas fiscais para o contas a pagar.
        </p>
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Despesas & NFs
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Fornecedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lançamentos (Contas a Pagar)</CardTitle>
              {!isReadOnly && (
                <Button onClick={() => setExpenseOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Despesa
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell>{e.suppliers?.company_name}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>{new Date(e.due_date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>R$ {Number(e.amount).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs ${e.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {e.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {e.status === 'pending' && !isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkPaid(e.id)}
                            className="text-emerald-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Baixar
                          </Button>
                        )}
                        {e.invoice_file_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/operation-docs/${e.invoice_file_path}`,
                                '_blank',
                              )
                            }
                          >
                            <FileUp className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma despesa lançada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fornecedores Homologados</CardTitle>
              {!isReadOnly && (
                <Button onClick={() => setSupplierOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.company_name}</TableCell>
                      <TableCell>{s.document_number}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell>{s.contact_name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                    </TableRow>
                  ))}
                  {suppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum fornecedor cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Razão Social</Label>
              <Input
                value={supForm.company_name}
                onChange={(e) => setSupForm({ ...supForm, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={supForm.document_number}
                onChange={(e) => setSupForm({ ...supForm, document_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria Principal</Label>
              <Input
                placeholder="Ex: Tecnologia, Jurídico..."
                value={supForm.category}
                onChange={(e) => setSupForm({ ...supForm, category: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={supForm.email}
                  onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={supForm.phone}
                  onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveSupplier} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Fornecedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar Despesa / NF</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select onValueChange={(v) => setExpForm({ ...expForm, supplier_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={expForm.category}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={expForm.due_date}
                  onChange={(e) => setExpForm({ ...expForm, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={expForm.status}
                  onValueChange={(v) => setExpForm({ ...expForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Anexar Nota Fiscal (PDF/XML)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveExpense} disabled={saving || !expForm.supplier_id}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Despesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
