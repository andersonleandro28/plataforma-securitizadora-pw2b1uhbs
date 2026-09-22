import { useEffect, useState } from 'react'
import {
  FileText,
  Loader2,
  Search,
  Filter,
  Mail,
  Eye,
  CheckCircle2,
  XCircle,
  PenTool,
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
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Plus, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStatusBadge } from '@/components/dashboard/BorrowerOperationsList'
import { AdminOperationDetails } from '@/components/operations/AdminOperationDetails'
import { AdminNewOperationDialog } from '@/components/operations/AdminNewOperationDialog'
import { AdminEditRatesDialog } from '@/components/operations/AdminEditRatesDialog'
import { useAuth } from '@/hooks/use-auth'

export default function Operations() {
  const { profile, activeRole, user, isLoadingProfile } = useAuth()
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)
  const [newOpOpen, setNewOpOpen] = useState(false)
  const [editingRatesOp, setEditingRatesOp] = useState<any | null>(null)
  const [deleteTargetOp, setDeleteTargetOp] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Align permission criteria with RoleGuard and other admin screens
  const isSuperAdmin = user?.email === 'andersonleandro28@gmail.com'
  const isAdmin =
    profile?.is_admin || profile?.role === 'admin' || activeRole === 'admin' || isSuperAdmin
  const isStaff = profile?.is_staff || profile?.role === 'staff' || activeRole === 'staff'
  const canCreateOperation = !isLoadingProfile && (isAdmin || isStaff)

  const fetchOperations = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('credit_operations')
      .select('*, profiles(full_name), operation_calculations(*)')
      .order('issue_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (data) {
      // Ordenação em memória garantindo fallback de issue_date nulo para created_at
      const sorted = [...data].sort((a, b) => {
        const dateA = a.issue_date
          ? new Date(a.issue_date + 'T00:00:00').getTime()
          : new Date(a.created_at).getTime()
        const dateB = b.issue_date
          ? new Date(b.issue_date + 'T00:00:00').getTime()
          : new Date(b.created_at).getTime()

        if (dateB !== dateA) {
          return dateB - dateA // mais recente primeiro
        }

        // Desempate por created_at desc
        const createdA = new Date(a.created_at).getTime()
        const createdB = new Date(b.created_at).getTime()
        return createdB - createdA
      })
      setOperations(sorted)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOperations()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const filtered = operations.filter((op) => {
    const sStr = search.toLowerCase()
    const matchSearch =
      op.document_number?.toLowerCase().includes(sStr) ||
      op.cedente?.toLowerCase().includes(sStr) ||
      op.profiles?.full_name?.toLowerCase().includes(sStr) ||
      op.id?.split('-')[0]?.toLowerCase().includes(sStr) ||
      false // Search by short ID
    const matchStatus =
      statusFilter === 'all' ||
      op.status === statusFilter ||
      (statusFilter === 'pago' && (op.status === 'pago' || op.status === 'liquidado'))
    return matchSearch && matchStatus
  })

  const handleDeleteCancelled = async () => {
    if (!deleteTargetOp || deleteTargetOp.status !== 'cancelado') return
    setDeleting(true)
    try {
      const { error } = await (supabase.rpc as any)('delete_cancelled_credit_operation', {
        p_operation_id: deleteTargetOp.id,
      })

      if (error) throw error

      toast.success(
        `Operação #${deleteTargetOp.id?.split('-')[0]?.toUpperCase()} (${deleteTargetOp.sacado || 'Sacado'}) excluída com sucesso.`,
      )
      setDeleteTargetOp(null)
      fetchOperations()
    } catch (err: any) {
      console.error('Delete cancelled op error:', err)
      toast.error(err.message || 'Erro ao excluir operação cancelada.')
    } finally {
      setDeleting(false)
    }
  }

  const getSignatureIcon = (status: string) => {
    switch (status) {
      case 'enviado':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-full bg-blue-100 text-blue-600">
                <Mail className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Enviado para assinatura</TooltipContent>
          </Tooltip>
        )
      case 'visualizado':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-full bg-amber-100 text-amber-600">
                <Eye className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Visualizado pelo cliente</TooltipContent>
          </Tooltip>
        )
      case 'assinado':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Assinado digitalmente</TooltipContent>
          </Tooltip>
        )
      case 'recusado':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-full bg-destructive/10 text-destructive">
                <XCircle className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Recusado pelo signatário</TooltipContent>
          </Tooltip>
        )
      default:
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-full bg-muted text-muted-foreground/60">
                <PenTool className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Pendente de emissão</TooltipContent>
          </Tooltip>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Operações</h1>
          <p className="text-muted-foreground">
            Acompanhe e analise a esteira completa de borderôs submetidos pelos tomadores.
          </p>
        </div>
        {canCreateOperation && (
          <Button onClick={() => setNewOpOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Lançar Operação
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Fila de Borderôs
            </CardTitle>
            <CardDescription>Fluxo de aquisição e aprovação de recebíveis.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ID, sacado, tomador..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="enviado">Novos (Enviados)</SelectItem>
                <SelectItem value="em_triagem">Em Triagem</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="pendencia_documental">Com Pendência</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="aguardando_formalizacao">Formalizando</SelectItem>
                <SelectItem value="pago">Pagos / Liquidados</SelectItem>
                <SelectItem value="reprovado">Reprovados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
              <p className="text-lg font-medium mb-2">Nenhuma operação na fila.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Data Operação</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Tipo Ativo</TableHead>
                    <TableHead>Valor Face (VF)</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Taxas</TableHead>
                    <TableHead className="text-center">Formalização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((op) => {
                    const calc = op.operation_calculations?.[0]
                    const isRatesEdited =
                      !!calc?.calculation_memory?.applied_params?.is_custom_admin_rate
                    const canEditRates =
                      op.status !== 'liquidado' && op.status !== 'pago' && op.status !== 'cancelado'
                    const isCancelled = op.status === 'cancelado'

                    return (
                      <TableRow
                        key={op.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedOpId(op.id)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                          #{op.id?.split('-')[0]?.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {op.issue_date ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {format(new Date(op.issue_date + 'T00:00:00'), 'dd/MM/yyyy')}
                              </span>
                              <span className="text-[10px] text-muted-foreground/75">
                                Reg: {format(new Date(op.created_at), 'dd/MM/yy HH:mm')}
                              </span>
                            </div>
                          ) : (
                            format(new Date(op.created_at), 'dd/MM/yyyy HH:mm')
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm truncate max-w-[150px]">
                          {op.profiles?.full_name || 'Desconhecido'}
                        </TableCell>
                        <TableCell className="uppercase text-xs font-semibold text-muted-foreground">
                          {op.receivable_type?.replace('_', ' ')}
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
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                              <Percent className="w-2.5 h-2.5" /> Editadas
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {getSignatureIcon(op.signature_status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {canEditRates && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => setEditingRatesOp(op)}
                                title="Alterar Taxas e Juros da Proposta"
                              >
                                <Percent className="w-3 h-3" /> Alterar Taxas
                              </Button>
                            )}
                            {isCancelled && (canCreateOperation || isAdmin) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs gap-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground"
                                onClick={() => setDeleteTargetOp(op)}
                                title="Excluir Operação Cancelada"
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
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

      <AdminOperationDetails
        opId={selectedOpId}
        open={!!selectedOpId}
        onOpenChange={(v: boolean) => !v && setSelectedOpId(null)}
        onRefresh={fetchOperations}
      />

      <AdminNewOperationDialog
        open={newOpOpen}
        onOpenChange={setNewOpOpen}
        onSuccess={fetchOperations}
      />

      {editingRatesOp && (
        <AdminEditRatesDialog
          open={!!editingRatesOp}
          onOpenChange={(v) => !v && setEditingRatesOp(null)}
          operation={editingRatesOp}
          currentCalc={editingRatesOp.operation_calculations?.[0]}
          onSuccess={() => {
            fetchOperations()
            setEditingRatesOp(null)
          }}
        />
      )}

      {/* Confirmação de exclusão rápida na linha da tabela */}
      <AlertDialog
        open={!!deleteTargetOp}
        onOpenChange={(v) => {
          if (!v && !deleting) setDeleteTargetOp(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Excluir operação cancelada?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span>
                Você está prestes a excluir permanentemente a operação{' '}
                <strong className="text-foreground">
                  #{deleteTargetOp?.id?.split('-')[0]?.toUpperCase()}
                </strong>{' '}
                do sacado{' '}
                <strong className="text-foreground">
                  {deleteTargetOp?.sacado || 'Não informado'}
                </strong>
                {deleteTargetOp?.document_number ? ` (Doc: ${deleteTargetOp.document_number})` : ''}
                .
              </span>
              <span className="block text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                Atenção: Esta ação é definitiva e removerá a operação e seus arquivos auxiliares. A
                ação é registrada em auditoria e bloqueada caso haja histórico financeiro vinculado.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteCancelled()
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
    </div>
  )
}
