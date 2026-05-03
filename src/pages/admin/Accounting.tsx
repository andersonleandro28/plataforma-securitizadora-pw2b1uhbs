import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  PieChart,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

export default function Accounting() {
  const [loading, setLoading] = useState(true)
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [saldoCaixa, setSaldoCaixa] = useState(0)
  const [divergencia, setDivergencia] = useState(0)

  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [{ data: movs, error: movErr }, { data: saldo, error: saldoErr }] = await Promise.all([
        supabase.from('movimentacoes_caixa').select('*').order('created_at', { ascending: false }),
        supabase
          .from('saldo_caixa')
          .select('saldo_atual')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (movErr) throw movErr
      if (saldoErr && saldoErr.code !== 'PGRST116') throw saldoErr

      setMovimentacoes(movs || [])
      setSaldoCaixa(saldo?.saldo_atual || 0)

      let calc = 0
      ;(movs || []).forEach((m) => {
        if (m.tipo === 'entrada') calc += Number(m.valor)
        if (m.tipo === 'saída') calc -= Number(m.valor)
      })
      const saldoAtualDB = saldo?.saldo_atual || 0
      if (Math.abs(calc - saldoAtualDB) > 0.01) {
        setDivergencia(calc)
      } else {
        setDivergencia(0)
      }
    } catch (error: any) {
      console.error(error)
      toast.error('Erro ao carregar dados da contabilidade.')
    } finally {
      setLoading(false)
    }
  }

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    movimentacoes.forEach((m) => {
      if (m.categoria) cats.add(m.categoria)
    })
    return Array.from(cats).sort()
  }, [movimentacoes])

  const dadosFiltrados = useMemo(() => {
    let filtrado = movimentacoes

    if (periodoInicio) {
      filtrado = filtrado.filter(
        (m) => new Date(m.created_at) >= new Date(periodoInicio + 'T00:00:00'),
      )
    }
    if (periodoFim) {
      filtrado = filtrado.filter(
        (m) => new Date(m.created_at) <= new Date(periodoFim + 'T23:59:59'),
      )
    }
    if (filtroTipo !== 'todos') {
      filtrado = filtrado.filter((m) => m.tipo === filtroTipo)
    }
    if (filtroCategoria !== 'todas') {
      filtrado = filtrado.filter((m) => m.categoria === filtroCategoria)
    }
    if (busca) {
      const b = busca.toLowerCase()
      filtrado = filtrado.filter(
        (m) =>
          m.descricao?.toLowerCase().includes(b) || m.referencia_numero?.toLowerCase().includes(b),
      )
    }
    return filtrado
  }, [movimentacoes, periodoInicio, periodoFim, filtroTipo, filtroCategoria, busca])

  const { totalEntradas, totalSaidas, resultado } = useMemo(() => {
    let ent = 0,
      sai = 0
    dadosFiltrados.forEach((m) => {
      if (m.tipo === 'entrada') ent += Number(m.valor || 0)
      if (m.tipo === 'saída') sai += Number(m.valor || 0)
    })
    return { totalEntradas: ent, totalSaidas: sai, resultado: ent - sai }
  }, [dadosFiltrados])

  const { receitas, despesas } = useMemo(() => {
    const recs: Record<string, number> = {}
    const desps: Record<string, number> = {}

    dadosFiltrados.forEach((m) => {
      const val = Number(m.valor || 0)
      if (m.tipo === 'entrada') {
        recs[m.categoria] = (recs[m.categoria] || 0) + val
      } else if (m.tipo === 'saída') {
        desps[m.categoria] = (desps[m.categoria] || 0) + val
      }
    })
    return { receitas: recs, despesas: desps }
  }, [dadosFiltrados])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleExportCSV = () => {
    let csv = 'Data,Tipo,Categoria,Descricao,Referencia,Valor,Saldo\n'
    dadosFiltrados.forEach((item) => {
      const data = new Date(item.created_at).toLocaleDateString('pt-BR')
      const tipo = item.tipo
      const cat = item.categoria || ''
      const desc = `"${(item.descricao || '').replace(/"/g, '""')}"`
      const ref = item.referencia_numero || ''
      const val = item.valor
      const saldo = item.saldo_novo || 0
      csv += `${data},${tipo},${cat},${desc},${ref},${val},${saldo}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Livro_Caixa_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidade</h1>
          <p className="text-muted-foreground">
            Livro Caixa, DRE e Fluxo sincronizados com a Tesouraria.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {divergencia !== 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Divergência de saldo detectada!</AlertTitle>
          <AlertDescription>
            Saldo esperado pela soma das movimentações:{' '}
            <strong>{formatCurrency(divergencia)}</strong>. Saldo atual no sistema:{' '}
            <strong>{formatCurrency(saldoCaixa)}</strong>. Vá até a página de Migração de Dados para
            recalcular o saldo e corrigir essa inconsistência.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Entradas (Receitas) <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalEntradas)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Saídas (Despesas) <TrendingDown className="w-4 h-4 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">-{formatCurrency(totalSaidas)}</div>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${resultado >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Resultado do Período <PieChart className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}
            >
              {formatCurrency(resultado)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary border-l-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex justify-between">
              Saldo em Caixa <DollarSign className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(saldoCaixa)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="grid gap-1 flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-muted-foreground">Busca</span>
            <Input
              placeholder="Buscar por descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
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
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saída">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Categoria</span>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Categorias</SelectItem>
                {categoriasUnicas.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="movimentacoes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="movimentacoes">Livro Caixa (Tabela)</TabsTrigger>
          <TabsTrigger value="dre">DRE e Fluxo</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
              <CardDescription>
                Visualização detalhada de todas as entradas e saídas sincronizadas com o saldo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Saldo Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma movimentação encontrada para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dadosFiltrados.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                            >
                              {m.tipo.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground text-sm">
                            {m.categoria?.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate" title={m.descricao}>
                            {m.descricao}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-medium ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}
                          >
                            {m.tipo === 'entrada' ? '+' : '-'}
                            {formatCurrency(m.valor)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(m.saldo_novo || 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração do Resultado (DRE)</CardTitle>
              <CardDescription>
                Agrupamento por rubricas e categorias financeiras no período filtrado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubrica Contábil</TableHead>
                    <TableHead className="text-right">Valor Consolidado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-emerald-50/50">
                    <TableCell className="font-bold text-emerald-800">
                      RECEITAS (ENTRADAS)
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-800">
                      {formatCurrency(totalEntradas)}
                    </TableCell>
                  </TableRow>
                  {Object.entries(receitas)
                    .sort()
                    .map(([cat, val]) => (
                      <TableRow key={cat}>
                        <TableCell className="pl-8 capitalize text-muted-foreground">
                          {cat.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">
                          {formatCurrency(val)}
                        </TableCell>
                      </TableRow>
                    ))}

                  <TableRow className="bg-rose-50/50">
                    <TableCell className="font-bold text-rose-800">DESPESAS (SAÍDAS)</TableCell>
                    <TableCell className="text-right font-bold text-rose-800">
                      -{formatCurrency(totalSaidas)}
                    </TableCell>
                  </TableRow>
                  {Object.entries(despesas)
                    .sort()
                    .map(([cat, val]) => (
                      <TableRow key={cat}>
                        <TableCell className="pl-8 capitalize text-muted-foreground">
                          {cat.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600">
                          -{formatCurrency(val)}
                        </TableCell>
                      </TableRow>
                    ))}

                  <TableRow className="bg-primary/5">
                    <TableCell className="font-bold text-lg">RESULTADO DO PERÍODO</TableCell>
                    <TableCell
                      className={`text-right font-bold text-lg font-mono ${resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}
                    >
                      {formatCurrency(resultado)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
