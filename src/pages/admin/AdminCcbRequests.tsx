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
import { Loader2, FileText, Settings, Download, UploadCloud, CheckCircle2 } from 'lucide-react'

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
    if (paths.id_front)
      items.push({ label: 'Identidade (Frente)', path: paths.id_front, bucket: 'ccb-docs' })
    if (paths.id_back)
      items.push({ label: 'Identidade (Verso)', path: paths.id_back, bucket: 'ccb-docs' })
    if (paths.selfie)
      items.push({ label: 'Selfie com Documento', path: paths.selfie, bucket: 'ccb-docs' })
    if (paths.proof_address)
      items.push({
        label: 'Comprovante de Residência',
        path: paths.proof_address,
        bucket: 'ccb-docs',
      })

    if (paths.marriage_cert)
      items.push({
        label: 'Certidão de Casamento',
        path: paths.marriage_cert,
        bucket: 'ccb_conjuges_docs',
      })
    if (paths.spouse_id_front)
      items.push({
        label: 'RG/CPF Cônjuge (Frente)',
        path: paths.spouse_id_front,
        bucket: 'ccb_conjuges_docs',
      })
    if (paths.spouse_id_back)
      items.push({
        label: 'RG/CPF Cônjuge (Verso)',
        path: paths.spouse_id_back,
        bucket: 'ccb_conjuges_docs',
      })
    if (paths.spouse_selfie)
      items.push({
        label: 'Selfie Cônjuge',
        path: paths.spouse_selfie,
        bucket: 'ccb_conjuges_docs',
      })
    if (paths.spouse_address)
      items.push({
        label: 'Residência Cônjuge',
        path: paths.spouse_address,
        bucket: 'ccb_conjuges_docs',
      })

    if (paths.guarantor_id_front)
      items.push({
        label: 'RG/CPF Avalista (Frente)',
        path: paths.guarantor_id_front,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_id_back)
      items.push({
        label: 'RG/CPF Avalista (Verso)',
        path: paths.guarantor_id_back,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_selfie)
      items.push({
        label: 'Selfie Avalista',
        path: paths.guarantor_selfie,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_address)
      items.push({
        label: 'Residência Avalista',
        path: paths.guarantor_address,
        bucket: 'ccb_avalistas_docs',
      })
    if (paths.guarantor_income)
      items.push({
        label: 'Renda Avalista',
        path: paths.guarantor_income,
        bucket: 'ccb_avalistas_docs',
      })

    if (paths.vehicle_doc)
      items.push({
        label: 'Documento do Veículo (CRLV)',
        path: paths.vehicle_doc,
        bucket: 'ccb-docs',
      })

    if (paths.bankExtracts && Array.isArray(paths.bankExtracts)) {
      paths.bankExtracts.forEach((b: string, i: number) =>
        items.push({ label: `Extrato Bancário ${i + 1}`, path: b, bucket: 'ccb-docs' }),
      )
    }
    if (paths.additionalDocs && Array.isArray(paths.additionalDocs)) {
      paths.additionalDocs.forEach((b: string, i: number) =>
        items.push({ label: `Documento Adicional ${i + 1}`, path: b, bucket: 'ccb-docs' }),
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
            toast.success('Simulação aprovada e operação CCB Ativa registrada.')
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
      toast.error('Erro: ' + e.message)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de CCB (BDIGITAL)</h1>
        <p className="text-muted-foreground">
          Analise as simulações solicitadas e gerencie o fluxo de operações.
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
              <CardTitle>Solicitações de Emissão</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto" />
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
                        <TableCell className="font-mono">
                          R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge className={req.status === 'aprovada' ? 'bg-emerald-500' : ''}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setDocsModal(req)}>
                            <FileText className="h-4 w-4 mr-1" /> Detalhes
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setManageId(req.id)
                              setStatusVal(req.status)
                              setNotes(req.admin_notes || '')
                            }}
                          >
                            <Settings className="h-4 w-4 mr-1" /> Gerir
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
              <CardTitle>Operações Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeOps.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="font-medium font-mono text-muted-foreground">
                          #{op.ccb_id?.split('-')[0].toUpperCase()}
                        </TableCell>
                        <TableCell>{op.profiles?.full_name}</TableCell>
                        <TableCell className="font-bold text-primary">
                          R$ {Number(op.net_value).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setManageOp(op)}>
                            Ver Parcelas
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
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
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
            </div>
            {docsModal?.bankData && (
              <div className="text-sm bg-muted/10 p-3 rounded-md border">
                <span className="font-semibold block mb-1">Dados Bancários para Crédito</span>
                {docsModal.bankData.bank} / Ag: {docsModal.bankData.branch} / CC:{' '}
                {docsModal.bankData.account}
                <br />
                Titular: {docsModal.bankData.owner_name} ({docsModal.bankData.owner_document})<br />
                PIX: {docsModal.bankData.pix_key || '-'}
              </div>
            )}
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
            <DialogTitle>Gerenciar Simulação</DialogTitle>
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
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas Internas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageOp} onOpenChange={(v) => !v && setManageOp(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gestão de Parcelas</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {manageOp?.installments.map((inst: any) => (
                <Card
                  key={inst.id}
                  className={`border-l-4 ${inst.status === 'paga' ? 'border-l-emerald-500' : 'border-l-primary'}`}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold">Parcela {inst.number}</p>
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
                    <div className="flex gap-2">
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
                        onClick={() => document.getElementById(`bol-${inst.id}`)?.click()}
                        disabled={uploadingBoleto === inst.id}
                      >
                        Enviar Boleto
                      </Button>
                      {inst.boleto_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(inst.boleto_url)}
                        >
                          Ver Boleto
                        </Button>
                      )}
                      {inst.receipt_url && inst.status !== 'paga' && (
                        <Button
                          size="sm"
                          className="bg-emerald-500"
                          onClick={() => handleApproveReceipt(manageOp.id, inst.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Liquidar
                        </Button>
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
