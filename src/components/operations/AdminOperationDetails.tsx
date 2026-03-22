import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, Download, ArrowRight, User, FileText, CheckCircle2, XCircle } from 'lucide-react'

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
      toast.success('Status atualizado.')
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
          <SheetTitle>Detalhes da Operação</SheetTitle>
          <SheetDescription>Análise e gestão do borderô.</SheetDescription>
        </SheetHeader>

        {loading || !op ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleStatusChange('aprovado')}
                disabled={actionLoading}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange('reprovado')}
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('pendencia_documental')}
                disabled={actionLoading}
              >
                Solicitar Docs
              </Button>
              <div className="flex-1 min-w-[200px] flex gap-2 ml-auto">
                <Select
                  value={statusInput}
                  onValueChange={(v) => {
                    setStatusInput(v)
                    handleStatusChange(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mudar Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="em_triagem">Em Triagem</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="pendencia_documental">Pendência</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                    <SelectItem value="aguardando_formalizacao">Formalizando</SelectItem>
                    <SelectItem value="formalizado">Formalizado</SelectItem>
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
                    <User className="w-4 h-4" /> Tomador
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
                    <FileText className="w-4 h-4" /> Título
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-1 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Tipo:</span> {op.receivable_type}
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
            <Card className="shadow-none border-primary/20">
              <CardHeader className="p-4 pb-2 bg-primary/5">
                <CardTitle className="text-sm">Memória de Cálculo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Valor de Face</span>
                  <span className="font-mono">{formatCurrency(op.face_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Solicitado</span>
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
                      <span>Ad Valorem</span>
                      <span>-{formatCurrency(calc.ad_valorem_value)}</span>
                    </div>
                    <div className="flex justify-between text-destructive text-xs">
                      <span>Taxas (Estrut. / Análise)</span>
                      <span>-{formatCurrency(calc.structuring_value + calc.analysis_value)}</span>
                    </div>
                    <div className="flex justify-between text-destructive text-xs">
                      <span>Impostos (IOF)</span>
                      <span>-{formatCurrency(calc.iof_fixed_value + calc.iof_daily_value)}</span>
                    </div>
                    <div className="border-t my-2" />
                    <div className="flex justify-between font-semibold text-base">
                      <span>Líquido Liberado</span>
                      <span className="text-emerald-600 font-mono">
                        {formatCurrency(calc.net_value)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-right">
                      Custo Efetivo: {calc.effective_cost_rate?.toFixed(2)}% | Prazo:{' '}
                      {calc.term_days} dias
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Cálculo não processado ou pendente.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <div>
              <h4 className="font-medium text-sm mb-3">Documentos Anexados</h4>
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum documento.</p>
                ) : (
                  docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2 border rounded text-sm bg-muted/10"
                    >
                      <span className="truncate flex-1">{d.file_name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(d.file_path)}
                        className="h-7 w-7 p-0 shrink-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-medium text-sm mb-3">Histórico de Status</h4>
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                      {i !== history.length - 1 && <div className="w-px h-full bg-border my-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="font-medium uppercase text-xs">
                        {h.new_status.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.changed_at), 'dd/MM/yyyy HH:mm')} -{' '}
                        {h.changed_by?.full_name || 'Sistema'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
