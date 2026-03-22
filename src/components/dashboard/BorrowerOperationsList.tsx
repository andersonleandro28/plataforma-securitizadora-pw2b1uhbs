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
import { Loader2, Search } from 'lucide-react'

export function getStatusBadge(status: string) {
  switch (status) {
    case 'pago':
    case 'liquidado':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 uppercase">{status}</Badge>
    case 'aprovado':
    case 'formalizado':
      return <Badge className="bg-blue-500 hover:bg-blue-600 uppercase">{status}</Badge>
    case 'reprovado':
    case 'cancelado':
      return (
        <Badge variant="destructive" className="uppercase">
          {status}
        </Badge>
      )
    case 'pendencia_documental':
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning-foreground uppercase">
          Pendência
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="uppercase">
          {status.replace('_', ' ')}
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

  const fetchOperations = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('credit_operations')
      .select('*, operation_calculations(net_value)')
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
      op.document_number.includes(search) ||
      op.cedente.toLowerCase().includes(search.toLowerCase()) ||
      op.sacado.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || op.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle>Histórico de Solicitações</CardTitle>
          <CardDescription>Acompanhe o status das suas antecipações.</CardDescription>
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
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="reprovado">Reprovado</SelectItem>
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
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(op.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="capitalize text-sm font-medium">
                      {op.receivable_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]" title={op.sacado}>
                      {op.sacado}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(op.face_value)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-emerald-600">
                      {op.operation_calculations?.[0]?.net_value
                        ? formatCurrency(op.operation_calculations[0].net_value)
                        : '---'}
                    </TableCell>
                    <TableCell>{getStatusBadge(op.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
