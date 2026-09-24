import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { printIsolatedUnifiedReport } from '@/lib/unified-report-print'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Calendar,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  TrendingUp,
  Receipt,
  Landmark,
  Scale,
  Activity,
  AlertCircle,
  FileCheck,
  Shield,
  FileBarChart,
  CheckCircle2,
} from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { exportToCSV } from '@/lib/export-utils'
import { BankMovementExtractReportTab } from '@/components/reports/BankMovementExtractReportTab'
import { InvestorYieldsReportTab } from '@/components/reports/InvestorYieldsReportTab'
import { PeriodOperationsReportTab } from '@/components/reports/PeriodOperationsReportTab'
import { useDre } from '@/hooks/use-dre'
import { useDfc } from '@/hooks/use-dfc'
import { useAccounting } from '@/hooks/use-accounting'
import { cn } from '@/lib/utils'

export type ReportTypeKey = 'investor-yields' | 'period-operations' | 'bank-extract' | 'dre' | 'dfc'

interface AvailableReportConfig {
  id: ReportTypeKey
  title: string
  subtitle: string
  category: string
  icon: React.ComponentType<{ className?: string }>
}

const AVAILABLE_REPORTS: AvailableReportConfig[] = [
  {
    id: 'investor-yields',
    title: 'Rendimentos dos Investidores',
    subtitle: 'Posição patrimonial, valor investido e rentabilidade mês a mês e acumulada.',
    category: 'Carteira & Passivo',
    icon: TrendingUp,
  },
  {
    id: 'period-operations',
    title: 'Operações do Período (Fiscal & Contábil)',
    subtitle: 'Antecipação de recebíveis, aquisições de CCBs, deságios e apuração tributária.',
    category: 'Operações & Ativo',
    icon: Receipt,
  },
  {
    id: 'bank-extract',
    title: 'Extrato de Movimentações Bancárias',
    subtitle: 'Livro Caixa com conciliação bancária, entradas, saídas e saldo corrido.',
    category: 'Caixa & Tesouraria',
    icon: Landmark,
  },
  {
    id: 'dre',
    title: 'DRE — Demonstração do Resultado',
    subtitle: 'Receitas, despesas operacionais e resultado líquido do exercício.',
    category: 'Contabilidade',
    icon: Scale,
  },
  {
    id: 'dfc',
    title: 'DFC — Demonstração do Fluxo de Caixa (FASB 95)',
    subtitle: 'Atividades operacionais, de investimento e financiamento (método direto).',
    category: 'Contabilidade',
    icon: Activity,
  },
]

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

