import { useState, useMemo } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Search,
  XCircle,
  FileText,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

export interface InvestorRedemptionItem {
  id: string
  created_at: string
  updated_at?: string | null
  requested_quotas: number
  gross_value: number
  net_value: number
  penalty_applied: number
  discount_applied: number
  tax_amount: number
  tax_rate: number
  yield_amount: number
  status: string
  rejection_reason?: string | null
  is_reinvestment?: boolean
  investments?: {
    id: string
    unit_price?: number
    transfer_date?: string
    created_at?: string
    investment_products?: {
      title?: string
      rate?: string
      type?: string
    }
  }
}

interface InvestorRedemptionStatementProps {
  redemptions: InvestorRedemptionItem[]
  loading?: boolean
  onRefresh?: () => void
  onOpenNewRedemption?: () => void
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export function InvestorRedemptionStatement({
  redemptions,
  loading = false,
  onRefresh,
  onOpenNewRedemption,
}: InvestorRedemptionStatementProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRedemptions = useMemo(() => {
    return redemptions.filter((item) => {
      // Filtro de status
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && item.status !== 'pending') return false
        if (statusFilter === 'approved' && item.status !== 'approved') return false
        if (statusFilter === 'paid' && item.status !== 'paid') return false
        if (statusFilter === 'rejected' && item.status !== 'rejected') return false
      }

      // Busca por título do produto
      if (searchTerm.trim()) {
        const prodTitle = item.investments?.investment_products?.title?.toLowerCase() || ''
        const reason = item.rejection_reason?.toLowerCase() || ''
        const term = searchTerm.toLowerCase().trim()
        if (!prodTitle.includes(term) && !reason.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [redemptions, statusFilter, searchTerm])

  // Métricas de resumo
  const summary = useMemo(() => {
    let totalGross = 0
    let totalNet = 0
    let totalTax = 0
    let totalPaid = 0
    let totalPending = 0

    redemptions.forEach((r) => {
      const gross = Number(r.gross_value) || 0
      const net = Number(r.net_value) || 0
      const tax = Number(r.tax_amount) || 0

      if (r.status === 'paid') {
        totalPaid += net
        totalGross += gross
        totalNet += net
        totalTax += tax
      } else if (r.status === 'pending' || r.status === 'approved') {
        totalPending += net
      }
    })

    return {
      totalPaid,
      totalPending,
      totalGross,
      totalNet,
      totalTax,
      count: redemptions.length,
    }
  }, [redemptions])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
            <CheckCircle2 className="w-3 h-3" /> Pago / Liquidado
          </Badge>
        )
      case 'approved':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1">
            <Clock className="w-3 h-3" /> Aprovado (Em Liquidação)
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" /> Reprovado
          </Badge>
        )
      case 'pending':
      default:
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 gap-1"
          >
            <Clock className="w-3 h-3 text-amber-600" /> Pendente de Análise
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumo Rápido do Extrato */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Resgatado e Pago
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {formatCurrency(summary.totalPaid)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Valores líquidos já creditados em seu saldo
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Saques em Processamento
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary.totalPending)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Solicitações pendentes ou em fase de liquidação
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total de Solicitações
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">{summary.count}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Histórico completo de saques registrados
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="paid">Pagos / Liquidados</SelectItem>
              <SelectItem value="rejected">Reprovados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Tabela de Extrato de Resgates */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Histórico das Solicitações de Resgate</CardTitle>
              <CardDescription>
                Acompanhe o status e os valores de cada pedido de saque efetuado.
              </CardDescription>
            </div>
            {onOpenNewRedemption && (
              <Button size="sm" onClick={onOpenNewRedemption} className="gap-1.5">
                <DollarSign className="w-4 h-4" /> Novo Resgate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Investimento / Produto</TableHead>
                  <TableHead className="text-center">Cotas</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Penalidade / Deságio</TableHead>
                  <TableHead className="text-right">IRRF</TableHead>
                  <TableHead className="text-right">Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processado Em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRedemptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <FileText className="w-8 h-8 opacity-40 mb-1" />
                        <span className="font-medium">Nenhum resgate encontrado</span>
                        <span className="text-xs">
                          {redemptions.length === 0
                            ? 'Você ainda não possui solicitações de resgate registradas.'
                            : 'Nenhum registro corresponde aos filtros selecionados.'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRedemptions.map((red) => {
                    const penalty =
                      Number(red.penalty_applied || 0) + Number(red.discount_applied || 0)
                    const tax = Number(red.tax_amount || 0)
                    const isPaid = red.status === 'paid'

                    return (
                      <TableRow key={red.id} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                          {formatDate(red.created_at)}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs sm:text-sm">
                            {red.investments?.investment_products?.title || 'Investimento'}
                          </div>
                          {red.investments?.investment_products?.rate && (
                            <span className="text-[11px] text-muted-foreground">
                              Taxa: {red.investments.investment_products.rate}
                            </span>
                          )}
                          {red.is_reinvestment && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                            >
                              Reinvestimento
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center font-mono font-medium text-xs sm:text-sm">
                          {red.requested_quotas}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs sm:text-sm">
                          {formatCurrency(red.gross_value)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs sm:text-sm text-rose-600">
                          {penalty > 0 ? `- ${formatCurrency(penalty)}` : '-'}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                          {tax > 0 ? (
                            <div>
                              <span>- {formatCurrency(tax)}</span>
                              {red.tax_rate > 0 && (
                                <span className="block text-[10px] text-muted-foreground">
                                  ({red.tax_rate}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-xs sm:text-sm text-emerald-600">
                          {formatCurrency(red.net_value)}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {getStatusBadge(red.status)}
                          {red.status === 'rejected' && red.rejection_reason && (
                            <p
                              className="text-[11px] text-muted-foreground mt-1 max-w-[180px] line-clamp-1"
                              title={red.rejection_reason}
                            >
                              Motivo: {red.rejection_reason}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {isPaid || red.status === 'approved'
                            ? formatDate(red.updated_at || red.created_at)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
