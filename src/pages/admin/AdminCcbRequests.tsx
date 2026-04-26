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
  Settings,
  Download,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Calculator,
  Edit,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function AdminCcbRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [activeOps, setActiveOps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ccbConfig, setCcbConfig] = useState<any>(null)

  const [manageId, setManageId] = useState<string | null>(null)
  const [docsModal, setDocsModal] = useState<any>(null)
  const [statusVal, setStatusVal] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [manageOp, setManageOp] = useState<any>(null)
  const [uploadingBoleto, setUploadingBoleto] = useState<string | null>(null)

  // Mesa de Negociação (Adjust)
  const [adjustModal, setAdjustModal] = useState<any>(null)
  const [adjRate, setAdjRate] = useState('')
  const [adjFee, setAdjFee] = useState('')
  const [adjPmt, setAdjPmt] = useState('')
  const [adjFirstDue, setAdjFirstDue] = useState('')
  const [adjCet, setAdjCet] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: reqs }, { data: ops }, { data: cfg }] = await Promise.all([
      supabase
        .from('ccb_solicitacoes')
        .select('*, profiles(full_name, email)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('operacoes_antecipacao')
        .select('*, ccb_solicitacoes(*, profiles(full_name, document_number))')
        .order('created_at', { ascending: false }),
      supabase.from('config_ccb').select('*').single(),
    ])
    if (reqs) setRequests(reqs)
    if (ops) {
      setActiveOps(ops)
      if (manageOp) setManageOp(ops.find((o) => o.id === manageOp.id) || null)
    }
    if (cfg) setCcbConfig(cfg)
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

    if (paths.vehicle_doc)
      items.push({
        label: 'Documento do Veículo (CRLV)',
        path: paths.vehicle_doc,
        bucket: 'ccb-docs',
      })

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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta solicitação? Esta ação a removerá da sua fila.'))
      return
    try {
      await supabase
        .from('ccb_solicitacoes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      toast.success('Solicitação excluída com sucesso.')
      fetchData()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    }
  }

  const calculatePmtDetails = (ratePercent: number, fee: number, modal: any, cfg: any) => {
    if (!modal || !cfg)
      return { pmt: 0, cet: 0, totalIof: 0, iofFixo: 0, iofDiario: 0, schedule: [] }
    const pv = modal.requested_value
    const n = modal.term_months
    const rate = ratePercent / 100

    let pmt = pv / n
    if (rate > 0) pmt = (pv * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)

    const iofFixedRate = Number(cfg.iof_rate) || 0.38
    const iofDaily30 = Number(cfg.iof_daily_rate_30) || 0.0041
    const iofDailyAfter = Number(cfg.iof_daily_rate_after) || 0.00274

    const iofFixo = pv * (iofFixedRate / 100)

    let saldo = pv
    let totalIofDiario = 0
    const schedule = []

    for (let i = 1; i <= n; i++) {
      const juros = saldo * rate
      const amortizacao = rate > 0 ? pmt - juros : pv / n

      const days = i * 30
      const days1to30 = Math.min(days, 30)
      const daysAfter = Math.max(0, days - 30)

      const iofDiarioParcela =
        amortizacao * (days1to30 * (iofDaily30 / 100) + daysAfter * (iofDailyAfter / 100))
      totalIofDiario += iofDiarioParcela

      saldo -= amortizacao
      schedule.push({
        month: i,
        amortizacao,
        juros,
        iof_diario: iofDiarioParcela,
        pmt_base: pmt,
        saldo_devedor: Math.max(0, saldo),
      })
    }

    const totalIof = iofFixo + totalIofDiario
    const parcelaFinal = pmt + totalIof / n + fee / n

    let low = 0.0
    let high = 1.0
    let r = 0.0
    for (let i = 0; i < 50; i++) {
      r = (low + high) / 2
      const currentPv = (parcelaFinal * (1 - Math.pow(1 + r, -n))) / r
      if (currentPv > pv) low = r
      else high = r
    }
    const cet = (Math.pow(1 + r, 12) - 1) * 100

    return { pmt: parcelaFinal, cet, totalIof, iofFixo, iofDiario: totalIofDiario, schedule }
  }

  const findRateForPmt = (targetPmt: number, fee: number, modal: any, cfg: any) => {
    if (!modal || !cfg) return { rate: 0, cet: 0 }
    let lowRate = 0.0001
    let highRate = 100.0
    let bestRate = 0.0001
    let cet = 0

    for (let i = 0; i < 50; i++) {
      const midRate = (lowRate + highRate) / 2
      const res = calculatePmtDetails(midRate, fee, modal, cfg)
      if (res.pmt > targetPmt) {
        highRate = midRate
      } else {
        lowRate = midRate
      }
      bestRate = midRate
      cet = res.cet
    }
    return { rate: bestRate, cet }
  }

  const handleRateChange = (val: string) => {
    setAdjRate(val)
    if (val === '' || val === '.') return
    const rateNum = Number(val)
    if (!isNaN(rateNum)) {
      const feeNum = Number(adjFee) || 0
      const res = calculatePmtDetails(rateNum, feeNum, adjustModal, ccbConfig)
      setAdjPmt(res.pmt.toFixed(2))
      setAdjCet(res.cet)
    }
  }

  const handlePmtChange = (val: string) => {
    setAdjPmt(val)
    if (val === '' || val === '.') return
    const pmtNum = Number(val)
    if (!isNaN(pmtNum)) {
      const feeNum = Number(adjFee) || 0
      const res = findRateForPmt(pmtNum, feeNum, adjustModal, ccbConfig)
      setAdjRate(res.rate.toFixed(2))
      setAdjCet(res.cet)
    }
  }

  const handleFeeChange = (val: string) => {
    setAdjFee(val)
    if (val === '' || val === '.') return
    const feeNum = Number(val)
    if (!isNaN(feeNum)) {
      const rateNum = Number(adjRate) || 0
      const res = calculatePmtDetails(rateNum, feeNum, adjustModal, ccbConfig)
      setAdjPmt(res.pmt.toFixed(2))
      setAdjCet(res.cet)
    }
  }

  const openAdjust = (req: any) => {
    const sim = req.operation_data?.simulation || {}
    setAdjustModal(req)

    const rate = sim.interest_rate_monthly || 2.5
    const fee = sim.fixed_cost || 0
    const pmt = sim.installment_value || req.requested_value / req.term_months

    setAdjRate(rate.toString())
    setAdjFee(fee.toString())
    setAdjPmt(pmt.toString())
    setAdjFirstDue(
      sim.first_due_date ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    )

    const res = calculatePmtDetails(Number(rate), Number(fee), req, ccbConfig)
    setAdjCet(res.cet)
  }

  const handleApproveReceipt = async (opId: string, instId: string) => {
    try {
      const op = activeOps.find((o) => o.id === opId)
      if (!op) return

      const newInstallments = op.installments.map((i: any) => {
        if (i.id === instId) {
          return { ...i, status: 'paga', payment_date: new Date().toISOString() }
        }
        return i
      })

      const { error } = await supabase
        .from('operacoes_antecipacao')
        .update({ installments: newInstallments })
        .eq('id', opId)

      if (error) throw error

      toast.success('Parcela liquidada com sucesso! O lançamento foi gerado na Tesouraria.')
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao liquidar: ' + err.message)
    }
  }

  const handleSaveAdjustment = async () => {
    try {
      const originalSimulation = adjustModal.operation_data?.simulation || {}
      const rateNum = Number(adjRate) || 0
      const feeNum = Number(adjFee) || 0
      const calcDetails = calculatePmtDetails(rateNum, feeNum, adjustModal, ccbConfig)

      const newSimulation = {
        ...originalSimulation,
        interest_rate_monthly: rateNum,
        fixed_cost: feeNum,
        installment_value: Number(adjPmt),
        first_due_date: adjFirstDue,
        cet: calcDetails.cet,
        iof_fixo: calcDetails.iofFixo,
        iof_diario: calcDetails.iofDiario,
        total_iof: calcDetails.totalIof,
        schedule: calcDetails.schedule,
      }

      const newOpData = {
        ...adjustModal.operation_data,
        simulation: newSimulation,
        original_simulation: originalSimulation,
      }

      await supabase
        .from('ccb_solicitacoes')
        .update({
          operation_data: newOpData,
          status: 'proposta_ajustada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', adjustModal.id)

      await supabase.from('audit_logs').insert({
        entity_type: 'ccb_solicitacoes',
        entity_id: adjustModal.id,
        action: 'proposal_adjusted',
        details: { original: originalSimulation, adjusted: newSimulation, admin_id: user?.id },
      })

      await supabase.functions.invoke('notify-ccb-adjustment', {
        body: { ccb_id: adjustModal.id, user_id: adjustModal.user_id, newSimulation },
      })

      toast.success('Proposta ajustada e notificação enviada ao cliente!')
      setAdjustModal(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erro ao ajustar: ' + e.message)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de CCB (BDIGITAL)</h1>
        <p className="text-muted-foreground">
          Analise as simulações solicitadas, ajuste as condições na mesa de negociação e gerencie o
          fluxo de operações.
        </p>
      </div>
      <Tabs defaultValue="solicitacoes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="solicitacoes">Solicitações de Crédito</TabsTrigger>
          <TabsTrigger value="ativas">Operações CCB Ativas</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitacoes">
          <Card>
            <CardHeader>
              <CardTitle>Fila de Simulações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor Solicitado</TableHead>
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
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        Nenhuma solicitação encontrada.
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
                          <Badge
                            className={
                              req.status === 'aprovada'
                                ? 'bg-emerald-500'
                                : req.status === 'proposta_ajustada'
                                  ? 'bg-blue-500'
                                  : req.status === 'aceite_tomador'
                                    ? 'bg-indigo-500'
                                    : ''
                            }
                          >
                            {req.status === 'proposta_ajustada'
                              ? 'Aguardando Aceite'
                              : req.status === 'aceite_tomador'
                                ? 'Aceito pelo Tomador'
                                : req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setDocsModal(req)}>
                            <FileText className="h-4 w-4 mr-1" /> Detalhes
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openAdjust(req)}>
                            <Edit className="h-4 w-4 mr-1" /> Ajustar
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(req.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
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
                  ) : activeOps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        Nenhuma operação ativa encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeOps.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="font-medium font-mono text-muted-foreground">
                          #{op.ccb_id?.split('-')[0].toUpperCase()}
                        </TableCell>
                        <TableCell>{op.ccb_solicitacoes?.profiles?.full_name}</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Espelhamento de Solicitação</DialogTitle>
            <DialogDescription>Visão detalhada conforme submetido pelo tomador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-md border">
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">
                  Valor Solicitado
                </span>
                <span className="font-bold text-lg">
                  R$ {Number(docsModal?.requested_value || 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">Prazo</span>
                <span className="font-bold text-lg">{docsModal?.term_months} meses</span>
              </div>
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

            <div className="bg-primary/5 p-4 rounded-md border border-primary/20 space-y-3">
              <h4 className="font-semibold text-primary flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Condições e Simulação
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Taxa Juros</span>
                  <span className="font-medium">
                    {docsModal?.operation_data?.simulation?.interest_rate_monthly || 0}% a.m.
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Tarifa Emissão</span>
                  <span className="font-medium">
                    R${' '}
                    {Number(docsModal?.operation_data?.simulation?.fixed_cost || 0).toLocaleString(
                      'pt-BR',
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Valor Parcela</span>
                  <span className="font-medium">
                    R${' '}
                    {Number(
                      docsModal?.operation_data?.simulation?.installment_value || 0,
                    ).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Custo Efetivo (CET)</span>
                  <span className="font-medium">
                    {Number(docsModal?.operation_data?.simulation?.cet || 0).toFixed(2)}% a.m.
                  </span>
                </div>
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

      <Dialog open={!!adjustModal} onOpenChange={(v) => !v && setAdjustModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mesa de Negociação (Ajustar Proposta)</DialogTitle>
            <DialogDescription>
              Altere as condições comerciais da proposta original. O CET será recalculado
              automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxa de Juros Mensal (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjRate}
                  onChange={(e) => handleRateChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tarifa de Emissão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjFee}
                  onChange={(e) => handleFeeChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor da Parcela (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjPmt}
                  onChange={(e) => handlePmtChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>1º Vencimento</Label>
                <Input
                  type="date"
                  value={adjFirstDue}
                  onChange={(e) => setAdjFirstDue(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-md flex items-center justify-between">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                CET Recalculado (aprox.):
              </span>
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {adjCet.toFixed(2)}% a.m.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdjustment}>Salvar e Notificar Cliente</Button>
          </DialogFooter>
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
                  <SelectItem value="proposta_ajustada">Aguardando Aceite (Cliente)</SelectItem>
                  <SelectItem value="aceite_tomador">Aceito pelo Cliente</SelectItem>
                  <SelectItem value="aprovada">Aprovada (Gerar Operação Ativa)</SelectItem>
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
