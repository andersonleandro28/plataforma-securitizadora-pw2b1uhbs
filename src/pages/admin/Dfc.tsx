import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  TrendingUp,
  TrendingDown,
  Scale,
  FileSpreadsheet,
  PackageOpen,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Plus,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Landmark,
  Briefcase,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV } from '@/lib/export-utils'
import { useDfc, type DfcSecaoDados, type DfcSubcategoria } from '@/hooks/use-dfc'
import { AdminExpenseDialog } from '@/components/admin/AdminExpenseDialog'
import { AdminCreditDialog } from '@/components/admin/AdminCreditDialog'
import { cn } from '@/lib/utils'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export default function Dfc() {
  const now = new Date()
  const [mes, setMes] = useState(String(now.getMonth()))
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [modoPeriodo, setModoPeriodo] = useState<'mes' | 'intervalo'>('mes')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)

  const { dados, loading, error, refetch } = useDfc()

  // Calcula o intervalo com base no modo selecionado
  const { periodoInicio, periodoFim } = useMemo(() => {
    if (modoPeriodo === 'intervalo' && inicio && fim) {
      return { periodoInicio: inicio, periodoFim: fim }
    }
    const m = Number(mes)
    const a = Number(ano)
    const first = new Date(a, m, 1).toISOString().split('T')[0]
    const last = new Date(a, m + 1, 0).toISOString().split('T')[0]
    return { periodoInicio: first, periodoFim: last }
  }, [modoPeriodo, mes, ano, inicio, fim])

  useEffect(() => {
    refetch(periodoInicio, periodoFim)
  }, [refetch, periodoInicio, periodoFim])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleExportCSV = () => {
    if (!dados) return
    const rows = dados.lancamentosPeriodo.map((l) => ({
      Data: new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR'),
      Seção:
        l.secao === 'operacional'
          ? 'Operacional'
          : l.secao === 'investimento'
            ? 'Investimento'
            : 'Financiamento',
      Fluxo: l.sinal === 'entrada' ? 'Entrada (+)' : 'Saída (-)',
      Categoria: l.categoria,
      Descrição: l.descricao,
      Valor: l.valor,
      Origem: l.origem,
    }))
    exportToCSV(rows, `DFC_FASB95_${periodoInicio}_${periodoFim}.csv`)
    toast.success('DFC exportada em CSV.')
  }

  const handlePrint = () => {
    window.print()
  }

  const anos = useMemo(() => {
    const atual = now.getFullYear()
    const arr = []
    for (let a = atual - 4; a <= atual + 1; a++) arr.push(String(a))
    return arr
  }, [now])

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar DFC</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch(periodoInicio, periodoFim)} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  const variacao = dados?.variacaoLiquidaPeriodo ?? 0
  const saldoInicial = dados?.saldoInicialCaixa ?? 0
  const saldoFinal = dados?.saldoFinalCalculado ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      {/* Abas Superiores DRE / DFC */}
      <div className="flex border-b border-border/80 pb-2 gap-2">
        <Link
          to="/admin/dre"
          className="px-4 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          DRE (Resultado)
        </Link>
        <Link
          to="/admin/dfc"
          className="px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-primary/10 text-primary border border-primary/20"
        >
          DFC (Fluxo de Caixa - FASB 95)
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Home &gt; Financeiro &gt; DFC (FASB 95)
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Demonstração dos Fluxos de Caixa (DFC)
          </h1>
          <p className="text-muted-foreground">
            Norma FASB Statement No. 95 · Método Direto · Classificação por Atividades Operacionais,
            Investimento e Financiamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setCreditOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" /> Lançar Crédito
          </Button>
          <Button onClick={() => setExpenseOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Lançar Despesa
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <AdminCreditDialog
        open={creditOpen}
        onOpenChange={setCreditOpen}
        onSuccess={() => refetch(periodoInicio, periodoFim)}
      />

      <AdminExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSuccess={() => refetch(periodoInicio, periodoFim)}
      />

      {/* Filtro de período */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Modo</span>
            <Select
              value={modoPeriodo}
              onValueChange={(v) => setModoPeriodo(v as 'mes' | 'intervalo')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês / Ano</SelectItem>
                <SelectItem value="intervalo">Intervalo de datas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modoPeriodo === 'mes' ? (
            <>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Mês</span>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((nome, idx) => (
                      <SelectItem key={nome} value={String(idx)}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Ano</span>
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Data Inicial</span>
                <Input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Data Final</span>
                <Input
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <span>
              {new Date(periodoInicio + 'T00:00:00').toLocaleDateString('pt-BR')} —{' '}
              {new Date(periodoFim + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo FASB 95 */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Atividades Operacionais */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Caixa Operacional <Briefcase className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div
                className={cn(
                  'text-2xl font-bold',
                  (dados?.operacional.liquido ?? 0) >= 0 ? 'text-blue-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(dados?.operacional.liquido ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Entradas: {formatCurrency(dados?.operacional.totalEntradas ?? 0)} | Saídas:{' '}
              {formatCurrency(dados?.operacional.totalSaidas ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Atividades de Investimento */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Caixa de Investimento <Building2 className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div
                className={cn(
                  'text-2xl font-bold',
                  (dados?.investimento.liquido ?? 0) >= 0 ? 'text-emerald-600' : 'text-amber-600',
                )}
              >
                {formatCurrency(dados?.investimento.liquido ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Desembolsos/Compras: {formatCurrency(dados?.investimento.totalSaidas ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Atividades de Financiamento */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Caixa de Financiamento <Landmark className="w-4 h-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div
                className={cn(
                  'text-2xl font-bold',
                  (dados?.financiamento.liquido ?? 0) >= 0 ? 'text-purple-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(dados?.financiamento.liquido ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Captação: {formatCurrency(dados?.financiamento.totalEntradas ?? 0)} | Resgates:{' '}
              {formatCurrency(dados?.financiamento.totalSaidas ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Variação Líquida de Caixa */}
        <Card
          className={cn(
            'border-l-4',
            variacao >= 0
              ? 'border-l-emerald-600 bg-emerald-50/20'
              : 'border-l-rose-600 bg-rose-50/20',
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Variação Líquida <Scale className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div
                className={cn(
                  'text-2xl font-bold',
                  variacao >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(variacao)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Soma das 3 atividades</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Divergência ou Confirmação de Conciliação com o Livro Caixa */}
      {!loading && dados && (
        <>
          {dados.temDivergencia ? (
            <Alert variant="destructive" className="border-rose-500/50 bg-rose-50/30">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <AlertTitle className="text-rose-800 font-semibold">
                Divergência de Conciliação com o Livro Caixa
              </AlertTitle>
              <AlertDescription className="text-rose-700 text-sm">
                O saldo final calculado pelo DFC ({formatCurrency(dados.saldoFinalCalculado)})
                diverge em{' '}
                <span className="font-bold">{formatCurrency(Math.abs(dados.divergencia))}</span> do
                saldo acumulado registrado no Livro Caixa (
                {formatCurrency(dados.saldoFinalLivroCaixa)}).
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/40 text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Conciliação FASB 95 validada:</strong> O saldo final calculado coincide com
                o saldo do Livro Caixa ({formatCurrency(dados.saldoFinalCalculado)}).
              </span>
            </div>
          )}
        </>
      )}

      {/* SEÇÃO 1: ATIVIDADES OPERACIONAIS */}
      <SecaoFasb95
        secaoDados={dados?.operacional}
        loading={loading}
        icone={<Briefcase className="w-5 h-5 text-blue-500" />}
        corBorda="border-l-blue-500"
        formatCurrency={formatCurrency}
      />

      {/* SEÇÃO 2: ATIVIDADES DE INVESTIMENTO */}
      <SecaoFasb95
        secaoDados={dados?.investimento}
        loading={loading}
        icone={<Building2 className="w-5 h-5 text-amber-500" />}
        corBorda="border-l-amber-500"
        formatCurrency={formatCurrency}
      />

      {/* SEÇÃO 3: ATIVIDADES DE FINANCIAMENTO */}
      <SecaoFasb95
        secaoDados={dados?.financiamento}
        loading={loading}
        icone={<Landmark className="w-5 h-5 text-purple-500" />}
        corBorda="border-l-purple-500"
        formatCurrency={formatCurrency}
      />

      {/* CONCILIAÇÃO FINAL DO SALDO DE CAIXA (FASB 95 RECONCILIATION) */}
      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Conciliação e Variação Líquida de Caixa (FASB 95)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="divide-y text-sm">
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-muted-foreground">
                Caixa líquido gerado pelas (aplicado nas) Atividades Operacionais
              </span>
              <span
                className={cn(
                  'font-mono font-medium',
                  (dados?.operacional.liquido ?? 0) >= 0 ? 'text-blue-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(dados?.operacional.liquido ?? 0)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-muted-foreground">
                Caixa líquido gerado pelas (aplicado nas) Atividades de Investimento
              </span>
              <span
                className={cn(
                  'font-mono font-medium',
                  (dados?.investimento.liquido ?? 0) >= 0 ? 'text-emerald-600' : 'text-amber-600',
                )}
              >
                {formatCurrency(dados?.investimento.liquido ?? 0)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-muted-foreground">
                Caixa líquido gerado pelas (aplicado nas) Atividades de Financiamento
              </span>
              <span
                className={cn(
                  'font-mono font-medium',
                  (dados?.financiamento.liquido ?? 0) >= 0 ? 'text-purple-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(dados?.financiamento.liquido ?? 0)}
              </span>
            </div>

            {/* Variação Líquida */}
            <div className="py-3 flex justify-between items-center font-semibold bg-muted/20 px-3 rounded-md">
              <span className="text-foreground">
                (=) Aumento (Redução) Líquido de Caixa e Equivalentes no Período
              </span>
              <span
                className={cn(
                  'font-mono text-base',
                  variacao >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(variacao)}
              </span>
            </div>

            {/* Saldo Inicial */}
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-muted-foreground">
                (+) Saldo de Caixa e Equivalentes no Início do Período (até{' '}
                {new Date(periodoInicio + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrency(saldoInicial)}
              </span>
            </div>

            {/* Saldo Final */}
            <div className="py-3 flex justify-between items-center font-bold text-base bg-primary/5 px-3 rounded-md border border-primary/20">
              <span className="text-primary">
                (=) Saldo de Caixa e Equivalentes no Fim do Período (em{' '}
                {new Date(periodoFim + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
              <span className="font-mono text-xl text-primary">{formatCurrency(saldoFinal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada de todas as movimentações classificadas no período */}
      <Card>
        <CardHeader>
          <CardTitle>Extrato Analítico das Movimentações do Período (DFC)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Classificação FASB 95</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fluxo</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
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
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !dados || dados.lancamentosPeriodo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <PackageOpen className="w-12 h-12 text-muted-foreground/50" />
                        <p>Nenhuma movimentação encontrada para o período selecionado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  dados.lancamentosPeriodo.map((l) => (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-medium text-sm">
                        {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            l.secao === 'operacional' && 'bg-blue-100 text-blue-800',
                            l.secao === 'investimento' && 'bg-amber-100 text-amber-800',
                            l.secao === 'financiamento' && 'bg-purple-100 text-purple-800',
                          )}
                        >
                          {l.secao === 'operacional'
                            ? 'Operacional'
                            : l.secao === 'investimento'
                              ? 'Investimento'
                              : 'Financiamento'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.categoria}</TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[280px] truncate"
                        title={l.descricao}
                      >
                        {l.descricao}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-semibold',
                            l.sinal === 'entrada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800',
                          )}
                        >
                          {l.sinal === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono font-medium',
                          l.sinal === 'entrada' ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {l.sinal === 'entrada' ? '+' : '-'}
                        {formatCurrency(l.valor)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Componente de Seção do FASB 95 com subtotais de entradas, saídas e líquido */
function SecaoFasb95({
  secaoDados,
  loading,
  icone,
  corBorda,
  formatCurrency,
}: {
  secaoDados: DfcSecaoDados | undefined
  loading: boolean
  icone: React.ReactNode
  corBorda: string
  formatCurrency: (v: number) => string
}) {
  if (loading || !secaoDados) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    )
  }

  const { titulo, descricao, entradas, saidas, totalEntradas, totalSaidas, liquido } = secaoDados
  const semMovimentacao = entradas.length === 0 && saidas.length === 0

  return (
    <Card className={cn('border-l-4', corBorda)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {icone}
              {titulo}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Caixa Líquido da Seção:</span>
            <span
              className={cn(
                'font-mono font-bold text-lg px-2.5 py-1 rounded bg-muted',
                liquido >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {liquido >= 0 ? '+' : ''}
              {formatCurrency(liquido)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {semMovimentacao ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            Nenhuma movimentação nesta seção no período selecionado.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Bloco de Entradas (Recebimentos) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Entradas de Caixa
                </span>
                <span className="font-mono font-semibold text-xs text-emerald-600">
                  {formatCurrency(totalEntradas)}
                </span>
              </div>
              {entradas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Nenhuma entrada</p>
              ) : (
                entradas.map((sub) => (
                  <SubcategoriaRow
                    key={sub.categoria}
                    sub={sub}
                    sinal="entrada"
                    formatCurrency={formatCurrency}
                  />
                ))
              )}
            </div>

            {/* Bloco de Saídas (Pagamentos/Desembolsos) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" /> Saídas de Caixa
                </span>
                <span className="font-mono font-semibold text-xs text-rose-600">
                  -{formatCurrency(totalSaidas)}
                </span>
              </div>
              {saidas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Nenhuma saída</p>
              ) : (
                saidas.map((sub) => (
                  <SubcategoriaRow
                    key={sub.categoria}
                    sub={sub}
                    sinal="saida"
                    formatCurrency={formatCurrency}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Subtotal da Seção */}
        <div className="flex items-center justify-between border-t pt-3 mt-4 text-sm font-semibold">
          <span className="text-muted-foreground">
            (=) Caixa líquido gerado pelas (aplicado nas) {titulo.toLowerCase()}
          </span>
          <span
            className={cn(
              'font-mono font-bold text-base',
              liquido >= 0 ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {liquido >= 0 ? '+' : ''}
            {formatCurrency(liquido)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function SubcategoriaRow({
  sub,
  sinal,
  formatCurrency,
}: {
  sub: DfcSubcategoria
  sinal: 'entrada' | 'saida'
  formatCurrency: (v: number) => string
}) {
  const [open, setOpen] = useState(false)
  const isEntrada = sinal === 'entrada'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className="font-medium text-xs">{sub.categoria}</span>
            <span className="text-[11px] text-muted-foreground">({sub.lancamentos.length})</span>
          </div>
          <span
            className={cn(
              'font-mono font-semibold text-xs',
              isEntrada ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {isEntrada ? '+' : '-'}
            {formatCurrency(sub.total)}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 mb-2 rounded-md border bg-muted/20 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] py-1">Data</TableHead>
                <TableHead className="text-[11px] py-1">Descrição</TableHead>
                <TableHead className="text-[11px] py-1">Origem</TableHead>
                <TableHead className="text-right text-[11px] py-1">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sub.lancamentos
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[11px] py-1 whitespace-nowrap">
                      {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-[11px] py-1 text-muted-foreground">
                      {l.descricao}
                    </TableCell>
                    <TableCell className="text-[11px] py-1 text-muted-foreground">
                      {l.origem}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-[11px] py-1',
                        isEntrada ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {isEntrada ? '+' : '-'}
                      {formatCurrency(l.valor)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
