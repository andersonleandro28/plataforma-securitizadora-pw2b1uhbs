import { useState, useEffect } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Upload, FileText, List, CheckCircle } from 'lucide-react'
import { formatDate, toISODate } from '@/lib/utils'

export default function CcbPurchases() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState<any[]>([])
  const [ccbs, setCcbs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [installmentsOpen, setInstallmentsOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)

  const [liquidationOpen, setLiquidationOpen] = useState(false)
  const [liquidationForm, setLiquidationForm] = useState({
    idx: -1,
    payment_date: '',
    interest: '',
    penalty: '',
  })

  const [form, setForm] = useState({
    ccb_id: '',
    acquisition_value: '',
    boleto_count: '',
    boleto_unit_value: '',
    created_at: '',
    ccb_created_at: '',
  })
  const [boletos, setBoletos] = useState<any[]>([])

  const fetchPurchases = async () => {
    setLoading(true)

    const { data: p, error: errP } = await supabase
      .from('recebiveis_ccb')
      .select(`
        *,
        ccb_solicitacoes (
          *,
          profiles!ccb_solicitacoes_user_id_fkey (*)
        )
      `)
      .order('created_at', { ascending: false })

    if (errP) {
      console.error('Erro ao buscar recebíveis:', errP)
      toast.error('Erro ao buscar operações: ' + errP.message)
    }

    const { data: cRaw, error: errC } = await supabase
      .from('ccb_solicitacoes')
      .select(`
        *,
        profiles!ccb_solicitacoes_user_id_fkey (*)
      `)
      .order('created_at', { ascending: false })

    if (errC) {
      console.error('Erro ao buscar solicitações:', errC)
      toast.error('Erro ao carregar lista de tomadores: ' + errC.message)
    }

    // Filtro case-insensitive para os status
    const allowedStatuses = [
      'aprovado',
      'aprovada',
      'aceite_tomador',
      'aguardando_formalizacao',
      'formalizado',
      'aguardando_liquidacao',
      'liquidado',
      'aprovada_bdigital',
      'comprada_bdigital',
      'ativa',
    ]

    const c = (cRaw || []).filter((item) => {
      const statusLower = String(item.status || '').toLowerCase()
      return (
        allowedStatuses.includes(statusLower) ||
        statusLower.includes('aprovad') ||
        statusLower.includes('aceite')
      )
    })

    setPurchases(p || [])
    setCcbs(c || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  useEffect(() => {
    if (!editingId && open) {
      const count = Number(form.boleto_count) || 0
      const val = Number(form.boleto_unit_value) || 0
      if (count > 0 && val > 0) {
        setBoletos(
          Array.from({ length: count }).map((_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() + i + 1)
            return { due_date: d.toISOString().split('T')[0], unit_value: val, status: 'Pendente' }
          }),
        )
      } else {
        setBoletos([])
      }
    }
  }, [form.boleto_count, form.boleto_unit_value, editingId, open])

  const calculateMetrics = () => {
    const acq = Number(form.acquisition_value) || 0
    const count = Number(form.boleto_count) || 0
    const val = Number(form.boleto_unit_value) || 0
    const total = count * val
    return {
      acq,
      total,
      profit: total - acq,
      tir: acq > 0 ? ((total - acq) / acq) * 100 : 0,
      prov: total * 0.03,
    }
  }

  const handleSubmit = async () => {
    if (!form.ccb_id || !form.acquisition_value || !form.boleto_count || !form.boleto_unit_value) {
      return toast.error('Preencha todos os campos')
    }

    const selectedCcb = ccbs.find((c) => c.id === form.ccb_id)
    const tomador_id = selectedCcb?.user_id

    const { acq, profit, tir, prov } = calculateMetrics()
    const payload: any = {
      ccb_id: form.ccb_id,
      tomador_id: tomador_id,
      acquisition_value: acq,
      boleto_count: Number(form.boleto_count),
      boleto_unit_value: Number(form.boleto_unit_value),
      gross_profit: profit,
      tir_effective: tir,
      provision_amount: prov,
      boletos,
      status: 'Ativo',
      ...(form.created_at && { created_at: new Date(form.created_at).toISOString() }),
    }

    if (editingId) {
      const { error } = await supabase.from('recebiveis_ccb').update(payload).eq('id', editingId)
      if (error) return toast.error('Erro: ' + error.message)
      await supabase.from('audit_logs').insert({
        entity_type: 'recebiveis_ccb',
        entity_id: editingId,
        action: 'admin_edited_purchase',
        details: { admin: user?.id },
      })
      toast.success('Editado com sucesso!')
    } else {
      const { error } = await supabase.from('recebiveis_ccb').insert(payload)
      if (error) return toast.error('Erro: ' + error.message)
      await supabase
        .from('ccb_solicitacoes')
        .update({ status: 'comprada_bdigital' })
        .eq('id', form.ccb_id)
      toast.success('Compra registrada com sucesso!')
    }

    if (form.ccb_created_at && form.ccb_id) {
      await supabase
        .from('ccb_solicitacoes')
        .update({ created_at: new Date(form.ccb_created_at).toISOString() })
        .eq('id', form.ccb_id)
    }

    setOpen(false)
    fetchPurchases()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta operação? As parcelas sumirão para o cliente.'))
      return
    await supabase.from('recebiveis_ccb').delete().eq('id', id)
    await supabase.from('audit_logs').insert({
      entity_type: 'recebiveis_ccb',
      entity_id: id,
      action: 'admin_deleted_purchase',
      details: { admin: user?.id },
    })
    toast.success('Excluído')
    fetchPurchases()
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ccb_id: '',
      acquisition_value: '',
      boleto_count: '',
      boleto_unit_value: '',
      created_at: new Date().toISOString().split('T')[0],
      ccb_created_at: new Date().toISOString().split('T')[0],
    })
    setBoletos([])
    setOpen(true)
  }

  const openEdit = (p: any) => {
    setEditingId(p.id)
    setForm({
      ccb_id: p.ccb_id,
      acquisition_value: String(p.acquisition_value),
      boleto_count: String(p.boleto_count),
      boleto_unit_value: String(p.boleto_unit_value),
      created_at: toISODate(p.created_at),
      ccb_created_at: toISODate(p.ccb_solicitacoes?.created_at),
    })
    setBoletos(p.boletos || [])
    setOpen(true)
  }

  const openInstallments = (p: any) => {
    setSelectedPurchase(p)
    setInstallmentsOpen(true)
  }

  const handleBoletoChange = (idx: number, field: string, val: any) => {
    const newB = [...boletos]
    newB[idx] = { ...newB[idx], [field]: val }
    setBoletos(newB)
  }

  const handleUploadBoleto = async (idx: number, e: any) => {
    const file = e.target.files[0]
    if (!file) return
    const toastId = toast.loading('Enviando...')
    const filePath = `boletos/${editingId || 'novo'}/${idx}_${Date.now()}.pdf`
    const { error } = await supabase.storage
      .from('boletos_ccb')
      .upload(filePath, file, { upsert: true })
    if (error) {
      toast.dismiss(toastId)
      return toast.error(`Erro no upload: ${error.message}`)
    }
    const { data } = supabase.storage.from('boletos_ccb').getPublicUrl(filePath)
    handleBoletoChange(idx, 'file_url', data.publicUrl)
    toast.dismiss(toastId)
    toast.success('Anexado com sucesso!')
  }

  const handleViewPdf = async (url: string, e: any) => {
    e.preventDefault()
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (!res.ok) {
        toast.error('Documento não encontrado (Bucket ou Arquivo inexistente).')
        return
      }
      window.open(url, '_blank')
    } catch (err) {
      window.open(url, '_blank')
    }
  }

  const totalAdquisitions = purchases.reduce((acc, p) => acc + Number(p.acquisition_value || 0), 0)
  const totalReceivable = purchases.reduce(
    (acc, p) => acc + Number(p.boleto_count || 0) * Number(p.boleto_unit_value || 0),
    0,
  )
  const totalProfit = purchases.reduce((acc, p) => acc + Number(p.gross_profit || 0), 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras CCB BDIGITAL</h1>
          <p className="text-muted-foreground">
            Gestão de aquisição de recebíveis, com isolamento contábil e edição retroativa.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar Compra
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Aquisições
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalAdquisitions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Bruto Projetado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Data Aquisição</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Boletos</TableHead>
                <TableHead>Lucro Bruto</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4">{formatDate(p.created_at)}</TableCell>
                  <TableCell className="font-medium">
                    {p.ccb_solicitacoes?.profiles?.full_name ||
                      p.ccb_solicitacoes?.profiles?.pj_company_name ||
                      'Desconhecido'}
                  </TableCell>
                  <TableCell>
                    {p.boleto_count}x R$ {p.boleto_unit_value}
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium">
                    + R$ {Number(p.gross_profit).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right pr-4 space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openInstallments(p)}
                      title="Ver Parcelas"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(p)}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {purchases.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma compra registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Compra e Parcelas' : 'Registrar Compra de Recebíveis'}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="dados" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
              <TabsTrigger value="cronograma">Cronograma & Docs</TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Simulação CCB (Lookup)</Label>
                <Select
                  value={form.ccb_id}
                  onValueChange={(v) => setForm({ ...form, ccb_id: v })}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a operação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ccbs.map((c) => {
                      const tomadorName = c.profiles?.full_name || c.profiles?.pj_company_name
                      const displayName = tomadorName ? tomadorName : `Tomador ID: ${c.user_id}`
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {displayName} - R${' '}
                          {Number(c.requested_value).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          ({String(c.status).replace(/_/g, ' ').toUpperCase()})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Aquisição</Label>
                  <Input
                    type="date"
                    value={form.created_at}
                    onChange={(e) => setForm({ ...form, created_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Emissão CCB</Label>
                  <Input
                    type="date"
                    value={form.ccb_created_at}
                    onChange={(e) => setForm({ ...form, ccb_created_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Aquisição (R$)</Label>
                  <Input
                    type="number"
                    value={form.acquisition_value}
                    onChange={(e) => setForm({ ...form, acquisition_value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Boletos</Label>
                  <Input
                    type="number"
                    value={form.boleto_count}
                    onChange={(e) => setForm({ ...form, boleto_count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Unit. Boleto</Label>
                  <Input
                    type="number"
                    value={form.boleto_unit_value}
                    onChange={(e) => setForm({ ...form, boleto_unit_value: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="cronograma" className="pt-4 max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletos.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={b.due_date}
                          onChange={(e) => handleBoletoChange(i, 'due_date', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={b.unit_value}
                          onChange={(e) =>
                            handleBoletoChange(i, 'unit_value', Number(e.target.value))
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {b.file_url ? (
                            <a
                              href={b.file_url}
                              onClick={(e) => handleViewPdf(b.file_url, e)}
                              className="text-primary hover:underline text-xs flex items-center cursor-pointer"
                            >
                              <FileText className="w-3 h-3 mr-1" /> Ver PDF
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem anexo</span>
                          )}
                          <Label className="cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2 py-1 rounded text-xs whitespace-nowrap">
                            <Upload className="w-3 h-3 inline mr-1" /> Enviar
                            <Input
                              type="file"
                              className="hidden"
                              accept=".pdf"
                              onChange={(e) => handleUploadBoleto(i, e)}
                            />
                          </Label>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Parcelas */}
      <Dialog open={installmentsOpen} onOpenChange={setInstallmentsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Parcelas - CCB #{selectedPurchase?.ccb_id?.substring(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor Nominal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPurchase?.boletos?.map((b: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{formatDate(b.due_date)}</TableCell>
                    <TableCell>
                      R${' '}
                      {Number(b.unit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {b.status === 'Pago' ? (
                        <span className="text-emerald-600 font-medium text-sm flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium text-sm">
                          {b.status || 'Pendente'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.status !== 'Pago' && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setLiquidationForm({
                              idx: i,
                              payment_date: new Date().toISOString().split('T')[0],
                              interest: '',
                              penalty: '',
                            })
                            setLiquidationOpen(true)
                          }}
                        >
                          Dar Baixa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dar Baixa */}
      <Dialog open={liquidationOpen} onOpenChange={setLiquidationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liquidar Parcela {liquidationForm.idx + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted p-3 rounded text-sm flex justify-between">
              <span>Valor Nominal:</span>
              <span className="font-bold">
                R${' '}
                {Number(
                  selectedPurchase?.boletos?.[liquidationForm.idx]?.unit_value || 0,
                ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={liquidationForm.payment_date}
                onChange={(e) =>
                  setLiquidationForm({ ...liquidationForm, payment_date: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Juros Cobrados (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={liquidationForm.interest}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, interest: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Multa Cobrada (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={liquidationForm.penalty}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, penalty: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="pt-2 border-t flex justify-between items-center text-lg font-bold">
              <span>Total Recebido:</span>
              <span className="text-emerald-600">
                R${' '}
                {(
                  Number(selectedPurchase?.boletos?.[liquidationForm.idx]?.unit_value || 0) +
                  Number(liquidationForm.interest || 0) +
                  Number(liquidationForm.penalty || 0)
                ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiquidationOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const boletos = [...selectedPurchase.boletos]
                const b = boletos[liquidationForm.idx]
                b.status = 'Pago'
                b.payment_date = liquidationForm.payment_date
                b.interest_applied = Number(liquidationForm.interest || 0)
                b.penalty_applied = Number(liquidationForm.penalty || 0)

                const { error } = await supabase
                  .from('recebiveis_ccb')
                  .update({ boletos })
                  .eq('id', selectedPurchase.id)
                if (error) return toast.error('Erro ao baixar parcela: ' + error.message)

                if (b.interest_applied > 0 || b.penalty_applied > 0) {
                  await supabase.from('audit_logs').insert({
                    entity_type: 'recebiveis_ccb',
                    entity_id: selectedPurchase.id,
                    action: 'admin_liquidated_installment',
                    details: {
                      message: `Juros ajustados para R$ ${b.interest_applied} e Multa para R$ ${b.penalty_applied} por ${user?.email} em ${new Date().toLocaleString('pt-BR')}`,
                      admin: user?.id,
                      installment_idx: liquidationForm.idx,
                    },
                  })
                }

                toast.success('Parcela liquidada!')
                setLiquidationOpen(false)
                setSelectedPurchase({ ...selectedPurchase, boletos })
                fetchPurchases()
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
