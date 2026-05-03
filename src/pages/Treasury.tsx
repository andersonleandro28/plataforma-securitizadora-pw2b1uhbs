import { useState, useEffect } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { exportToCSV } from '@/lib/export-utils'
import { TransactionDetailsModal } from '@/components/Treasury/TransactionDetailsModal'
import { ReconcileModal } from '@/components/Treasury/ReconcileModal'
import { Skeleton } from '@/components/ui/skeleton'

export default function Treasury() {
  const [stats, setStats] = useState({ saldo: 0, entradas: 0, saidas: 0, fluxo: 0 })
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', type: 'all', category: 'all' })

  const [selectedTx, setSelectedTx] = useState(null)
  const [isReconcileOpen, setIsReconcileOpen] = useState(false)

  const fetchDashboard = async () => {
    const { data: saldoData } = await supabase
      .from('saldo_caixa')
      .select('saldo_atual')
      .limit(1)
      .maybeSingle()

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { data: monthData } = await supabase
      .from('movimentacoes_caixa')
      .select('tipo, valor')
      .gte('created_at', startOfMonth)

    let entradas = 0,
      saidas = 0
    monthData?.forEach((m) => {
      if (m.tipo === 'entrada') entradas += Number(m.valor)
      if (m.tipo === 'saída') saidas += Number(m.valor)
    })

    setStats({
      saldo: Number(saldoData?.saldo_atual || 0),
      entradas,
      saidas,
      fluxo: entradas - saidas,
    })
  }

  const fetchMovimentacoes = async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from('movimentacoes_caixa').select('*', { count: 'exact' })

      if (filters.type !== 'all') query = query.eq('tipo', filters.type)
      if (filters.category !== 'all') query = query.eq('categoria', filters.category)
      if (filters.dateFrom)
        query = query.gte('created_at', new Date(filters.dateFrom + 'T00:00:00Z').toISOString())
      if (filters.dateTo)
        query = query.lte('created_at', new Date(filters.dateTo + 'T23:59:59Z').toISOString())

      const from = (page - 1) * 20
      const to = from + 19
      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error: err } = await query
      if (err) throw err

      setMovimentacoes(data || [])
      setTotalCount(count || 0)
    } catch (err: any) {
      setError('Erro ao carregar movimentações: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  useEffect(() => {
    fetchMovimentacoes()
  }, [page])

  const formatC = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const applyFilters = () => {
    setPage(1)
    fetchMovimentacoes()
    toast.success('Filtros aplicados')
  }

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', type: 'all', category: 'all' })
    setPage(1)
    setTimeout(() => fetchMovimentacoes(), 50)
  }

  const buildExportQuery = () => {
    let query = supabase
      .from('movimentacoes_caixa')
      .select('*')
      .order('created_at', { ascending: false })
    if (filters.type !== 'all') query = query.eq('tipo', filters.type)
    if (filters.category !== 'all') query = query.eq('categoria', filters.category)
    if (filters.dateFrom)
      query = query.gte('created_at', new Date(filters.dateFrom + 'T00:00:00Z').toISOString())
    if (filters.dateTo)
      query = query.lte('created_at', new Date(filters.dateTo + 'T23:59:59Z').toISOString())
    return query
  }

  const handleExportCSV = async () => {
    const { data } = await buildExportQuery()
    if (!data || data.length === 0) return toast.info('Nenhuma movimentação para exportar')

    const csvData = data.map((m) => ({
      Data: new Date(m.created_at).toLocaleString('pt-BR'),
      Tipo: m.tipo,
      Categoria: m.categoria,
      Descricao: m.descricao,
      Referencia: m.referencia_numero || m.referencia_id || '',
      Valor: m.valor,
      Saldo: m.saldo_novo,
    }))
    exportToCSV(csvData, `Livro_Caixa_${new Date().getTime()}.csv`)
  }

  const handleExportPDF = async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return toast.error('Permita popups para gerar o relatório')

    const { data } = await buildExportQuery().order('created_at', { ascending: true })
    const list = data || []

    let totIn = 0
    let totOut = 0
    list.forEach((m) => {
      if (m.tipo === 'entrada') totIn += Number(m.valor)
      if (m.tipo === 'saída') totOut += Number(m.valor)
    })

    const initialBalance = list.length > 0 ? list[0].saldo_anterior : 0
    const finalBalance = list.length > 0 ? list[list.length - 1].saldo_novo : 0

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Livro Caixa - Relatório</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
          .summary-card { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
          .summary-card span { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; }
          .summary-card strong { display: block; font-size: 18px; margin-top: 5px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; text-transform: uppercase; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .in { color: #16a34a; font-weight: 500; }
          .out { color: #dc2626; font-weight: 500; }
          .right { text-align: right; }
          .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Livro Caixa - Plataforma Securitizadora</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
              Período: ${filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00Z').toLocaleDateString('pt-BR') : 'Início'} até ${filters.dateTo ? new Date(filters.dateTo + 'T23:59:59Z').toLocaleDateString('pt-BR') : 'Hoje'}
            </p>
          </div>
        </div>
        <div class="summary">
          <div class="summary-card"><span>Saldo Inicial do Período</span><strong>${formatC(initialBalance)}</strong></div>
          <div class="summary-card"><span>Total Entradas</span><strong class="in">${formatC(totIn)}</strong></div>
          <div class="summary-card"><span>Total Saídas</span><strong class="out">${formatC(totOut)}</strong></div>
          <div class="summary-card"><span>Saldo Final do Período</span><strong>${formatC(finalBalance)}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th class="right">Valor</th><th class="right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map(
                (m: any) => `
              <tr>
                <td>${new Date(m.created_at).toLocaleString('pt-BR')}</td>
                <td class="${m.tipo === 'entrada' ? 'in' : 'out'}">${m.tipo.toUpperCase()}</td>
                <td style="text-transform: capitalize;">${m.categoria.replace('_', ' ')}</td>
                <td>${m.descricao}</td>
                <td class="right ${m.tipo === 'entrada' ? 'in' : 'out'}">${formatC(m.valor)}</td>
                <td class="right"><strong>${formatC(m.saldo_novo)}</strong></td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        <div class="footer">Gerado digitalmente em ${new Date().toLocaleString('pt-BR')} por Plataforma Securitizadora.<br>Documento com validade para conferência interna.</div>
        <script>window.onload = function() { window.print(); }; window.onafterprint = function() { window.close(); };</script>
      </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Home &gt; Tesouraria</p>
          <h1 className="text-3xl font-bold tracking-tight">Tesouraria — Livro Caixa</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={() => setIsReconcileOpen(true)}>
            <Scale className="w-4 h-4 mr-2" /> Reconciliar Saldo
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Saldo Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatC(stats.saldo)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center">
              <ArrowDownRight className="w-4 h-4 mr-1" /> Entradas (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatC(stats.entradas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Saídas (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatC(stats.saidas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center">
              <Scale className="w-4 h-4 mr-1" /> Fluxo Líquido (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatC(stats.fluxo)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center">
            <div className="grid grid-cols-2 md:flex gap-2 w-full lg:w-auto flex-1">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full"
                title="Data Início"
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full"
                title="Data Fim"
              />
              <Select
                value={filters.type}
                onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saída">Saídas</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.category}
                onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  <SelectItem value="subscrição_debênture">Subscrição Debênture</SelectItem>
                  <SelectItem value="liquidação_recebível">Liquidação Recebível</SelectItem>
                  <SelectItem value="pagamento_ccb">Pagamento CCB</SelectItem>
                  <SelectItem value="depósito">Depósito</SelectItem>
                  <SelectItem value="juros_entrada">Juros Entrada</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="aquisição_ccb">Aquisição CCB</SelectItem>
                  <SelectItem value="aquisição_recebível">Aquisição Recebível</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="juros_saída">Juros Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 w-full lg:w-auto">
              <Button variant="ghost" onClick={clearFilters} className="flex-1 lg:flex-none">
                Limpar Filtros
              </Button>
              <Button onClick={applyFilters} className="flex-1 lg:flex-none">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="text-center text-rose-500 py-12 flex flex-col items-center">
              <p className="mb-4">{error}</p>
              <Button onClick={fetchMovimentacoes} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 flex flex-col items-center">
              <Inbox className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Nenhuma movimentação encontrada</p>
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Limpar Filtros
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right pr-6">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedTx(m)}
                    >
                      <TableCell className="whitespace-nowrap text-xs pl-6">
                        {new Date(m.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${m.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                        >
                          {m.tipo}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {m.categoria.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs" title={m.descricao}>
                        {m.descricao}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.referencia_numero || m.referencia_id?.split('-')[0] || '-'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {m.tipo === 'entrada' ? '+' : '-'} {formatC(m.valor)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium pr-6">
                        {formatC(m.saldo_novo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && movimentacoes.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t gap-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {Math.min(totalCount, (page - 1) * 20 + movimentacoes.length)} de{' '}
                {totalCount} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= totalCount}
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailsModal
        tx={selectedTx}
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />
      <ReconcileModal
        open={isReconcileOpen}
        onClose={setIsReconcileOpen}
        currentBalance={stats.saldo}
        onSuccess={() => {
          fetchDashboard()
          fetchMovimentacoes()
        }}
      />
    </div>
  )
}