export function UnifiedReportTab() {
  const [selectedReports, setSelectedReports] = useState<ReportTypeKey[]>([
    'investor-yields',
    'period-operations',
    'bank-extract',
  ])

  // Competência selecionada (formato YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Lista de competências disponíveis (últimos 24 meses)
  const availableMonths = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      options.push({ value, label: `${capitalized} (${value})` })
    }
    return options
  }, [])

  const selectedMonthLabel = useMemo(() => {
    const [ano, mes] = selectedMonth.split('-')
    if (!ano || !mes) return selectedMonth
    const dateObj = new Date(Number(ano), Number(mes) - 1, 1)
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [selectedMonth])

  // Intervalo de datas para DRE / DFC
  const { monthStart, monthEnd } = useMemo(() => {
    const [y, m] = selectedMonth.split('-')
    const yearNum = parseInt(y, 10)
    const monthNum = parseInt(m, 10)
    const firstDay = `${selectedMonth}-01`
    const lastDayDate = new Date(yearNum, monthNum, 0)
    const lastDay = `${selectedMonth}-${String(lastDayDate.getDate()).padStart(2, '0')}`
    return { monthStart: firstDay, monthEnd: lastDay }
  }, [selectedMonth])

  // Carrega DRE e DFC para inclusão no unificado se selecionados
  const { dados: dreDados, refetch: refetchDre } = useDre()
  const { dados: dfcDados, refetch: refetchDfc } = useDfc()
  const { data: accountingData, refetch: refetchAccounting } = useAccounting()

  useEffect(() => {
    if (selectedReports.includes('dre')) {
      refetchDre(monthStart, monthEnd)
    }
  }, [selectedReports, monthStart, monthEnd, refetchDre])

  useEffect(() => {
    if (selectedReports.includes('dfc')) {
      refetchDfc(monthStart, monthEnd)
    }
  }, [selectedReports, monthStart, monthEnd, refetchDfc])

  useEffect(() => {
    if (selectedReports.includes('bank-extract')) {
      refetchAccounting()
    }
  }, [selectedReports, refetchAccounting])

  const toggleReport = useCallback((id: ReportTypeKey) => {
    setSelectedReports((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }, [])

  const selectAll = useCallback(() => {
    setSelectedReports(AVAILABLE_REPORTS.map((r) => r.id))
  }, [])

  const selectNone = useCallback(() => {
    setSelectedReports([])
  }, [])

  const printContainerRef = useRef<HTMLDivElement>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = useCallback(async () => {
    if (!printContainerRef.current) return
    setIsPrinting(true)
    try {
      await printIsolatedUnifiedReport(printContainerRef.current, {
        title: `Relatório Financeiro & Operacional Unificado — ${selectedMonthLabel} — Nexum Security 360º`,
      })
    } catch (err) {
      console.error('Falha ao gerar impressão isolada do relatório unificado:', err)
      // Fallback gracioso
      window.print()
    } finally {
      setIsPrinting(false)
    }
  }, [selectedMonthLabel])

  // Exportação CSV unificada sequencial
  const handleExportUnifiedCSV = useCallback(() => {
    const unifiedRows: Record<string, any>[] = []
    const generationDateStr = new Date().toLocaleString('pt-BR')

    // Linha de Capa
    unifiedRows.push({
      'RELATÓRIO UNIFICADO': 'NEXUM SECURITY 360º — RELATÓRIO EXECUTIVO INTEGRADO',
      COMPETÊNCIA: selectedMonthLabel,
      'DATA DE GERAÇÃO': generationDateStr,
      'RELATÓRIOS INCLUÍDOS': selectedReports.join(', '),
      COLUNA_1: '',
      COLUNA_2: '',
      COLUNA_3: '',
      COLUNA_4: '',
      COLUNA_5: '',
      COLUNA_6: '',
    })

    unifiedRows.push({}) // linha em branco separadora

    // 1. Extrato de Movimentações Bancárias (Livro Caixa)
    if (selectedReports.includes('bank-extract') && accountingData) {
      unifiedRows.push({
        'RELATÓRIO UNIFICADO': '=== SEÇÃO: EXTRATO DE MOVIMENTAÇÕES BANCÁRIAS (LIVRO CAIXA) ===',
      })
      const filteredAcc = accountingData.filter((t) => {
        const dStr = t.date?.slice(0, 10) || ''
        return dStr >= monthStart && dStr <= monthEnd
      })
      filteredAcc.forEach((t) => {
        unifiedRows.push({
          'RELATÓRIO UNIFICADO': 'Extrato Bancário',
          COMPETÊNCIA: selectedMonth,
          'DATA DE GERAÇÃO': t.date,
          'RELATÓRIOS INCLUÍDOS': t.type === 'in' ? 'Entrada' : 'Saída',
          COLUNA_1: t.category,
          COLUNA_2: t.description,
          COLUNA_3: t.bank_account_info?.bank_name || 'Conta Ativa',
          COLUNA_4: t.type === 'in' ? t.value : -t.value,
          COLUNA_5: t.accumulated_balance,
        })
      })
      unifiedRows.push({})
    }

    // 2. DRE
    if (selectedReports.includes('dre') && dreDados) {
      unifiedRows.push({
        'RELATÓRIO UNIFICADO': '=== SEÇÃO: DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE) ===',
        COMPETÊNCIA: `Total Receitas: R$ ${dreDados.totalReceitas.toFixed(2)} | Total Despesas: R$ ${dreDados.totalDespesas.toFixed(2)} | Resultado: R$ ${dreDados.resultado.toFixed(2)}`,
      })
      ;(dreDados.lancamentos || []).forEach((l) => {
        unifiedRows.push({
          'RELATÓRIO UNIFICADO': 'DRE',
          COMPETÊNCIA: selectedMonth,
          'DATA DE GERAÇÃO': l.date,
          'RELATÓRIOS INCLUÍDOS': l.tipo === 'receita' ? 'Receita' : 'Despesa',
          COLUNA_1: l.categoria,
          COLUNA_2: l.descricao,
          COLUNA_3: l.valor,
        })
      })
      unifiedRows.push({})
    }

    // 3. DFC
    if (selectedReports.includes('dfc') && dfcDados) {
      unifiedRows.push({
        'RELATÓRIO UNIFICADO': '=== SEÇÃO: DEMONSTRAÇÃO DO FLUXO DE CAIXA (DFC - FASB 95) ===',
        COMPETÊNCIA: `Saldo Inicial: R$ ${dfcDados.saldoInicialCaixa.toFixed(2)} | Variação Líquida: R$ ${dfcDados.variacaoLiquidaPeriodo.toFixed(2)} | Saldo Final: R$ ${dfcDados.saldoFinalLivroCaixa.toFixed(2)}`,
      })
      ;(dfcDados.lancamentosPeriodo || []).forEach((l) => {
        unifiedRows.push({
          'RELATÓRIO UNIFICADO': 'DFC',
          COMPETÊNCIA: selectedMonth,
          'DATA DE GERAÇÃO': l.date,
          'RELATÓRIOS INCLUÍDOS': l.secao.toUpperCase(),
          COLUNA_1: l.sinal === 'entrada' ? 'Entrada' : 'Saída',
          COLUNA_2: l.categoria,
          COLUNA_3: l.descricao,
          COLUNA_4: l.valor,
          COLUNA_5: l.origem,
        })
      })
      unifiedRows.push({})
    }

    exportToCSV(unifiedRows, `Relatorio_Unificado_Nexum_${selectedMonth}.csv`)
  }, [
    selectedReports,
    accountingData,
    dreDados,
    dfcDados,
    selectedMonth,
    selectedMonthLabel,
    monthStart,
    monthEnd,
  ])

  return (
    <div className="space-y-6">
      {/* Painel Superior de Configuração do Unificado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Gerador de Relatório Unificado
          </h3>
          <p className="text-sm text-muted-foreground">
            Selecione múltiplos relatórios para consolidar em um único documento (PDF unificado com
            capa e paginação robusta ou arquivo CSV consolidado).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleExportUnifiedCSV}
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={selectedReports.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Baixar CSV Unificado
          </Button>
          <Button
            onClick={handlePrint}
            variant="default"
            size="sm"
            className="gap-1.5 shadow-sm"
            disabled={selectedReports.length === 0 || isPrinting}
          >
            <Printer className="w-4 h-4 text-primary-foreground" />
            {isPrinting ? 'Preparando PDF...' : 'Imprimir / Salvar PDF Único'}
          </Button>
        </div>
      </div>

      {/* Card de Seleção de Competência e Relatórios */}
      <Card className="no-print border-primary/20 bg-primary/5">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Opções de Consolidação do Arquivo Único
              </CardTitle>
              <CardDescription className="text-xs">
                Defina a competência mensal e marque os demonstrativos que devem compor o relatório.
              </CardDescription>
            </div>

            {/* Seletor de Competência */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Competência:
              </span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableMonths.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Relatórios Disponíveis ({selectedReports.length} de {AVAILABLE_REPORTS.length}{' '}
              selecionados)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 gap-1 text-primary"
                onClick={selectAll}
              >
                <CheckSquare className="w-3.5 h-3.5" /> Marcar Todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 gap-1 text-muted-foreground"
                onClick={selectNone}
              >
                <Square className="w-3.5 h-3.5" /> Limpar Seleção
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE_REPORTS.map((rep) => {
              const Icon = rep.icon
              const isSelected = selectedReports.includes(rep.id)

              return (
                <div
                  key={rep.id}
                  onClick={() => toggleReport(rep.id)}
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-primary bg-background ring-1 ring-primary shadow-sm'
                      : 'border-border/70 bg-background/50 hover:bg-background/80 hover:border-border',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleReport(rep.id)}
                    className="mt-1"
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-primary" />
                        {rep.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {rep.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {rep.subtitle}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedReports.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nenhum relatório selecionado. Marque ao menos uma opção acima para visualizar e gerar
              o arquivo.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ÁREA DE IMPRESSÃO E PRÉ-VISUALIZAÇÃO UNIFICADA */}
      <div
        ref={printContainerRef}
        id="print-unified-report"
        className="w-full max-w-full space-y-8"
      >
        {/* ============================================================== */}
        {/* CAPA HÍBRIDA DO RELATÓRIO UNIFICADO                            */}
        {/* Na tela: Card executivo elegante; No documento isolado: Página 1 com quebra */}
        {/* ============================================================== */}
        <div className="unified-report-cover w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-10 shadow-sm">
          <div className="cover-inner w-full max-w-3xl mx-auto space-y-6">
            <div className="cover-header flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="cover-logo-box p-3 bg-primary/10 rounded-xl">
                  <Layers className="w-8 h-8 text-primary" />
                </div>
                <div className="cover-title-group text-left">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    NEXUM SECURITY 360º
                  </h1>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-0.5">
                    Plataforma de Securitização de Crédito e Investimentos
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="no-print text-xs font-semibold py-1 px-3 border-primary/30 text-primary"
              >
                Relatório Integrado
              </Badge>
            </div>

            <div className="py-4 border-y border-slate-200 dark:border-slate-800 space-y-1.5 text-center">
              <h2 className="cover-main-badge text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">
                Relatório Financeiro & Operacional Unificado
              </h2>
              <div className="cover-competence text-sm text-slate-600 dark:text-slate-400 font-medium">
                Competência de Referência:{' '}
                <strong className="text-slate-900 dark:text-slate-100 text-base">
                  {selectedMonthLabel}
                </strong>
              </div>
            </div>

            <div className="cover-manifest-box text-left bg-slate-100/80 dark:bg-slate-900/50 p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2.5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-primary" />
                Demonstrativos Integrados neste Documento ({selectedReports.length}):
              </h3>
              <ul className="cover-manifest-list grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                {selectedReports.map((id) => {
                  const cfg = AVAILABLE_REPORTS.find((r) => r.id === id)
                  return (
                    <li key={id} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-foreground">{cfg?.title}:</strong>{' '}
                        <span className="text-muted-foreground">{cfg?.subtitle}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="cover-footer pt-3 text-[11px] sm:text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                Data de Emissão:{' '}
                <strong className="text-foreground">
                  {new Date().toLocaleDateString('pt-BR')}
                </strong>{' '}
                às{' '}
                <strong className="text-foreground">
                  {new Date().toLocaleTimeString('pt-BR')}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                Classificação: Confidencial / Administrativo
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RELATÓRIOS SELECIONADOS EM SEQUÊNCIA COM QUEBRA DE PÁGINA      */}
        {/* ============================================================== */}

        {/* 1. Rendimentos dos Investidores */}
        {selectedReports.includes('investor-yields') && (
          <section className="unified-section-break w-full max-w-full">
            <Card className="w-full max-w-full shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                    >
                      Seção 1
                    </Badge>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Rendimentos dos Investidores
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Posição patrimonial, valor investido e rentabilidade mês a mês e acumulada.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    {selectedMonthLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 w-full max-w-full overflow-x-auto">
                <InvestorYieldsReportTab embedded={true} />
              </CardContent>
            </Card>
          </section>
        )}

        {/* 2. Operações do Período */}
        {selectedReports.includes('period-operations') && (
          <section className="unified-section-break w-full max-w-full">
            <Card className="w-full max-w-full shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                    >
                      Seção {selectedReports.indexOf('period-operations') + 1}
                    </Badge>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-600" />
                        Operações do Período (Fiscal & Contábil)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Antecipação de recebíveis, aquisições de CCBs, deságios e apuração
                        tributária.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    {selectedMonthLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 w-full max-w-full overflow-x-auto">
                <PeriodOperationsReportTab embedded={true} />
              </CardContent>
            </Card>
          </section>
        )}

        {/* 3. Extrato de Movimentações Bancárias */}
        {selectedReports.includes('bank-extract') && (
          <section className="unified-section-break w-full max-w-full">
            <Card className="w-full max-w-full shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                    >
                      Seção {selectedReports.indexOf('bank-extract') + 1}
                    </Badge>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        Extrato de Movimentações Bancárias
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Livro Caixa oficial com conciliação bancária, entradas, saídas e saldo
                        corrido.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    {selectedMonthLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 w-full max-w-full overflow-x-auto">
                <BankMovementExtractReportTab forcedMonth={selectedMonth} embedded={true} />
              </CardContent>
            </Card>
          </section>
        )}

        {/* 4. DRE Demonstrativo */}
        {selectedReports.includes('dre') && (
          <section className="unified-section-break w-full max-w-full">
            <Card className="w-full max-w-full shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                    >
                      Seção {selectedReports.indexOf('dre') + 1}
                    </Badge>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Scale className="w-4 h-4 text-purple-600" />
                        Demonstração do Resultado do Exercício (DRE)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Receitas brutas, deduções, custos e resultado líquido contábil da
                        competência.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    {selectedMonthLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 w-full max-w-full">
                {/* Resumo da DRE */}
                <div className="grid gap-4 md:grid-cols-3 print-break-inside-avoid">
                  <Card className="border-l-4 border-l-emerald-500 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total de Receitas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono text-emerald-600">
                        +{formatCurrency(dreDados?.totalReceitas || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-rose-500 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total de Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono text-rose-600">
                        -{formatCurrency(dreDados?.totalDespesas || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={cn(
                      'border-l-4 shadow-none',
                      (dreDados?.resultado || 0) >= 0
                        ? 'border-l-emerald-600'
                        : 'border-l-rose-600',
                    )}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Resultado Líquido
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          'text-2xl font-bold font-mono',
                          (dreDados?.resultado || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {formatCurrency(dreDados?.resultado || 0)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {(dreDados?.resultado || 0) >= 0
                          ? 'Superávit do Exercício'
                          : 'Déficit do Exercício'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela dos lançamentos DRE padronizada com shadcn Table */}
                <Card className="shadow-none">
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Lançamentos da DRE ({selectedMonthLabel})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="w-full max-w-full overflow-x-auto">
                      <Table className="w-full text-xs">
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px]">Data</TableHead>
                            <TableHead className="w-[110px]">Tipo</TableHead>
                            <TableHead className="min-w-[180px]">Categoria</TableHead>
                            <TableHead className="min-w-[260px]">Descrição</TableHead>
                            <TableHead className="w-[130px] text-right">Valor (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!dreDados?.lancamentos || dreDados.lancamentos.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-6 text-muted-foreground"
                              >
                                Nenhum lançamento encontrado para a competência selecionada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            dreDados.lancamentos.map((l, i) => (
                              <TableRow key={i} className="hover:bg-muted/30">
                                <TableCell className="whitespace-nowrap font-medium">
                                  {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell className="capitalize">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-medium',
                                      l.tipo === 'receita'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
                                    )}
                                  >
                                    {l.tipo}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{l.categoria}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {l.descricao}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-right font-mono font-medium whitespace-nowrap',
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
              </CardContent>
            </Card>
          </section>
        )}

        {/* 5. DFC Demonstrativo */}
        {selectedReports.includes('dfc') && (
          <section className="unified-section-break w-full max-w-full">
            <Card className="w-full max-w-full shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                    >
                      Seção {selectedReports.indexOf('dfc') + 1}
                    </Badge>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Demonstração do Fluxo de Caixa (DFC — FASB 95)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Movimentações classificadas por operações, investimentos e financiamentos
                        (método direto).
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    {selectedMonthLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 w-full max-w-full">
                {/* Resumo da DFC */}
                <div className="grid gap-4 md:grid-cols-4 print-break-inside-avoid">
                  <Card className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Saldo Inicial de Caixa
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold font-mono">
                        {formatCurrency(dfcDados?.saldoInicialCaixa || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Atividades Operacionais
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          'text-xl font-bold font-mono',
                          (dfcDados?.operacional.liquido || 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600',
                        )}
                      >
                        {formatCurrency(dfcDados?.operacional.liquido || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Ativ. Financiamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          'text-xl font-bold font-mono',
                          (dfcDados?.financiamento.liquido || 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600',
                        )}
                      >
                        {formatCurrency(dfcDados?.financiamento.liquido || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-primary/5 border-primary shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">
                        Saldo Final em Caixa
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold font-mono text-primary">
                        {formatCurrency(dfcDados?.saldoFinalLivroCaixa || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela dos lançamentos DFC padronizada com shadcn Table */}
                <Card className="shadow-none">
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Lançamentos do Fluxo de Caixa ({selectedMonthLabel})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="w-full max-w-full overflow-x-auto">
                      <Table className="w-full text-xs">
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px]">Data</TableHead>
                            <TableHead className="w-[130px]">Seção (FASB 95)</TableHead>
                            <TableHead className="w-[100px]">Sinal</TableHead>
                            <TableHead className="min-w-[180px]">Categoria</TableHead>
                            <TableHead className="min-w-[260px]">Descrição</TableHead>
                            <TableHead className="w-[130px] text-right">Valor (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!dfcDados?.lancamentosPeriodo ||
                          dfcDados.lancamentosPeriodo.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-6 text-muted-foreground"
                              >
                                Nenhum lançamento encontrado para a competência selecionada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            dfcDados.lancamentosPeriodo.map((l, i) => (
                              <TableRow key={i} className="hover:bg-muted/30">
                                <TableCell className="whitespace-nowrap font-medium">
                                  {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell className="uppercase font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                  {l.secao}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-medium capitalize',
                                      l.sinal === 'entrada'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
                                    )}
                                  >
                                    {l.sinal}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{l.categoria}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {l.descricao}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-right font-mono font-medium whitespace-nowrap',
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
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
