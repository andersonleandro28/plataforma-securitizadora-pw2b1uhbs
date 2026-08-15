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
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV } from '@/lib/export-utils'
import { useDre, type DreCategoria } from '@/hooks/use-dre'
import { AdminExpenseDialog } from '@/components/admin/AdminExpenseDialog'
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

export default function Dre() {
  const now = new Date()
  const [mes, setMes] = useState(String(now.getMonth()))
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [modoPeriodo, setModoPeriodo] = useState<'mes' | 'intervalo'>('mes')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [expenseOpen, setExpenseOpen] = useState(false)

  const { dados, loading, error, refetch } = useDre()

  // Calcula o intervalo efetivo com base no modo selecionado.
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
    const rows = dados.lancamentos.map((l) => ({
      Data: new Date(l.date).toLocaleDateString('pt-BR'),
      Descrição: l.descricao,
      Categoria: l.categoria,
      Tipo: l.tipo === 'receita' ? 'Receita' : 'Despesa',
      Valor: l.valor,
    }))
    exportToCSV(rows, `DRE_${periodoInicio}_${periodoFim}.csv`)
    toast.success('DRE exportada em CSV.')
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
          <AlertTitle>Erro ao carregar DRE</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch(periodoInicio, periodoFim)} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  const resultado = dados?.resultado ?? 0
  const totalReceitas = dados?.totalReceitas ?? 0
  const totalDespesas = dados?.totalDespesas ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Home &gt; Financeiro &gt; DRE</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Demonstração do Resultado do Exercício
          </h1>
          <p className="text-muted-foreground">
            Consolidação de receitas e despesas do Livro Caixa por período.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setExpenseOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Lançar Despesa
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

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

      {/* Cards de totais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Total de Receitas <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalReceitas)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Total de Despesas <TrendingDown className="w-4 h-4 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-rose-600">
                -{formatCurrency(totalDespesas)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card
          className={cn(
            'border-l-4',
            resultado >= 0 ? 'border-l-emerald-600' : 'border-l-rose-600',
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Resultado do Exercício <Scale className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div
                className={cn(
                  'text-2xl font-bold',
                  resultado >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {formatCurrency(resultado)}
              </div>
            )}
            {!loading && (
              <div className="text-xs text-muted-foreground mt-1">
                Receitas − Despesas · {resultado >= 0 ? 'Superávit' : 'Déficit'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agrupamento por categoria — Receitas */}
      <CategoriaGroup
        titulo="Receitas (Entradas)"
        categorias={dados?.receitasPorCategoria || []}
        loading={loading}
        totalLabel="Total de Receitas"
        total={totalReceitas}
        tone="receita"
        formatCurrency={formatCurrency}
      />

      {/* Agrupamento por categoria — Despesas */}
      <CategoriaGroup
        titulo="Despesas (Saídas)"
        categorias={dados?.despesasPorCategoria || []}
        loading={loading}
        totalLabel="Total de Despesas"
        total={totalDespesas}
        tone="despesa"
        formatCurrency={formatCurrency}
      />

      {/* Resultado consolidado */}
      {!loading && dados && (
        <Card
          className={cn(
            'border-2',
            resultado >= 0
              ? 'border-emerald-500/50 bg-emerald-50/50'
              : 'border-rose-500/50 bg-rose-50/50',
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resultado Bruto do Período</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalReceitas)} (receitas) − {formatCurrency(totalDespesas)}{' '}
                (despesas)
              </p>
            </div>
            <div
              className={cn(
                'text-3xl font-bold',
                resultado >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {formatCurrency(resultado)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela detalhada de todas as movimentações do período */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentações do Período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
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
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !dados || dados.lancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <PackageOpen className="w-12 h-12 text-muted-foreground/50" />
                        <p>Nenhuma movimentação encontrada para o período selecionado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  dados.lancamentos.map((l) => (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-medium text-sm">
                        {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[320px] truncate"
                        title={l.descricao}
                      >
                        {l.descricao}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.categoria}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            l.tipo === 'receita'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800',
                          )}
                        >
                          {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono font-medium',
                          l.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {l.tipo === 'receita' ? '+' : '-'}
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

/** Bloco colapsável que lista categorias e, ao expandir, os lançamentos. */
function CategoriaGroup({
  titulo,
  categorias,
  loading,
  totalLabel,
  total,
  tone,
  formatCurrency,
}: {
  titulo: string
  categorias: DreCategoria[]
  loading: boolean
  totalLabel: string
  total: number
  tone: 'receita' | 'despesa'
  formatCurrency: (v: number) => string
}) {
  const isReceita = tone === 'receita'
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isReceita ? (
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          ) : (
            <TrendingDown className="w-5 h-5 text-rose-500" />
          )}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum lançamento neste período.
          </p>
        ) : (
          categorias.map((cat) => (
            <CategoriaRow
              key={cat.categoria}
              cat={cat}
              tone={tone}
              formatCurrency={formatCurrency}
            />
          ))
        )}

        {/* Total */}
        <div className="flex items-center justify-between border-t pt-3 mt-2">
          <span className="font-semibold text-sm">{totalLabel}</span>
          <span
            className={cn('font-bold text-lg', isReceita ? 'text-emerald-600' : 'text-rose-600')}
          >
            {isReceita ? '' : '-'}
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function CategoriaRow({
  cat,
  tone,
  formatCurrency,
}: {
  cat: DreCategoria
  tone: 'receita' | 'despesa'
  formatCurrency: (v: number) => string
}) {
  const [open, setOpen] = useState(false)
  const isReceita = tone === 'receita'
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between rounded-md border px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{cat.categoria}</span>
            <span className="text-xs text-muted-foreground">
              ({cat.lancamentos.length} lançamento{cat.lancamentos.length !== 1 ? 's' : ''})
            </span>
          </div>
          <span
            className={cn(
              'font-mono font-semibold text-sm',
              isReceita ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {isReceita ? '' : '-'}
            {formatCurrency(cat.total)}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 mb-2 rounded-md border bg-muted/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Origem</TableHead>
                <TableHead className="text-right text-xs">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cat.lancamentos
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.descricao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.origem}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-xs',
                        isReceita ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {isReceita ? '' : '-'}
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
