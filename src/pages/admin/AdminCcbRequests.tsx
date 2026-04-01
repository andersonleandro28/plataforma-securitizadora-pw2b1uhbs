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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2,
  FileText,
  Forward,
  Settings,
  Download,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react'

export default function AdminCcbRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [activeOps, setActiveOps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [manageId, setManageId] = useState<string | null>(null)
  const [docsModal, setDocsModal] = useState<any>(null)
  const [statusVal, setStatusVal] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [manageOp, setManageOp] = useState<any>(null)
  const [uploadingBoleto, setUploadingBoleto] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: reqs }, { data: ops }] = await Promise.all([
      supabase
        .from('ccb_solicitacoes')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('operacoes_antecipacao')
        .select('*, ccb_solicitacoes(*), profiles!user_id(full_name, document_number)')
        .order('created_at', { ascending: false }),
    ])
    if (reqs) setRequests(reqs)
    if (ops) {
      setActiveOps(ops)
      if (manageOp) setManageOp(ops.find((o) => o.id === manageOp.id) || null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const downloadFile = async (
    path: string,
    fileName: string = 'documento.pdf',
    bucket: string = 'ccb-docs',
  ) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
      if (error) throw error
      if (data) window.open(data.signedUrl, '_blank')
    } catch (e) {
      toast.error(`Falha ao visualizar documento`)
    }
  }

  const renderDocs = (req: any) => {
    const paths = req.docs_paths || {}
    const items = []
    if (req.pdf_file_path)
      items.push({ label: 'PDF Espelho CCB', path: req.pdf_file_path, bucket: 'ccb-docs' })
    if (paths.identity)
      items.push({ label: 'Documento de Identidade', path: paths.identity, bucket: 'ccb-docs' })
    if (paths.address)
      items.push({ label: 'Comprovante de Residência', path: paths.address, bucket: 'ccb-docs' })
    if (paths.bank_extract)
      items.push({ label: 'Extrato Bancário', path: paths.bank_extract, bucket: 'ccb-docs' })
    if (paths.ir_document)
      items.push({ label: 'Declaração IR', path: paths.ir_document, bucket: 'ccb-docs' })
    if (paths.vehicle_doc)
      items.push({
        label: 'Documento do Veículo (CRLV)',
        path: paths.vehicle_doc,
        bucket: 'ccb-docs',
      })

    if (paths.spouse_rg)
      items.push({ label: 'RG/CPF Cônjuge', path: paths.spouse_rg, bucket: 'ccb_conjuges_docs' })
    if (paths.spouse_address)
      items.push({
        label: 'Residência Cônjuge',
        path: paths.spouse_address,
        bucket: 'ccb_conjuges_docs',
      })

    if (paths.guarantor_rg)
      items.push({
        label: 'RG/CPF Avalista',
        path: paths.guarantor_rg,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_income)
      items.push({
        label: 'Renda Avalista',
        path: paths.guarantor_income,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_address)
      items.push({
        label: 'Residência Avalista',
        path: paths.guarantor_address,
        bucket: 'ccb_avalistas_docs',
      })

    if (paths.borderos && Array.isArray(paths.borderos)) {
      paths.borderos.forEach((b: string, i: number) =>
        items.push({ label: `Borderô / NF ${i + 1}`, path: b, bucket: 'ccb-docs' }),
      )
    }
    if (req.bdigital_response_file)
      items.push({
        label: 'Retorno Parceiro BDIGITAL',
        path: req.bdigital_response_file,
        bucket: 'ccb-docs',
      })
    return items
  }

  const handleUpdate = async () => {
    if (!manageId) return
    setSaving(true)
    try {
      let bDigitalPath = null
      if (file) {
        const path = `bdigital_responses/${manageId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        await supabase.storage.from('ccb-docs').upload(path, file)
        bDigitalPath = path
      }

      const updateData: any = {
        status: statusVal,
        admin_notes: notes,
        updated_at: new Date().toISOString(),
      }
      if (bDigitalPath) updateData.bdigital_response_file = bDigitalPath

      const { error } = await supabase
        .from('ccb_solicitacoes')
        .update(updateData)
        .eq('id', manageId)
      if (error) throw error

      if (statusVal === 'aprovada') {
        const req = requests.find((r) => r.id === manageId)
        if (req) {
          const { data: existing } = await supabase
            .from('operacoes_antecipacao')
            .select('id')
            .eq('ccb_id', manageId)
            .maybeSingle()
          if (!existing) {
            const term = req.term_months || 12
            const sim = req.operation_data?.simulation || {}
            const pmtValue = sim.installment_value || req.requested_value / term
            const installments = []

            for (let i = 1; i <= term; i++) {
              const dueDate = new Date()
              dueDate.setMonth(dueDate.getMonth() + i)
              installments.push({
                id: crypto.randomUUID(),
                number: i,
                due_date: dueDate.toISOString().split('T')[0],
                value: pmtValue,
                status: 'aberta',
                boleto_url: null,
                receipt_url: null,
              })
            }

            await supabase.from('operacoes_antecipacao').insert({
              ccb_id: manageId,
              user_id: req.user_id,
              net_value: req.requested_value,
              installments,
              partner_bank: 'BDIGITAL',
              status: 'ativa',
            })
            toast.success('Simulação aprovada e operação CCB Ativa registrada com sucesso.')
          }
        }
      }

      toast.success('Solicitação atualizada.')
      setManageId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUploadBoleto = async (opId: string, instId: string, file: File) => {
    if (!file) return
    setUploadingBoleto(instId)
    try {
      const path = `boletos/${opId}/${instId}_${Date.now()}.pdf`
      await supabase.storage.from('ccb-docs').upload(path, file)

      const op = activeOps.find((o) => o.id === opId)
      const newInst = op.installments.map((i: any) =>
        i.id === instId ? { ...i, boleto_url: path } : i,
      )

      await supabase.from('operacoes_antecipacao').update({ installments: newInst }).eq('id', opId)
      toast.success('Boleto enviado com sucesso.')
      fetchData()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setUploadingBoleto(null)
    }
  }

  const handleApproveReceipt = async (opId: string, instId: string) => {
    try {
      const op = activeOps.find((o) => o.id === opId)
      const newInst = op.installments.map((i: any) =>
        i.id === instId ? { ...i, status: 'paga' } : i,
      )

      await supabase.from('operacoes_antecipacao').update({ installments: newInst }).eq('id', opId)
      toast.success('Pagamento liquidado com sucesso.')
      fetchData()
    } catch (e: any) {
      toast.error('Erro ao aprovar: ' + e.message)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de CCB (BDIGITAL)</h1>
        <p className="text-muted-foreground">
          Analise as simulações solicitadas e gerencie o fluxo de liquidação das operações ativas.
        </p>
      </div>

      <Tabs defaultValue="solicitacoes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="solicitacoes">Simulações Pendentes</TabsTrigger>
          <TabsTrigger value="ativas">Operações CCB Ativas</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Emissão de CCB</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor Solicitado</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>CET Anual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhuma solicitação.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">
                          {req.borrower_data?.name || req.profiles?.full_name}
                          <p className="text-xs text-muted-foreground">
                            {req.borrower_data?.document}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>{req.term_months} m</TableCell>
                        <TableCell>
                          {req.operation_data?.simulation?.cet
                            ? req.operation_data.simulation.cet.toFixed(2) + '%'
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === 'aprovada'
                                ? 'default'
                                : req.status === 'rejeitada'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className={
                              req.status === 'aprovada'
                                ? 'bg-emerald-500'
                                : req.status === 'em_analise'
                                  ? 'bg-amber-500'
                                  : ''
                            }
                          >
                            {req.status === 'em_analise' ? 'Enviado BDIG' : req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setDocsModal(req)}>
                            <FileText className="h-4 w-4 mr-1" /> Docs
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setManageId(req.id)
                              setStatusVal(req.status)
                              setNotes(req.admin_notes || '')
                              setFile(null)
                            }}
                          >
                            <Settings className="h-4 w-4 mr-1" /> Gerir/Aprovar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ativas">
          <Card>
            <CardHeader>
              <CardTitle>Operações Ativas (Antecipação Recebíveis)</CardTitle>
              <CardDescription>
                Gerencie as parcelas em aberto, envie boletos de cobrança e valide comprovantes de
                pagamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação (ID)</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : activeOps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhuma operação ativa.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeOps.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="font-medium font-mono text-muted-foreground">
                          #{op.ccb_id?.split('-')[0].toUpperCase()}
                        </TableCell>
                        <TableCell>
                          {op.profiles?.full_name}
                          <p className="text-xs text-muted-foreground">
                            {op.profiles?.document_number}
                          </p>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          R$ {Number(op.net_value).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{op.partner_bank}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500">{op.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setManageOp(op)}>
                            Ver Cronograma / Parcelas
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!docsModal} onOpenChange={(v) => !v && setDocsModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes e Documentos da Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-md border">
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">
                  Tipo de Crédito
                </span>
                {docsModal?.operation_data?.creditType || 'Não informado'}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">
                  Garantia Principal
                </span>
                {docsModal?.guarantees_data?.guaranteeType?.toUpperCase() || 'Não informado'}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">
                  Cônjuge (Se casado)
                </span>
                {docsModal?.borrower_data?.maritalStatus === 'casado'
                  ? 'Informado no Espelho PDF'
                  : 'N/A'}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">Avalista</span>
                {docsModal?.operation_data?.creditType?.toUpperCase().includes('AVAL') ||
                docsModal?.guarantees_data?.guaranteeType === 'avalista'
                  ? 'Informado no Espelho PDF'
                  : 'N/A'}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Arquivos Anexados</h4>
              {docsModal &&
                renderDocs(docsModal).map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-md bg-muted/10 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm font-medium">{doc.label}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(doc.path, doc.label, doc.bucket)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageId} onOpenChange={(v) => !v && setManageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Simulação / CCB</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Atualizar Status</Label>
              <Select value={statusVal} onValueChange={setStatusVal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Enviado BDIGITAL</SelectItem>
                  <SelectItem value="aprovada">Aprovada (Gera Operação)</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
              {statusVal === 'aprovada' && (
                <p className="text-xs text-amber-600 mt-1">
                  Isso irá criar uma Operação Ativa e registrar o cronograma de parcelas
                  automaticamente.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Upload Contrato Assinado BDIGITAL (Opcional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Notas Internas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo da recusa ou detalhes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageOp} onOpenChange={(v) => !v && setManageOp(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Gestão de Parcelas - CCB #{manageOp?.ccb_id?.split('-')[0].toUpperCase()}
            </DialogTitle>
            <DialogDescription>Tomador: {manageOp?.profiles?.full_name}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {manageOp?.installments.map((inst: any) => (
                <Card
                  key={inst.id}
                  className={`border-l-4 ${inst.status === 'paga' ? 'border-l-emerald-500' : inst.status === 'pendente_analise' ? 'border-l-amber-500' : 'border-l-primary'}`}
                >
                  <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-base">Parcela {inst.number}</p>
                      <p className="text-sm">
                        Venc: {new Date(inst.due_date).toLocaleDateString('pt-BR')} |{' '}
                        <span className="font-semibold">
                          R${' '}
                          {Number(inst.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </p>
                      <Badge
                        variant={inst.status === 'paga' ? 'default' : 'outline'}
                        className="mt-1"
                      >
                        {inst.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-muted p-1.5 rounded-md border">
                        <span className="text-xs text-muted-foreground font-medium px-1">
                          Boleto:
                        </span>
                        <Input
                          type="file"
                          id={`bol-${inst.id}`}
                          className="hidden"
                          accept=".pdf"
                          onChange={(e) =>
                            handleUploadBoleto(manageOp.id, inst.id, e.target.files?.[0] as File)
                          }
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => document.getElementById(`bol-${inst.id}`)?.click()}
                          disabled={uploadingBoleto === inst.id}
                        >
                          {uploadingBoleto === inst.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <UploadCloud className="h-3 w-3 mr-1" />
                          )}{' '}
                          Enviar
                        </Button>
                        {inst.boleto_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => downloadFile(inst.boleto_url)}
                          >
                            Ver
                          </Button>
                        )}
                      </div>

                      {inst.receipt_url && (
                        <div className="flex items-center gap-2 bg-muted p-1.5 rounded-md border ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-[#00C2E0] text-[#00C2E0]"
                            onClick={() => downloadFile(inst.receipt_url)}
                          >
                            Ver Comprovante
                          </Button>
                          {inst.status === 'pendente_analise' && (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-500 hover:bg-emerald-600"
                              onClick={() => handleApproveReceipt(manageOp.id, inst.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Liquidar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
