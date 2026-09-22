import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'
import {
  Loader2,
  Download,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSignature,
  Send,
  Calendar,
  CalendarDays,
  Percent,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getStatusBadge } from '../dashboard/BorrowerOperationsList'
import { RiskDossier } from './RiskDossier'
import { AdminEditRatesDialog } from './AdminEditRatesDialog'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function AdminOperationDetails({ opId, open, onOpenChange, onRefresh }: any) {
  const [op, setOp] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [calc, setCalc] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [bankAccount, setBankAccount] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [generatingDoc, setGeneratingDoc] = useState(false)
  const [statusInput, setStatusInput] = useState('')

  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')

  const [datesOpen, setDatesOpen] = useState(false)
  const [datesForm, setDatesForm] = useState({
    issue_date: '',
    due_date: '',
    liquidation_date: '',
  })

  const [editRatesOpen, setEditRatesOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Modal de Liquidação / Baixa da Mesa
  const [liquidationDialogOpen, setLiquidationDialogOpen] = useState(false)
  const [liquidationDate, setLiquidationDate] = useState(new Date().toISOString().split('T')[0])
  const [liquidationAmount, setLiquidationAmount] = useState('')
  const [liquidationBankAccountId, setLiquidationBankAccountId] = useState('')
  const [liquidationNotes, setLiquidationNotes] = useState('')

  useEffect(() => {
    if (open && opId) fetchData()
  }, [open, opId])

  const fetchData = async () => {
    setLoading(true)
    const { data: operation } = await supabase
      .from('credit_operations')
      .select('*, profiles(full_name, email, document_number, phone)')
      .eq('id', opId)
      .single()

    if (operation) {
      setOp(operation)
      setStatusInput(operation.status)
      const [docsRes, calcRes, histRes, verRes, bankRes] = await Promise.all([
        supabase
          .from('operation_documents')
          .select('*')
          .eq('operation_id', opId)
          .order('uploaded_at', { ascending: false }),
        supabase.from('operation_calculations').select('*').eq('operation_id', opId).maybeSingle(),
        supabase
          .from('operation_status_history')
          .select('*, changed_by:profiles(full_name)')
          .eq('operation_id', opId)
          .order('changed_at', { ascending: false }),
        supabase
          .from('contract_versions')
          .select('*') // Manual join below to avoid HTTP 400 schema cache error
          .eq('operation_id', opId)
          .order('version_number', { ascending: false }),
        supabase
          .from('user_bank_accounts')
          .select('*')
          .eq('user_id', operation.borrower_id)
          .eq('is_active', true)
          .limit(1),
      ])

      setDocs(docsRes.data || [])
      setBankAccount(bankRes.data?.[0] || null)
      setCalc(calcRes.data || null)
      setHistory(histRes.data || [])

      setDatesForm({
        issue_date: operation.issue_date || '',
        due_date: operation.due_date || '',
        liquidation_date: operation.liquidation_date || '',
      })

      let fetchedVersions = verRes.data || []

      // Manual join for profiles to ensure robustness against schema cache latency
      if (fetchedVersions.length > 0) {
        const userIds = [
          ...new Set(fetchedVersions.map((v: any) => v.created_by).filter(Boolean)),
        ] as string[]
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)

          if (profilesData) {
            fetchedVersions = fetchedVersions.map((v: any) => ({
              ...v,
              created_by: profilesData.find((p: any) => p.id === v.created_by) || null,
            }))
          }
        }
      }

      setVersions(fetchedVersions)
    }
    setLoading(false)
  }

  const handleDownload = async (path: string, fileName?: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      // Utiliza a Edge Function de proxy para evitar bloqueios de AdBlock/Chrome (ERR_BLOCKED_BY_CLIENT)
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ bucket: 'operation-docs', filePath: path }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao acessar documento proxy.')
      }

      // Processa o blob e cria um download local nativo
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName || 'documento.pdf')
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()

      // Limpeza de cache de memória local
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 1000)
    } catch (err: any) {
      console.error('Download error:', err)
      toast.error(err.message || 'Erro ao baixar documento. Tente novamente.')
    }
  }

  const handleOpenLiquidationDialog = () => {
    const defaultDate =
      datesForm.liquidation_date || op.liquidation_date || new Date().toISOString().split('T')[0]
    const defaultVal =
      op.liquidation_value || op.face_value || calc?.net_value || op.requested_value || 0

    setLiquidationDate(defaultDate)
    setLiquidationAmount(String(defaultVal))
    setLiquidationNotes('Baixa integral executada na Mesa de Operações')
    setLiquidationBankAccountId('')
    setLiquidationDialogOpen(true)
  }

  const handleConfirmFullLiquidation = async () => {
    setActionLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const effectivePaymentDate = liquidationDate || new Date().toISOString().split('T')[0]
      const effectiveAmount = Number(liquidationAmount) || 0

      if (effectiveAmount <= 0) {
        toast.error('Informe um valor válido para a liquidação.')
        setActionLoading(false)
        return
      }

      const { error: rpcErr } = await (supabase.rpc as any)('liquidate_credit_operation_full', {
        p_operation_id: op.id,
        p_payment_date: effectivePaymentDate,
        p_amount_paid: effectiveAmount,
        p_notes: liquidationNotes || 'Baixa integral executada na Mesa de Operações',
        p_bank_account_id: liquidationBankAccountId || null,
      })

      if (rpcErr) throw rpcErr

      toast.success(
        `Operação liquidada com sucesso! Lançamento de R$ ${Number(effectiveAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado na Contabilidade (Livro Caixa) e DRE.`,
      )
      setLiquidationDialogOpen(false)
      fetchData()
      if (onRefresh) onRefresh()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao liquidar operação no caixa/DRE: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'liquidado' && op.status !== 'liquidado') {
      handleOpenLiquidationDialog()
      return
    }

    setActionLoading(true)

    // Reversão de liquidação: ao sair do status "liquidado" para qualquer outro,
    // estorna os registros de tesouraria, caixa e mapeamento de forma segura
    if (newStatus !== 'liquidado' && op.status === 'liquidado') {
      try {
        const { error: revErr } = await (supabase.rpc as any)(
          'revert_credit_operation_full_liquidation',
          {
            p_operation_id: op.id,
          },
        )

        if (revErr) throw revErr

        toast.info('Baixa revertida: lançamentos de receita estornados do Caixa e DRE.')
        fetchData()
        if (onRefresh) onRefresh()
        setActionLoading(false)
        return
      } catch (err: any) {
        console.error(err)
        toast.error('Erro ao reverter liquidação: ' + err.message)
        setActionLoading(false)
        return
      }
    }

    const { error } = await supabase
      .from('credit_operations')
      .update({ status: newStatus })
      .eq('id', opId)
    if (!error) {
      toast.success('Status atualizado. Email enviado ao tomador (se aplicável).')
      fetchData()
      if (onRefresh) onRefresh()
    } else {
      toast.error('Erro ao atualizar status.')
    }
    setActionLoading(false)
  }

  const handleGenerateClick = () => {
    if (versions.length > 0) {
      setReasonOpen(true)
    } else {
      handleGenerateAditivo()
    }
  }

  const handleGenerateAditivo = async () => {
    setReasonOpen(false)
    setGeneratingDoc(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-aditivo', {
        body: { operationId: opId, reason: reason },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Aditivo de Cessão gerado com sucesso. Notificação enviada ao cliente.')
      setReason('')
      fetchData()
    } catch (err: any) {
      console.error('Generate Aditivo Error:', err)
      const errorMsg = err.message?.toLowerCase() || ''
      if (
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('blocked_by_client') ||
        errorMsg.includes('networkerror')
      ) {
        toast.error(
          'Detectamos um bloqueio no seu navegador. Por favor, desative extensões de AdBlock ou tente usar uma aba anônima.',
        )
      } else {
        toast.error(err.message || 'Erro ao gerar aditivo em PDF.')
      }
    } finally {
      setGeneratingDoc(false)
    }
  }

  const handleDeleteCancelledOperation = async () => {
    if (!op || op.status !== 'cancelado') return
    setDeleting(true)
    try {
      const { data, error } = await (supabase.rpc as any)('delete_cancelled_credit_operation', {
        p_operation_id: op.id,
      })

      if (error) throw error

      toast.success(
        `Operação #${op.id?.split('-')[0]?.toUpperCase()} (${op.sacado || 'Sacado'}) excluída com sucesso.`,
      )
      setDeleteDialogOpen(false)
      onOpenChange(false)
      if (onRefresh) onRefresh()
    } catch (err: any) {
      console.error('Delete cancelled op error:', err)
      toast.error(err.message || 'Erro ao excluir operação cancelada.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveDates = async () => {
    setActionLoading(true)
    try {
      const payload = {
        issue_date: datesForm.issue_date || null,
        due_date: datesForm.due_date || null,
        liquidation_date: datesForm.liquidation_date || null,
      }

      const { error } = await supabase.from('credit_operations').update(payload).eq('id', opId)
      if (error) throw error

      // Recalcular a operação para refletir a nova base de datas/juros
      try {
        await supabase.functions.invoke('calculate-operation', { body: { operation_id: opId } })
      } catch (calcErr) {
        console.warn('Erro ao recalcular operação pós-atualização de datas:', calcErr)
      }

      await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: opId,
        action: 'admin_updated_dates',
        details: {
          old_dates: {
            issue_date: op.issue_date,
            due_date: op.due_date,
            liquidation_date: op.liquidation_date,
          },
          new_dates: payload,
        },
      })

      toast.success('Datas atualizadas e cálculos recalculados com sucesso.')
      setDatesOpen(false)
      fetchData()
      if (onRefresh) onRefresh()
    } catch (err: any) {
      toast.error('Erro ao atualizar datas: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendToSignature = async () => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('docusign-envelope', {
        body: {
          signerEmail: op.profiles?.email,
          signerName: op.profiles?.full_name || op.profiles?.pj_company_name,
          documentUrl: versions[0]?.file_path || 'dummy',
          type: 'operation',
          id: opId,
          callbackUrl: window.location.origin,
        },
      })
      if (error || data?.error) throw error || new Error(data?.error)
      toast.success('Enviado para assinatura no DocuSign!')
      fetchData()
      if (onRefresh) onRefresh()
    } catch (err: any) {
      toast.error('Erro ao enviar para DocuSign.')
    } finally {
      setActionLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex justify-between items-center pr-6">
              <span>Gestão de Operação</span>
              {op && getStatusBadge(op.status)}
            </SheetTitle>
            <SheetDescription>
              Análise detalhada, memória de cálculo e fluxo de aprovação.
            </SheetDescription>
          </SheetHeader>

          {loading || !op ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Actions Toolbar */}
              <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleStatusChange('aprovado')}
                  disabled={
                    actionLoading ||
                    op.status === 'aprovado' ||
                    op.status === 'pago' ||
                    op.status === 'cancelado'
                  }
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatusChange('reprovado')}
                  disabled={actionLoading || op.status === 'reprovado' || op.status === 'cancelado'}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reprovar
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => handleStatusChange('pendencia_documental')}
                  disabled={
                    actionLoading ||
                    op.status === 'pendencia_documental' ||
                    op.status === 'cancelado'
                  }
                >
                  <AlertCircle className="w-4 h-4 mr-2" /> Solicitar Documento
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="bg-primary/5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setEditRatesOpen(true)}
                  disabled={
                    actionLoading ||
                    op.status === 'liquidado' ||
                    op.status === 'pago' ||
                    op.status === 'cancelado'
                  }
                >
                  <Percent className="w-4 h-4 mr-2" /> Editar Taxas &amp; Juros
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDatesOpen(true)}
                  disabled={actionLoading}
                >
                  <CalendarDays className="w-4 h-4 mr-2" /> Editar Datas
                </Button>

                {/* Ação Destrutiva: Excluir Operação Cancelada */}
                {op.status === 'cancelado' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="bg-destructive/90 hover:bg-destructive text-destructive-foreground gap-1.5"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={actionLoading || deleting}
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Cancelada
                  </Button>
                )}

                {/* Formalização Digital */}
                {(op.status === 'aprovado' || op.status === 'aguardando_formalizacao') && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 ml-auto"
                      onClick={handleGenerateClick}
                      disabled={generatingDoc}
                    >
                      {generatingDoc ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando Documento...
                        </>
                      ) : (
                        <>
                          <FileSignature className="w-4 h-4 mr-2 text-emerald-600" />
                          Gerar Aditivo
                        </>
                      )}
                    </Button>

                    {versions.length > 0 && op.signature_status !== 'assinado' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleSendToSignature}
                        disabled={actionLoading || op.signature_status === 'enviado'}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {op.signature_status === 'enviado' ? 'DocuSign Enviado' : 'Enviar DocuSign'}
                      </Button>
                    )}
                  </>
                )}

                <div className="flex-1 min-w-[180px] flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={() => handleOpenLiquidationDialog()}
                    disabled={actionLoading || op.status === 'liquidado'}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Baixar / Liquidar
                  </Button>

                  <Select
                    value={statusInput}
                    onValueChange={(v) => {
                      setStatusInput(v)
                      handleStatusChange(v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Forçar Status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="em_triagem">Em Triagem</SelectItem>
                      <SelectItem value="em_analise">Em Análise</SelectItem>
                      <SelectItem value="pendencia_documental">Pendência</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                      <SelectItem value="aguardando_formalizacao">Formalizando</SelectItem>
                      <SelectItem value="aguardando_liquidacao">Aguardando Liquidação</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="liquidado">Liquidado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <Card className="shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm flex gap-2 items-center">
                      <User className="w-4 h-4 text-primary" /> Dados do Tomador
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground">{op.profiles?.full_name}</p>
                    <p>{op.profiles?.document_number || 'Sem documento'}</p>
                    <p>{op.profiles?.email}</p>
                    <p>{op.profiles?.phone}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm flex gap-2 items-center">
                      <FileText className="w-4 h-4 text-primary" /> Detalhes do Título
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-1 text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Tipo:</span>{' '}
                      {op.receivable_type?.replace('_', ' ').toUpperCase()}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Cedente:</span> {op.cedente}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Sacado:</span> {op.sacado}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Vencimento:</span>{' '}
                      {op.due_date ? format(new Date(op.due_date), 'dd/MM/yyyy') : '-'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Parcelas:</span>{' '}
                      {op.installments || 1}x
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Se houver dados de parcelas individuais (installments_data) */}
              {Array.isArray((op as any).installments_data) &&
                (op as any).installments_data.length > 0 && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Cronograma de Parcelas &amp; Documentos
                    </h4>
                    <div className="space-y-1.5">
                      {(op as any).installments_data.map((inst: any, idx: number) => {
                        const instDoc = docs.find(
                          (d) =>
                            d.category === `parcela_${inst.number}` ||
                            d.file_name?.toLowerCase().includes(`parcela ${inst.number}`) ||
                            (inst.documentPath && d.file_path === inst.documentPath),
                        )

                        return (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded border bg-background text-xs gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                {inst.number}
                              </span>
                              <span className="font-medium">Parcela {inst.number}</span>
                              <span className="text-muted-foreground">|</span>
                              <span>
                                Vencimento:{' '}
                                <strong className="text-foreground">
                                  {inst.dueDate
                                    ? format(new Date(inst.dueDate + 'T00:00:00'), 'dd/MM/yyyy')
                                    : '-'}
                                </strong>
                              </span>
                              {inst.value && (
                                <>
                                  <span className="text-muted-foreground">|</span>
                                  <span className="font-mono text-emerald-600 font-medium">
                                    {formatCurrency(Number(inst.value))}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {instDoc ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
                                  onClick={() =>
                                    handleDownload(instDoc.file_path, instDoc.file_name)
                                  }
                                >
                                  <Download className="w-3 h-3" /> Baixar Doc (
                                  {instDoc.file_name.replace(`Parcela ${inst.number} - `, '')})
                                </Button>
                              ) : inst.documentName ? (
                                <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> {inst.documentName}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  Sem documento individual
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              {/* Informações Bancárias */}
              <Card className="shadow-none border-primary/20">
                <CardHeader className="p-4 pb-2 bg-primary/5">
                  <CardTitle className="text-sm flex gap-2 items-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Dados Bancários (Liquidação)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm">
                  {bankAccount ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground text-xs">Instituição</p>
                        <p className="font-medium">{bankAccount.bank_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Agência / Conta</p>
                        <p className="font-medium">
                          {bankAccount.branch || '-'} / {bankAccount.account_number}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Chave PIX</p>
                        <p className="font-medium font-mono">
                          {bankAccount.pix_key || 'Não cadastrada'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-amber-600 bg-amber-50 p-3 rounded text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p>
                        Nenhuma conta bancária ativa encontrada para o tomador. O aditivo será
                        gerado com espaço para preenchimento manual.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risk Dossier */}
              <RiskDossier
                operationId={op.id}
                sacadoDocument={op.document_number}
                onStatusChanged={(s: string) => {
                  setStatusInput(s)
                  fetchData()
                  if (onRefresh) onRefresh()
                }}
              />

              {/* Histórico de Versões do Contrato */}
              {versions.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <FileSignature className="w-4 h-4" /> Histórico de Contratos (Audit Trail)
                  </h4>
                  <div className="space-y-2">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-3 border rounded-md text-sm bg-background shadow-sm hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 p-2 rounded shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-2">
                              Aditivo de Cessão - Versão {v.version_number}
                              {v.version_number === versions[0]?.version_number && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                                  Atual
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(v.created_at), 'dd/MM/yyyy HH:mm')} por{' '}
                              {v.created_by?.full_name || 'Sistema'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Motivo:</span> {v.reason}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(v.file_path, v.file_name)}
                          className="text-primary hover:text-primary shrink-0"
                        >
                          <Download className="w-4 h-4 mr-2" /> Baixar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calc Memory */}
              <Card className="shadow-none border-primary/20 bg-muted/10">
                <CardHeader className="p-4 pb-2 bg-primary/5 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Memória de Cálculo Financeiro (Server-side)
                    {calc?.calculation_memory?.applied_params?.is_custom_admin_rate && (
                      <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-300 dark:border-amber-700">
                        Proposta com Taxas Editadas
                      </span>
                    )}
                  </CardTitle>
                  {op.status !== 'liquidado' && op.status !== 'pago' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                      onClick={() => setEditRatesOpen(true)}
                    >
                      <Percent className="w-3.5 h-3.5" /> Alterar Taxas
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Valor de Face (VF)</span>
                    <span className="font-mono">{formatCurrency(op.face_value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor Solicitado (VS)</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(op.requested_value)}
                    </span>
                  </div>
                  <div className="border-t my-2" />
                  {calc ? (
                    <>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>Deságio Proporcional</span>
                        <span>-{formatCurrency(calc.discount_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>Juros Proporcionais</span>
                        <span>-{formatCurrency(calc.interest_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>Custo Ad Valorem</span>
                        <span>-{formatCurrency(calc.ad_valorem_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>Custo Estruturação</span>
                        <span>-{formatCurrency(calc.structuring_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>Taxa de Análise</span>
                        <span>-{formatCurrency(calc.analysis_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>IOF Fixo (0,38%)</span>
                        <span>-{formatCurrency(calc.iof_fixed_value)}</span>
                      </div>
                      <div className="flex justify-between text-destructive text-xs">
                        <span>IOF Diário (0,0041%)</span>
                        <span>-{formatCurrency(calc.iof_daily_value)}</span>
                      </div>
                      <div className="border-t border-destructive/20 my-2" />
                      <div className="flex justify-between text-destructive font-medium text-xs">
                        <span>Total de Descontos</span>
                        <span>-{formatCurrency(calc.total_discounts)}</span>
                      </div>
                      <div className="border-t my-2" />
                      <div className="flex justify-between font-semibold text-base items-center">
                        <span>Valor Líquido Liberado</span>
                        <span className="text-emerald-600 font-mono text-lg">
                          {formatCurrency(calc.net_value)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-3 bg-background p-2 rounded border">
                        <span>
                          Prazo Calculado:{' '}
                          <strong>
                            {calc.term_days} dias
                            {calc.calculation_memory?.isInstallmentCalculation
                              ? ' (médio ponderado)'
                              : ''}
                          </strong>
                        </span>
                        <span>
                          Custo Efetivo Total (CET):{' '}
                          <strong>{calc.effective_cost_rate?.toFixed(2)}%</strong>
                        </span>
                      </div>

                      {calc.calculation_memory?.applied_params?.is_custom_admin_rate && (
                        <div className="text-[11px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 rounded text-amber-900 dark:text-amber-200 space-y-1">
                          <div className="font-semibold flex items-center justify-between">
                            <span>Taxas customizadas pela mesa de operações:</span>
                            {calc.calculation_memory.applied_params.rates_updated_at && (
                              <span className="text-[10px] font-normal text-muted-foreground">
                                Editado em{' '}
                                {format(
                                  new Date(calc.calculation_memory.applied_params.rates_updated_at),
                                  'dd/MM/yyyy HH:mm',
                                )}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                            <div>
                              Deságio:{' '}
                              <strong>
                                {calc.calculation_memory.applied_params.discount_rate_monthly}%/mês
                              </strong>
                            </div>
                            <div>
                              Juros:{' '}
                              <strong>
                                {calc.calculation_memory.applied_params.interest_rate_monthly}%/mês
                              </strong>
                            </div>
                            <div>
                              Ad Valorem:{' '}
                              <strong>
                                {calc.calculation_memory.applied_params.ad_valorem_rate}%
                              </strong>
                            </div>
                            <div>
                              Estruturação:{' '}
                              <strong>
                                {calc.calculation_memory.applied_params.structuring_fee}%
                              </strong>
                            </div>
                          </div>
                          {calc.calculation_memory.applied_params.rates_justification && (
                            <p className="text-[10px] italic pt-1 border-t border-amber-200/60 dark:border-amber-800/60 text-muted-foreground">
                              Justificativa:{' '}
                              <span className="text-foreground">
                                {calc.calculation_memory.applied_params.rates_justification}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {calc.calculation_memory?.isInstallmentCalculation &&
                        Array.isArray(calc.calculation_memory?.installmentsBreakdown) &&
                        calc.calculation_memory.installmentsBreakdown.length > 0 && (
                          <div className="mt-2 border rounded p-2 bg-background space-y-1 text-xs">
                            <span className="font-semibold text-primary block text-[11px]">
                              Detalhamento por Parcela (Cálculo Individual):
                            </span>
                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                              {calc.calculation_memory.installmentsBreakdown.map((item: any) => (
                                <div
                                  key={item.number}
                                  className="flex items-center justify-between text-[11px] p-1 rounded bg-muted/40"
                                >
                                  <span>
                                    <strong>Parcela {item.number}</strong> ({item.termDays}d):{' '}
                                    <span className="font-mono">
                                      {formatCurrency(Number(item.faceValue || 0))}
                                    </span>
                                  </span>
                                  <span className="font-mono text-destructive">
                                    -
                                    {formatCurrency(
                                      Number(item.interest_val || 0) +
                                        Number(item.discount_val || 0),
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center p-4 bg-background border border-dashed rounded text-muted-foreground text-xs">
                      Cálculo financeiro não processado.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  Outros Documentos Anexados
                </h4>
                <div className="space-y-2">
                  {docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 border border-dashed rounded bg-muted/20 text-center">
                      Nenhum arquivo enviado.
                    </p>
                  ) : (
                    docs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-3 border rounded-md text-sm bg-background hover:bg-muted/50 transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-2">
                              {d.file_name}
                              {d.category?.includes('Aditivo Contratual') && (
                                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                  Gerado pelo Sistema
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(d.file_size / 1024 / 1024).toFixed(2)} MB -{' '}
                              {format(new Date(d.uploaded_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(d.file_path, d.file_name)}
                          className="gap-2 shrink-0 text-primary hover:text-primary"
                        >
                          <Download className="w-4 h-4" /> Baixar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-medium text-sm mb-3">Audit Trail (Histórico de Status)</h4>
                <div className="space-y-0 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {history.map((h, i) => (
                    <div
                      key={h.id}
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full border border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <div className="w-2 h-2 bg-background rounded-full"></div>
                      </div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border bg-card shadow-sm ml-3 md:ml-0">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm uppercase">
                              {h.new_status?.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(h.changed_at), 'dd/MM/yyyy HH:mm')} -{' '}
                            {h.changed_by?.full_name || 'Sistema'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-8">Sem histórico.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reemissão Dialog */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Nova Versão do Aditivo</DialogTitle>
            <DialogDescription>
              Já existe uma versão gerada para esta operação. Para garantir a rastreabilidade (Audit
              Trail), informe o motivo da reemissão.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Ex: Correção de taxas, alteração de vencimento..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateAditivo} disabled={!reason.trim()}>
              Confirmar Geração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={datesOpen} onOpenChange={setDatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Datas (Migração/Correção)</DialogTitle>
            <DialogDescription>
              Atenção: Alterar datas afetará cálculos de prazo, juros e rentabilidade. Essa ação
              será registrada na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Data de Emissão / Início</Label>
              <Input
                type="date"
                value={datesForm.issue_date}
                onChange={(e) => setDatesForm({ ...datesForm, issue_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={datesForm.due_date}
                onChange={(e) => setDatesForm({ ...datesForm, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Liquidação (Efetiva)</Label>
              <Input
                type="date"
                value={datesForm.liquidation_date}
                onChange={(e) => setDatesForm({ ...datesForm, liquidation_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDatesOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDates} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Datas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Baixa / Liquidação Total da Mesa de Operações */}
      <Dialog open={liquidationDialogOpen} onOpenChange={setLiquidationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Baixar e Liquidar Operação
            </DialogTitle>
            <DialogDescription>
              A baixa total atualiza o status para Liquidado, liberando o limite de crédito do
              tomador e gerando o recebimento na Tesouraria e Livro Caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="liq_op_date">Data da Liquidação / Recebimento</Label>
              <Input
                id="liq_op_date"
                type="date"
                value={liquidationDate}
                onChange={(e) => setLiquidationDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="liq_op_amount">Valor Recebido (R$)</Label>
              <Input
                id="liq_op_amount"
                type="number"
                step="0.01"
                value={liquidationAmount}
                onChange={(e) => setLiquidationAmount(e.target.value)}
              />
            </div>

            <CompanyBankAccountSelect
              value={liquidationBankAccountId}
              onChange={setLiquidationBankAccountId}
              label="Conta Bancária de Recebimento"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="liq_op_notes">Observações</Label>
              <Input
                id="liq_op_notes"
                placeholder="Ex.: Recebido via PIX mesa"
                value={liquidationNotes}
                onChange={(e) => setLiquidationNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setLiquidationDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmFullLiquidation}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirmar Liquidação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Taxas e Juros */}
      <AdminEditRatesDialog
        open={editRatesOpen}
        onOpenChange={setEditRatesOpen}
        operation={op}
        currentCalc={calc}
        onSuccess={() => {
          fetchData()
          if (onRefresh) onRefresh()
        }}
      />

      {/* Confirmação Obrigatória de Exclusão de Operação Cancelada */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Excluir operação cancelada?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span>
                Você está prestes a excluir permanentemente a operação{' '}
                <strong className="text-foreground">#{op?.id?.split('-')[0]?.toUpperCase()}</strong>{' '}
                do sacado{' '}
                <strong className="text-foreground">{op?.sacado || 'Não informado'}</strong>
                {op?.document_number ? ` (Doc: ${op.document_number})` : ''}.
              </span>
              <span className="block text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                Atenção: Esta ação é irreversível. O sistema verificará se não há lançamentos
                contábeis (Tesouraria/Livro Caixa) vinculados e registrará a exclusão na trilha de
                auditoria.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteCancelledOperation()
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...
                </>
              ) : (
                'Excluir Permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
