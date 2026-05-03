import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  PackageOpen,
  FileText,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV } from '@/lib/export-utils'
import { ReconcileModal } from '@/components/Treasury/ReconcileModal'
import { useAccounting } from '@/hooks/use-accounting'
import { TransactionDetailsModal } from '@/components/Treasury/TransactionDetailsModal'

export default function Accounting() {
  const { data, loading, error, refetch } = useAccounting()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [periodoInicio, setPeriodoInicio] = useState(startOfMonth)
  const [periodoFim, setPeriodoFim] = useState(endOfMonth)
  const [filtroTipo, setFiltroTipo] = useState('todas')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [isReconcileOpen, setIsReconcileOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<any>(null)

  const [activeFiltros, setActiveFiltros] = useState({
    inicio: startOfMonth,
    fim: endOfMonth,
    tipo: 'todas',
    categoria: 'todas',
    busca: '',
  })

  const itemsPerPage = 20

  useEffect(() => {
    refetch().then(() => toast.success('Dados consolidados carregados com sucesso.'))
  }, [refetch])

  const handleApplyFilters = () => {
    setActiveFiltros({
      inicio: periodoInicio,
      fim: periodoFim,
      tipo: filtroTipo,
      categoria: filtroCategoria,
      busca,
    })
    setPage(1)
  }

  const { filteredData, totalEntradas, totalSaidas, globalBalance } = useMemo(() => {
    let entradas = 0
    let saidas = 0

    const filtered = data.filter((t) => {
      const d = new Date(t.date)
      let match = true

      if (activeFiltros.inicio && d < new Date(activeFiltros.inicio + 'T00:00:00')) match = false
      if (activeFiltros.fim && d > new Date(activeFiltros.fim + 'T23:59:59')) match = false
      if (activeFiltros.tipo !== 'todas' && t.type !== activeFiltros.tipo) match = false
      if (activeFiltros.categoria !== 'todas' && t.category !== activeFiltros.categoria)
        match = false
      if (activeFiltros.busca) {
        const b = activeFiltros.busca.toLowerCase()
        if (!t.description.toLowerCase().includes(b) && !t.category.toLowerCase().includes(b)) {
          match = false
        }
      }

      if (match) {
        if (t.type === 'in') entradas += t.value
        else saidas += t.value
      }
      return match
    })

    const gBal = data.length > 0 ? data[0].accumulated_balance : 0

    return {
      filteredData: filtered,
      totalEntradas: entradas,
      totalSaidas: saidas,
      globalBalance: gBal,
    }
  }, [data, activeFiltros])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return filteredData.slice(start, start + itemsPerPage)
  }, [filteredData, page])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleExportCSV = () => {
    const exportData = filteredData.map((t) => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Tipo: t.type === 'in' ? 'Entrada' : 'Saída',
      Categoria: t.category,
      Descrição: t.description,
      Valor: t.value,
      'Saldo Acumulado': t.accumulated_balance,
    }))
    exportToCSV(exportData, `Livro_Caixa_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handlePrintPDF = () => {
    window.print()
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={refetch} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Home &gt; Contabilidade</div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidade — Livro Caixa</h1>
          <p className="text-muted-foreground">
            Visão consolidada direta das fontes primárias de dados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={handlePrintPDF} variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button onClick={() => setIsReconcileOpen(true)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Reconciliar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Total Entradas (Mês/Período) <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalEntradas)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Total Saídas (Mês/Período) <TrendingDown className="w-4 h-4 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-rose-600">-{formatCurrency(totalSaidas)}</div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${totalEntradas - totalSaidas >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Fluxo Líquido (Mês/Período)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div
                className={`text-2xl font-bold ${totalEntradas - totalSaidas >= 0 ? 'text-blue-600' : 'text-orange-600'}`}
              >
                {formatCurrency(totalEntradas - totalSaidas)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary border-l-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex justify-between">
              Saldo Acumulado (Global) <DollarSign className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-primary">{formatCurrency(globalBalance)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="grid gap-1 flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-muted-foreground">Busca</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Data Inicial</span>
            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Data Final</span>
            <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Tipo</span>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="in">Entradas</SelectItem>
                <SelectItem value="out">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Categoria</span>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Pagamento de Parcela CCB">Pagamento de Parcela CCB</SelectItem>
                <SelectItem value="Liquidação de Recebível">Liquidação de Recebível</SelectItem>
                <SelectItem value="Subscrição de Debênture">Subscrição de Debênture</SelectItem>
                <SelectItem value="Despesa">Despesa</SelectItem>
                <SelectItem value="Pagamento Fornecedor">Pagamento Fornecedor</SelectItem>
                <SelectItem value="Aquisição de CCB">Aquisição de CCB</SelectItem>
                <SelectItem value="Desembolso de Crédito">Desembolso de Crédito</SelectItem>
                <SelectItem value="Resgate de Investimento">Resgate de Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApplyFilters}>Aplicar Filtros</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <PackageOpen className="w-12 h-12 text-muted-foreground/50" />
                        <p>Nenhuma movimentação encontrada para os filtros selecionados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTx(t)}
                    >
                      <TableCell className="whitespace-nowrap font-medium text-sm">
                        {new Date(t.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                        >
                          {t.type === 'in' ? 'ENTRADA' : 'SAÍDA'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{t.category}</TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[300px] truncate"
                        title={t.description}
                      >
                        {t.description}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {t.type === 'in' ? '+' : '-'}
                        {formatCurrency(t.value)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground font-medium">
                        {formatCurrency(t.accumulated_balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && totalPages > 1 && (
            <div className="p-4 flex items-center justify-between border-t">
              <span className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * itemsPerPage + 1} até{' '}
                {Math.min(page * itemsPerPage, filteredData.length)} de {filteredData.length}{' '}
                registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ReconcileModal
        open={isReconcileOpen}
        onClose={setIsReconcileOpen}
        currentBalance={globalBalance}
        onSuccess={refetch}
      />
      <TransactionDetailsModal
        tx={selectedTx}
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  )
}
