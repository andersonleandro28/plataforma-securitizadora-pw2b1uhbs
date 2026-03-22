import { useEffect, useState } from 'react'
import { FileText, Loader2, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { getStatusBadge } from '@/components/dashboard/BorrowerOperationsList'
import { AdminOperationDetails } from '@/components/operations/AdminOperationDetails'

export default function Operations() {
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)

  const fetchOperations = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('credit_operations')
      .select('*, profiles(full_name), operation_calculations(net_value)')
      .order('created_at', { ascending: false })

    if (data) setOperations(data)
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
      op.document_number.includes(sStr) ||
      op.cedente.toLowerCase().includes(sStr) ||
      op.profiles?.full_name?.toLowerCase().includes(sStr) ||
      op.id.split('-')[0].toLowerCase().includes(sStr) // Search by short ID
    const matchStatus = statusFilter === 'all' || op.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Operações</h1>
          <p className="text-muted-foreground">
            Acompanhe e analise a esteira completa de borderôs submetidos pelos tomadores.
          </p>
        </div>
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
                    <TableHead>Data</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Tipo Ativo</TableHead>
                    <TableHead>Valor Face (VF)</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((op) => (
                    <TableRow
                      key={op.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedOpId(op.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                        #{op.id.split('-')[0].toUpperCase()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(op.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium text-sm truncate max-w-[150px]">
                        {op.profiles?.full_name || 'Desconhecido'}
                      </TableCell>
                      <TableCell className="uppercase text-xs font-semibold text-muted-foreground">
                        {op.receivable_type.replace('_', ' ')}
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

      <AdminOperationDetails
        opId={selectedOpId}
        open={!!selectedOpId}
        onOpenChange={(v: boolean) => !v && setSelectedOpId(null)}
        onRefresh={fetchOperations}
      />
    </div>
  )
}
