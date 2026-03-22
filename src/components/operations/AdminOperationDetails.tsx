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
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, Download, User, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { getStatusBadge } from '../dashboard/BorrowerOperationsList'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function AdminOperationDetails({ opId, open, onOpenChange, onRefresh }: any) {
  const [op, setOp] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [calc, setCalc] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusInput, setStatusInput] = useState('')

  useEffect(() => {
    if (open && opId) fetchData()
  }, [open, opId])

  const fetchData = async () => {
    setLoading(true)
    const { data: operation } = await supabase
      .from('credit_operations')
      .select(
        '*, profiles!credit_operations_borrower_id_fkey(full_name, email, document_number, phone)',
      )
      .eq('id', opId)
      .single()
    if (operation) {
      setOp(operation)
      setStatusInput(operation.status)
      const [docsRes, calcRes, histRes] = await Promise.all([
        supabase.from('operation_documents').select('*').eq('operation_id', opId),
        supabase.from('operation_calculations').select('*').eq('operation_id', opId).maybeSingle(),
        supabase
          .from('operation_status_history')
          .select('*, changed_by:profiles!operation_status_history_changed_by_fkey(full_name)')
          .eq('operation_id', opId)
          .order('changed_at', { ascending: false }),
      ])
      setDocs(docsRes.data || [])
      setCalc(calcRes.data || null)
      setHistory(histRes.data || [])
    }
    setLoading(false)
  }

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage.from('operation-docs').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('Erro ao acessar documento.')
  }

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true)
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

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
                disabled={actionLoading || op.status === 'aprovado' || op.status === 'pago'}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange('reprovado')}
                disabled={actionLoading || op.status === 'reprovado'}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reprovar
              </Button>
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleStatusChange('pendencia_documental')}
                disabled={actionLoading || op.status === 'pendencia_documental'}
              >
                <AlertCircle className="w-4 h-4 mr-2" /> Solicitar Documento
              </Button>
              <div className="flex-1 min-w-[180px] flex gap-2 ml-auto">
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
                    {op.receivable_type.replace('_', ' ').toUpperCase()}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Cedente:</span> {op.cedente}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Sacado:</span> {op.sacado}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Vencimento:</span>{' '}
                    {format(new Date(op.due_date), 'dd/MM/yyyy')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Calc Memory */}
            <Card className="shadow-none border-primary/20 bg-muted/10">
              <CardHeader className="p-4 pb-2 bg-primary/5">
                <CardTitle className="text-sm">
                  Memória de Cálculo Financeiro (Server-side)
                </CardTitle>
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
                        Prazo Calculado: <strong>{calc.term_days} dias</strong>
                      </span>
                      <span>
                        Custo Efetivo Total (CET):{' '}
                        <strong>{calc.effective_cost_rate?.toFixed(2)}%</strong>
                      </span>
                    </div>
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
                Documentos Anexados
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
                          <p className="text-sm font-medium truncate">{d.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(d.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(d.file_path)}
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
                            {h.new_status.replace('_', ' ')}
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
  )
}
