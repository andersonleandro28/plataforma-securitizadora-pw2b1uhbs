import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Plus,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  Info,
  CalendarRange,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { formatCompanyAddress } from '@/services/company-settings'
import { formatDate, cn } from '@/lib/utils'
import { exportToCSV } from '@/lib/export-utils'
import { printWithReportTitle } from '@/lib/print-with-title'
import {
  getConsolidatedProjectedCashflow,
  createManualProjectedEntry,
  updateManualProjectedEntry,
  deleteManualProjectedEntry,
  ProjectedCashflowData,
  ProjectedCashflowItem,
  ProjectedEntryType,
  ManualProjectedEntry,
  fetchManualProjectedEntries,
} from '@/services/projected-cashflow'

function formatCurrency(val: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0)
}

export function ProjectedCashflowReportTab() {
  const { settings } = useCompanySettings()
  const secRazaoSocial = settings?.razao_social || 'Nexum Securitizadora S.A.'
  const secNomeFantasia = settings?.nome_fantasia || 'Nexum Security 360º'
  const secCnpj = settings?.cnpj || '00.000.000/0001-00'
  const secEndereco = settings ? formatCompanyAddress(settings) : 'São Paulo - SP | Brasil'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProjectedCashflowData | null>(null)
  const [manualList, setManualList] = useState<ManualProjectedEntry[]>([])

  // Modo de filtro: 'competencia' (Mês início + Horizonte) ou 'periodo' (Data Inicial / Final)
  const [filterMode, setFilterMode] = useState<'competencia' | 'periodo'>('competencia')

  // Filtro de Competência: Mês de início (YYYY-MM) + Horizonte (3, 6, 12, 24 meses)
  const [startMonth, setStartMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [horizonMonths, setHorizonMonths] = useState<string>('6') // 3, 6, 12, 24, todos

  // Filtro de Intervalo livre (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Filtros adicionais
  const [searchTerm, setSearchTerm] = useState('')
  const [originFilter, setOriginFilter] = useState<string>('todas') // 'todas' | 'antecipacao' | 'ccb' | 'despesa' | 'resgate' | 'manual'
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

  // Diálogo de Lançamento Manual (Novo ou Editar)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [manualForm, setManualForm] = useState<{
    id?: string
    type: ProjectedEntryType
    description: string
    amount: string
    projected_date: string
    category: string
    notes: string
  }>({
    type: 'in',
    description: '',
    amount: '',
    projected_date: new Date().toISOString().split('T')[0],
    category: 'Recebível Futuro',
    notes: '',
  })

  // Diálogo de exclusão de lançamento manual
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingManual, setDeletingManual] = useState(false)

  // Opções de meses disponíveis para início
  const availableStartMonths = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = -6; i <= 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      options.push({ value, label: `${capitalized} (${value})` })
    }
    return options
  }, [])

  // Carrega dados consolidados
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConsolidatedProjectedCashflow()
      setData(res)

      // Inicializa os 3 primeiros meses expandidos por padrão
      const initialExpanded: Record<string, boolean> = {}
      res.monthlySummaries.slice(0, 3).forEach((m) => {
        initialExpanded[m.monthKey] = true
      })
      setExpandedMonths((prev) => ({ ...initialExpanded, ...prev }))

      const manuals = await fetchManualProjectedEntries()
      setManualList(manuals)
    } catch (err) {
      console.error('Erro ao carregar dados do fluxo projetado:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Determinar limites de data baseados no modo de filtro ativo
  const { filterStartDate, filterEndDate, filterPeriodLabel } = useMemo(() => {
    if (filterMode === 'competencia') {
      const [y, m] = startMonth.split('-').map(Number)
      const start = `${startMonth}-01`
      if (horizonMonths === 'todos') {
        return {
          filterStartDate: start,
          filterEndDate: '',
          filterPeriodLabel: `A partir de ${startMonth} (Horizonte Completo)`,
        }
      }
      const count = Number(horizonMonths) || 6
      const endD = new Date(y, m - 1 + count, 0)
      const endMonthStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}`
      const end = `${endMonthStr}-${String(endD.getDate()).padStart(2, '0')}`
      return {
        filterStartDate: start,
        filterEndDate: end,
        filterPeriodLabel: `${startMonth} a ${endMonthStr} (${count} meses)`,
      }
    } else {
      let label = 'Intervalo Livre'
      if (startDate && endDate) {
        label = `${formatDate(startDate)} a ${formatDate(endDate)}`
      } else if (startDate) {
        label = `A partir de ${formatDate(startDate)}`
      } else if (endDate) {
        label = `Até ${formatDate(endDate)}`
      } else {
        label = 'Todo o horizonte futuro'
      }
      return {
        filterStartDate: startDate,
        filterEndDate: endDate,
        filterPeriodLabel: label,
      }
    }
  }, [filterMode, startMonth, horizonMonths, startDate, endDate])

  // Itens filtrados por período, origem e busca
  const filteredItems = useMemo(() => {
    if (!data) return []

    return data.items.filter((item) => {
      // Filtro de data
      if (filterStartDate && item.date < filterStartDate) return false
      if (filterEndDate && item.date > filterEndDate) return false

      // Filtro de origem
      if (originFilter !== 'todas') {
        if (originFilter === 'antecipacao' && item.origin !== 'recebivel_antecipacao') return false
        if (originFilter === 'ccb' && item.origin !== 'recebivel_ccb') return false
        if (originFilter === 'despesa' && item.origin !== 'conta_pagar') return false
        if (originFilter === 'resgate' && item.origin !== 'resgate_investimento') return false
        if (
          originFilter === 'manual' &&
          item.origin !== 'manual_entrada' &&
          item.origin !== 'manual_saida'
        )
          return false
      }

      // Filtro de busca textual
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const descMatch = item.description.toLowerCase().includes(term)
        const entityMatch = item.entityName.toLowerCase().includes(term)
        const catMatch = item.category.toLowerCase().includes(term)
        const origMatch = item.originLabel.toLowerCase().includes(term)
        if (!descMatch && !entityMatch && !catMatch && !origMatch) return false
      }

      return true
    })
  }, [data, filterStartDate, filterEndDate, originFilter, searchTerm])

  // Recalcular resumos mensais com base no saldo inicial e itens filtrados
  const calculatedSummaries = useMemo(() => {
    if (!data) return []

    const initialCash = data.initialCashBalance
    const monthMap = new Map<string, ProjectedCashflowItem[]>()

    filteredItems.forEach((item) => {
      const mKey = item.date.slice(0, 7)
      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, [])
      }
      monthMap.get(mKey)!.push(item)
    })

    const sortedKeys = Array.from(monthMap.keys()).sort()
    let running = initialCash
    const list: typeof data.monthlySummaries = []

    sortedKeys.forEach((mKey) => {
      const monthItems = monthMap.get(mKey)!
      const startBal = running
      let mIn = 0
      let mOut = 0

      monthItems.forEach((i) => {
        if (i.type === 'in') mIn += i.amount
        else mOut += i.amount
      })

      const mNet = mIn - mOut
      running += mNet

      const [year, month] = mKey.split('-')
      const dateObj = new Date(Number(year), Number(month) - 1, 1)
      const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1)

      list.push({
        monthKey: mKey,
        monthLabel,
        totalIn: mIn,
        totalOut: mOut,
        monthNet: mNet,
        startingBalance: startBal,
        accumulatedBalance: running,
        items: monthItems,
      })
    })

    return list
  }, [data, filteredItems])

  // Totais do horizonte filtrado
  const { totalIn, totalOut, netBalance, finalBalance } = useMemo(() => {
    let tin = 0
    let tout = 0
    filteredItems.forEach((i) => {
      if (i.type === 'in') tin += i.amount
      else tout += i.amount
    })
    const net = tin - tout
    const final = (data?.initialCashBalance || 0) + net
    return {
      totalIn: tin,
      totalOut: tout,
      netBalance: net,
      finalBalance: final,
    }
  }, [filteredItems, data])

  const toggleMonth = (mKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [mKey]: !prev[mKey],
    }))
  }

  const expandAllMonths = () => {
    const updated: Record<string, boolean> = {}
    calculatedSummaries.forEach((s) => {
      updated[s.monthKey] = true
    })
    setExpandedMonths(updated)
  }

  const collapseAllMonths = () => {
    setExpandedMonths({})
  }

  // Abertura do modal de criação de lançamento manual
  const handleOpenCreateManual = (presetType: ProjectedEntryType = 'in') => {
    setManualForm({
      type: presetType,
      description: '',
      amount: '',
      projected_date: new Date().toISOString().split('T')[0],
      category: presetType === 'in' ? 'Recebível Futuro' : 'Pagamento Futuro',
      notes: '',
    })
    setManualDialogOpen(true)
  }

  // Abertura do modal de edição de lançamento manual
  const handleOpenEditManual = (item: ProjectedCashflowItem) => {
    setManualForm({
      id: item.referenceId || undefined,
      type: item.type,
      description: item.description,
      amount: String(item.amount),
      projected_date: item.date,
      category: item.category,
      notes: item.manualNotes || '',
    })
    setManualDialogOpen(true)
  }

  // Salvar lançamento manual
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(manualForm.amount.replace(/\./g, '').replace(',', '.'))
    if (!manualForm.description.trim() || isNaN(numAmount) || numAmount <= 0) {
      return
    }

    setSavingManual(true)
    try {
      if (manualForm.id) {
        await updateManualProjectedEntry(manualForm.id, {
          type: manualForm.type,
          description: manualForm.description,
          amount: numAmount,
          projected_date: manualForm.projected_date,
          category: manualForm.category,
          notes: manualForm.notes,
        })
      } else {
        await createManualProjectedEntry({
          type: manualForm.type,
          description: manualForm.description,
          amount: numAmount,
          projected_date: manualForm.projected_date,
          category: manualForm.category,
          notes: manualForm.notes,
        })
      }
      setManualDialogOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar lançamento manual projetado:', err)
    } finally {
      setSavingManual(false)
    }
  }

  // Confirmar exclusão de lançamento manual
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return
    setDeletingManual(true)
    try {
      await deleteManualProjectedEntry(deleteConfirmId)
      setDeleteConfirmId(null)
      loadData()
    } catch (err) {
      console.error('Erro ao excluir lançamento manual:', err)
    } finally {
      setDeletingManual(false)
    }
  }

  // Exportação CSV
  const handleExportCSV = () => {
    const csvRows = filteredItems.map((i) => ({
      Data: formatDate(i.date),
      Tipo: i.type === 'in' ? 'Entrada' : 'Saída',
      Origem: i.originLabel,
      Descrição: i.description,
      'Entidade (Tomador / Sacado / Investidor / Fornecedor)': i.entityName,
      Documento: i.entityDocument || '',
      Categoria: i.category,
      'Valor Projetado (R$)': i.type === 'in' ? i.amount : -i.amount,
      Situação: i.status === 'em_aberto' ? 'Em Aberto' : 'Previsto',
      'É Manual': i.isManual ? 'Sim' : 'Não',
    }))

    // Linha de totais
    csvRows.push({
      Data: 'TOTAIS DO HORIZONTE',
      Tipo: '—',
      Origem: 'Consolidado',
      Descrição: `Saldo Inicial em Caixa: ${formatCurrency(data?.initialCashBalance)}`,
      'Entidade (Tomador / Sacado / Investidor / Fornecedor)': `Entradas: ${formatCurrency(totalIn)} | Saídas: ${formatCurrency(totalOut)}`,
      Documento: '',
      Categoria: `Resultado do Período: ${formatCurrency(netBalance)}`,
      'Valor Projetado (R$)': finalBalance,
      Situação: 'Saldo Acumulado Final',
      'É Manual': '',
    })

    const fileName = `Fluxo_Caixa_Projetado_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(csvRows, fileName)
  }

  // Impressão / Salvar PDF com título automático
  const handlePrint = () => {
    const reportTitle = `Fluxo de Caixa Projetado — ${filterPeriodLabel}`
    printWithReportTitle(reportTitle)
  }

  // Helper para badge de origem
  const renderOriginBadge = (origin: ProjectedCashflowItem['origin'], label: string) => {
    switch (origin) {
      case 'recebivel_antecipacao':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
            Antecipação
          </Badge>
        )
      case 'recebivel_ccb':
        return (
          <Badge
            variant="outline"
            className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]"
          >
            CCB
          </Badge>
        )
      case 'conta_pagar':
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[11px]">
            Contas a Pagar
          </Badge>
        )
      case 'resgate_investimento':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]"
          >
            Resgate
          </Badge>
        )
      case 'manual_entrada':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
          >
            Manual (Entrada)
          </Badge>
        )
      case 'manual_saida':
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]"
          >
            Manual (Saída)
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {label}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho Executivo do Relatório */}
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                Tesouraria & Projeção
              </span>
              <span className="text-xs text-muted-foreground">• {secRazaoSocial}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Fluxo de Caixa Projetado
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Previsão de liquidez consolidando Contas a Pagar, Resgates de Investimentos,
              Recebíveis a Receber e Lançamentos Manuais Futuros.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCreateManual('in')}
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              <Plus className="w-4 h-4" /> Recebível Futuro
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCreateManual('out')}
              className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950"
            >
              <Plus className="w-4 h-4" /> Pagamento Futuro
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo Executivo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Saldo Inicial Real de Caixa */}
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Saldo Inicial em Caixa
              </CardTitle>
              <Landmark className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
              {formatCurrency(data?.initialCashBalance)}
            </div>
            <p
              className="text-xs text-muted-foreground mt-1 truncate"
              title="Soma das contas da Securitizadora"
            >
              {data?.accounts && data.accounts.length > 0
                ? `${data.accounts.length} conta(s) bancária(s)`
                : 'Livro Caixa oficial'}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total de Entradas Projetadas */}
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Entradas Projetadas
              </CardTitle>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(totalIn)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recebíveis + Entradas Manuais</p>
          </CardContent>
        </Card>

        {/* Card 3: Total de Saídas Projetadas */}
        <Card className="border-l-4 border-l-rose-500 bg-rose-50/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Saídas Projetadas
              </CardTitle>
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              -{formatCurrency(totalOut)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Contas a Pagar + Resgates</p>
          </CardContent>
        </Card>

        {/* Card 4: Saldo Líquido do Período */}
        <Card
          className={cn(
            'border-l-4',
            netBalance >= 0
              ? 'border-l-teal-500 bg-teal-50/10'
              : 'border-l-amber-500 bg-amber-50/10',
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Resultado do Período
              </CardTitle>
              {netBalance >= 0 ? (
                <TrendingUp className="w-4 h-4 text-teal-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-amber-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold font-mono',
                netBalance >= 0
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-amber-700 dark:text-amber-400',
              )}
            >
              {netBalance >= 0 ? '+' : ''}
              {formatCurrency(netBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Entradas menos Saídas</p>
          </CardContent>
        </Card>

        {/* Card 5: Saldo Acumulado Final Projetado */}
        <Card
          className={cn(
            'border-l-4',
            finalBalance >= 0
              ? 'border-l-indigo-500 bg-indigo-50/10'
              : 'border-l-destructive bg-destructive/10',
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Saldo Acumulado Final
              </CardTitle>
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold font-mono',
                finalBalance >= 0
                  ? 'text-indigo-700 dark:text-indigo-400'
                  : 'text-destructive font-black',
              )}
            >
              {formatCurrency(finalBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Caixa inicial + Resultado</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros (Padrão Recebíveis a Receber) */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Filtros e Parâmetros de Projeção
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filterMode === 'competencia' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterMode('competencia')}
                className="text-xs font-medium"
              >
                Modo Competência & Horizonte
              </Button>
              <Button
                variant={filterMode === 'periodo' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterMode('periodo')}
                className="text-xs font-medium"
              >
                Modo Intervalo (De / Até)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filterMode === 'competencia' ? (
              <>
                {/* Mês de Início */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Mês de Início
                  </Label>
                  <Select value={startMonth} onValueChange={setStartMonth}>
                    <SelectTrigger>
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStartMonths.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Horizonte de Projeção */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Horizonte Futuro
                  </Label>
                  <Select value={horizonMonths} onValueChange={setHorizonMonths}>
                    <SelectTrigger>
                      <CalendarRange className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Horizonte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Meses (Curto Prazo)</SelectItem>
                      <SelectItem value="6">6 Meses (Semestral)</SelectItem>
                      <SelectItem value="12">12 Meses (Anual)</SelectItem>
                      <SelectItem value="24">24 Meses (Bienal)</SelectItem>
                      <SelectItem value="todos">Todos os Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {/* Data Inicial */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Data Inicial
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* Data Final */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Data Final</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Filtro por Origem */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Origem do Fluxo</Label>
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as Origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Origens</SelectItem>
                  <SelectItem value="antecipacao">Antecipações (Recebíveis)</SelectItem>
                  <SelectItem value="ccb">CCBs (Parcelas)</SelectItem>
                  <SelectItem value="despesa">Contas a Pagar (Despesas)</SelectItem>
                  <SelectItem value="resgate">Resgates de Investimentos</SelectItem>
                  <SelectItem value="manual">Lançamentos Manuais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Busca Textual */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Buscar no Fluxo</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Descrição, sacado, fornecedor..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                Corte selecionado: <strong className="text-foreground">{filterPeriodLabel}</strong>
              </span>
              <span>•</span>
              <span>
                Total de lançamentos:{' '}
                <strong className="text-foreground">{filteredItems.length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAllMonths} className="h-7 text-xs">
                Expandir Todos os Meses
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAllMonths} className="h-7 text-xs">
                Recolher Todos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco de Saldo por Conta Bancária Real (Ponto de Partida) */}
      {data?.accounts && data.accounts.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-primary" />
              Saldos Bancários Reais — Ponto de Partida da Projeção
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {data.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3 rounded-md bg-background border flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold truncate">{acc.bankName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Ag: {acc.branch || 'S/A'} | C/C: {acc.accountNumber}
                      </div>
                    </div>
                    {acc.isActive && (
                      <Badge
                        variant="outline"
                        className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Principal
                      </Badge>
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold font-mono mt-2',
                      acc.balance >= 0 ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {formatCurrency(acc.balance)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grade de Meses / Cronograma de Projeção */}
      <div className="space-y-4">
        {calculatedSummaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">
                Nenhum lançamento previsto para os filtros selecionados.
              </p>
              <p className="text-xs mt-1">
                Tente expandir o horizonte ou clique em "Recebível Futuro" para adicionar previsões
                manuais.
              </p>
            </CardContent>
          </Card>
        ) : (
          calculatedSummaries.map((mSummary) => {
            const isExpanded = expandedMonths[mSummary.monthKey] ?? false

            return (
              <Card key={mSummary.monthKey} className="overflow-hidden border shadow-sm">
                {/* Linha Resumo do Mês (Accordion Trigger) */}
                <div
                  onClick={() => toggleMonth(mSummary.monthKey)}
                  className="p-4 bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer border-b flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">
                          {mSummary.monthLabel}
                        </span>
                        <Badge variant="secondary" className="text-xs font-mono font-normal">
                          {mSummary.items.length} item(ns)
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        Saldo Inicial: {formatCurrency(mSummary.startingBalance)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans">
                        Entradas
                      </span>
                      <strong className="text-emerald-600 text-sm">
                        +{formatCurrency(mSummary.totalIn)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans">
                        Saídas
                      </span>
                      <strong className="text-rose-600 text-sm">
                        -{formatCurrency(mSummary.totalOut)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans">
                        Líquido do Mês
                      </span>
                      <strong
                        className={cn(
                          'text-sm',
                          mSummary.monthNet >= 0 ? 'text-teal-600' : 'text-amber-600',
                        )}
                      >
                        {mSummary.monthNet >= 0 ? '+' : ''}
                        {formatCurrency(mSummary.monthNet)}
                      </strong>
                    </div>

                    <div className="pl-3 border-l">
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">
                        Saldo Acumulado
                      </span>
                      <strong
                        className={cn(
                          'text-base font-bold',
                          mSummary.accumulatedBalance >= 0
                            ? 'text-indigo-700 dark:text-indigo-400'
                            : 'text-destructive',
                        )}
                      >
                        {formatCurrency(mSummary.accumulatedBalance)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Tabela de Detalhes dos lançamentos do mês */}
                {isExpanded && (
                  <div className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="w-[100px] text-xs">Data</TableHead>
                          <TableHead className="w-[140px] text-xs">Origem</TableHead>
                          <TableHead className="min-w-[200px] text-xs">Descrição</TableHead>
                          <TableHead className="min-w-[160px] text-xs">
                            Entidade Vinculada
                          </TableHead>
                          <TableHead className="w-[120px] text-xs">Categoria</TableHead>
                          <TableHead className="w-[110px] text-right text-xs">Entrada</TableHead>
                          <TableHead className="w-[110px] text-right text-xs">Saída</TableHead>
                          <TableHead className="w-[80px] text-center text-xs">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mSummary.items.map((item) => {
                          return (
                            <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                              <TableCell className="font-mono whitespace-nowrap">
                                {formatDate(item.date)}
                              </TableCell>
                              <TableCell>
                                {renderOriginBadge(item.origin, item.originLabel)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {item.description}
                                </div>
                                {item.principalAmount !== undefined &&
                                  item.yieldAmount !== undefined &&
                                  item.yieldAmount > 0 && (
                                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                      Principal: {formatCurrency(item.principalAmount)} +
                                      Rendimentos: {formatCurrency(item.yieldAmount)}
                                    </div>
                                  )}
                                {item.manualNotes && (
                                  <div className="text-[11px] text-muted-foreground italic">
                                    Nota: {item.manualNotes}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="truncate max-w-[180px]" title={item.entityName}>
                                  {item.entityName}
                                </div>
                                {item.entityDocument && (
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {item.entityDocument}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {item.category}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-600">
                                {item.type === 'in' ? `+${formatCurrency(item.amount)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-rose-600">
                                {item.type === 'out' ? `-${formatCurrency(item.amount)}` : '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.isManual ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenEditManual(item)
                                      }}
                                      title="Editar Lançamento Manual"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setDeleteConfirmId(item.referenceId || null)
                                      }}
                                      title="Excluir Lançamento Manual"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">
                                    Automático
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* DIÁLOGO: CRIAR / EDITAR LANÇAMENTO MANUAL PROJETADO */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveManual}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                {manualForm.id ? 'Editar Lançamento Projetado' : 'Novo Lançamento Projetado'}
              </DialogTitle>
              <DialogDescription>
                Lançamentos manuais são dados de previsão e planejamento exclusivos deste relatório.
                Eles não afetam saldos bancários reais nem o Livro Caixa contábil.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Tipo: Entrada ou Saída */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo do Fluxo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={manualForm.type === 'in' ? 'default' : 'outline'}
                    onClick={() =>
                      setManualForm({
                        ...manualForm,
                        type: 'in',
                        category:
                          manualForm.category === 'Pagamento Futuro'
                            ? 'Recebível Futuro'
                            : manualForm.category,
                      })
                    }
                    className={cn(
                      'gap-2 text-xs',
                      manualForm.type === 'in' && 'bg-emerald-600 hover:bg-emerald-700',
                    )}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Entrada (Recebível Futuro)
                  </Button>
                  <Button
                    type="button"
                    variant={manualForm.type === 'out' ? 'default' : 'outline'}
                    onClick={() =>
                      setManualForm({
                        ...manualForm,
                        type: 'out',
                        category:
                          manualForm.category === 'Recebível Futuro'
                            ? 'Pagamento Futuro'
                            : manualForm.category,
                      })
                    }
                    className={cn(
                      'gap-2 text-xs',
                      manualForm.type === 'out' && 'bg-rose-600 hover:bg-rose-700',
                    )}
                  >
                    <ArrowDownRight className="w-4 h-4" /> Saída (Pagamento Futuro)
                  </Button>
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Descrição do Lançamento *</Label>
                <Input
                  required
                  placeholder={
                    manualForm.type === 'in'
                      ? 'Ex.: Aporte previsto de novo investidor, aporte de capital'
                      : 'Ex.: Distribuição de dividendos prevista, reforma da sede'
                  }
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                />
              </div>

              {/* Valor e Data Projetada */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Valor Previsto (R$) *</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data Prevista *</Label>
                  <Input
                    required
                    type="date"
                    value={manualForm.projected_date}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, projected_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Categoria / Classificação</Label>
                <Input
                  placeholder="Ex: Novos Negócios, Investimentos, Impostos, Despesas"
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                />
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Observações Internas (Opcional)</Label>
                <Textarea
                  placeholder="Notas adicionais sobre a previsão orçamentária..."
                  rows={2}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingManual}>
                {savingManual ? 'Salvando...' : manualForm.id ? 'Atualizar' : 'Salvar Projeção'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE LANÇAMENTO MANUAL */}
      <AlertDialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento Manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a previsão do cálculo do fluxo de caixa projetado. Como este
              lançamento é exclusivamente preditivo, nenhuma operação real ou saldo bancário será
              afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingManual}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletingManual}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingManual ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
