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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Loader2,
  Search,
  PenTool,
  CheckCircle2,
  Eye,
  FileSignature,
  Percent,
  Info,
} from 'lucide-react'

// Utilizando cores padrão financeiro: Verde (Aprovado/Pago), Amarelo (Análise/Pendência), Vermelho (Reprovado).
export function getStatusBadge(status?: string | null) {
  const safeStatus = status || 'enviado'
  switch (safeStatus) {
    case 'pago':
    case 'liquidado':
    case 'aprovado':
    case 'formalizado':
    case 'aguardando_formalizacao':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white uppercase">
          {safeStatus.replace('_', ' ')}
        </Badge>
      )
    case 'reprovado':
    case 'cancelado':
      return (
        <Badge variant="destructive" className="uppercase">
          {safeStatus.replace('_', ' ')}
        </Badge>
      )
    case 'em_analise':
    case 'pendencia_documental':
    case 'em_triagem':
      return (
        <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white uppercase">
          {safeStatus.replace('_', ' ')}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="uppercase">
          {safeStatus.replace('_', ' ')}
        </Badge>
      )
  }
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function BorrowerOperationsList() {
  const { user } = useAuth()
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [signModalOpen, setSignModalOpen] = useState(false)
  const [opToSign, setOpToSign] = useState<any>(null)
  const [signLoading, setSignLoading] = useState(false)
  const [detailsOp, setDetailsOp] = useState<any>(null)

  const fetchOperations = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('credit_operations')
      .select('*, operation_calculations(*)')
      .eq('borrower_id', user?.id)
      .order('created_at', { ascending: false })
    if (data) setOperations(data)
    setLoading(false)
  }

  useEffect(() => {
    if (user) fetchOperations()
  }, [user])

  const filtered = operations.filter((op) => {
    const matchSearch =
      op.document_number?.toLowerCase().includes(search.toLowerCase()) ||
      op.cedente?.toLowerCase().includes(search.toLowerCase()) ||
      op.sacado?.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      statusFilter === 'all' ||
      op.status === statusFilter ||
      (statusFilter === 'pago' && (op.status === 'pago' || op.status === 'liquidado'))
    return matchSearch && matchStatus
  })

  const handleSignClick = (op: any) => {
    setOpToSign(op)
    setSignModalOpen(true)
  }

  const confirmSign = async () => {
    setSignLoading(true)
    try {
      const { error } = await supabase.functions.invoke('signature-webhook', {
        body: { envelope_id: opToSign.signature_envelope_id, status: 'assinado' },
      })
      if (error) throw error
      toast.success('Documento assinado com sucesso!')
      setSignModalOpen(false)
      fetchOperations()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar assinatura.')
    } finally {
      setSignLoading(false)
    }
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle>Minhas Solicitações e Assinaturas</CardTitle>
            <CardDescription>
              Acompanhe o status e formalize suas antecipações pendentes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar borderô..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="aguardando_formalizacao">Formalização</SelectItem>
                <SelectItem value="pago">Pago / Liquidado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              Nenhuma operação encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead>Valor Face</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status Operação</TableHead>
                    <TableHead className="text-center">Condições</TableHead>
                    <TableHead>Ações / Formalização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((op) => {
                    const calc = op.operation_calculations?.[0]
                    const isRatesEdited =
                      !!calc?.calculation_memory?.applied_params?.is_custom_admin_rate

                    return (
                      <TableRow
                        key={op.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setDetailsOp(op)}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(op.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="capitalize text-sm font-medium">
                          {op.receivable_type?.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]" title={op.sacado}>
                          {op.sacado}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCurrency(op.face_value)}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium text-emerald-600">
                          {calc?.net_value ? formatCurrency(calc.net_value) : '---'}
                        </TableCell>
                        <TableCell>{getStatusBadge(op.status)}</TableCell>
                        <TableCell className="text-center">
                          {isRatesEdited ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 gap-1 text-[10px] font-medium"
                            >
                              <Percent className="w-2.5 h-2.5" /> Proposta Editada
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {op.signature_status === 'enviado' ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSignClick(op)
                                }}
                              >
                                <PenTool className="w-3.5 h-3.5 mr-1" /> Assinar Aditivo
                              </Button>
                            ) : op.signature_status === 'assinado' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-none">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Documento Assinado
                              </Badge>
                            ) : op.signature_status === 'visualizado' ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <Eye className="w-3 h-3 mr-1" /> Em Análise Pelo Signatário
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-primary gap-1"
                                onClick={() => setDetailsOp(op)}
                              >
                                <Info className="w-3 h-3" /> Ver Detalhes
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={signModalOpen} onOpenChange={setSignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura Digital de Aditivo</DialogTitle>
            <DialogDescription>
              Você está prestes a assinar o Aditivo de Cessão referente à operação #
              {opToSign?.id?.split('-')[0]?.toUpperCase()}. Esta interface simula a integração com
              provedores de assinatura (ex: ClickSign/DocuSign).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="p-4 border border-dashed rounded-lg bg-muted/30 text-center space-y-3 w-full">
              <FileSignature className="w-10 h-10 text-primary mx-auto opacity-50" />
              <p className="text-sm font-medium">Documento pronto para assinatura</p>
              <p className="text-xs text-muted-foreground">
                Ao clicar em confirmar, você atesta a validade da operação e seu IP, Hash do
                documento e Timestamp serão registrados legalmente em nossa trilha de auditoria.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSignModalOpen(false)}
              disabled={signLoading}
            >
              Cancelar
            </Button>
            <Button onClick={confirmSign} disabled={signLoading}>
              {signLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Assinatura Digital
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Proposta para o Tomador */}
      <Dialog open={!!detailsOp} onOpenChange={(v) => !v && setDetailsOp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-lg pr-4">
              <span>Detalhes da Solicitação</span>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                #{detailsOp?.id?.split('-')[0]?.toUpperCase()}
              </span>
            </DialogTitle>
            <DialogDescription>
              Resumo dos valores, prazos e condições financeiras aplicadas pela mesa.
            </DialogDescription>
          </DialogHeader>

          {detailsOp && (
            <div className="space-y-4 py-2">
              {detailsOp.operation_calculations?.[0]?.calculation_memory?.applied_params
                ?.is_custom_admin_rate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                    <Percent className="w-4 h-4 text-amber-600" />
                    <span>Proposta com Condições Especiais da Mesa</span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                    As taxas desta proposta foram personalizadas pela mesa de operações em{' '}
                    {detailsOp.operation_calculations[0].calculation_memory.applied_params
                      .rates_updated_at
                      ? format(
                          new Date(
                            detailsOp.operation_calculations[0].calculation_memory.applied_params
                              .rates_updated_at,
                          ),
                          'dd/MM/yyyy HH:mm',
                        )
                      : 'revisão recente'}
                    .
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Sacado:</span>
                  <strong className="text-foreground">{detailsOp.sacado}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Tipo de Ativo:</span>
                  <strong className="text-foreground uppercase">
                    {detailsOp.receivable_type?.replace('_', ' ')}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Vencimento:</span>
                  <strong className="text-foreground">
                    {detailsOp.due_date
                      ? format(new Date(detailsOp.due_date + 'T00:00:00'), 'dd/MM/yyyy')
                      : '-'}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Status:</span>
                  {getStatusBadge(detailsOp.status)}
                </div>
              </div>

              {detailsOp.operation_calculations?.[0] ? (
                <div className="p-3 bg-card rounded-lg border space-y-2 text-xs">
                  <h4 className="font-semibold text-xs text-primary uppercase tracking-wider">
                    Memória Financeira Liberada
                  </h4>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valor de Face (VF):</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(detailsOp.face_value)}
                    </span>
                  </div>
                  <div className="flex justify-between text-destructive text-[11px]">
                    <span>Deságio / Juros:</span>
                    <span className="font-mono">
                      -
                      {formatCurrency(
                        (detailsOp.operation_calculations[0].discount_value || 0) +
                          (detailsOp.operation_calculations[0].interest_value || 0),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-destructive text-[11px]">
                    <span>Custos Operacionais &amp; Tarifas:</span>
                    <span className="font-mono">
                      -
                      {formatCurrency(
                        (detailsOp.operation_calculations[0].ad_valorem_value || 0) +
                          (detailsOp.operation_calculations[0].structuring_value || 0) +
                          (detailsOp.operation_calculations[0].analysis_value || 0),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-destructive text-[11px]">
                    <span>IOF Total (Fixo + Diário):</span>
                    <span className="font-mono">
                      -
                      {formatCurrency(
                        (detailsOp.operation_calculations[0].iof_fixed_value || 0) +
                          (detailsOp.operation_calculations[0].iof_daily_value || 0),
                      )}
                    </span>
                  </div>
                  <div className="border-t my-1.5" />
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                        Valor Líquido a Receber
                      </span>
                      <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(detailsOp.operation_calculations[0].net_value)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">
                        Custo Efetivo Total
                      </span>
                      <span className="font-bold text-sm">
                        {detailsOp.operation_calculations[0].effective_cost_rate?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded">
                  Cálculo ainda não processado para esta proposta.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOp(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
