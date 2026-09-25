import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { formatCompanyAddress } from '@/services/company-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  PackageOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Calendar,
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { exportToCSV } from '@/lib/export-utils'
import { useAccounting, type Transaction } from '@/hooks/use-accounting'
import { useCompanyBankAccounts } from '@/hooks/use-company-bank-accounts'
import { cn } from '@/lib/utils'

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export interface BankMovementExtractReportTabProps {
  /** Se fornecido, força a competência (YYYY-MM ou 'todos') para uso no relatório unificado */
  forcedMonth?: string
  /** Se fornecido, oculta os controles de filtro e cabeçalho interativo para renderização de impressão embutida */
  embedded?: boolean
}

export function BankMovementExtractReportTab({
  forcedMonth,
  embedded = false,
}: BankMovementExtractReportTabProps = {}) {
  const { settings } = useCompanySettings()
  const secRazaoSocial = settings?.razao_social || 'Nexum Securitizadora S.A.'
  const secNomeFantasia = settings?.nome_fantasia || 'Nexum Security 360º'
  const secCnpj = settings?.cnpj || '00.000.000/0001-00'
  const secEndereco = settings ? formatCompanyAddress(settings) : 'São Paulo - SP | Brasil'
  const secContato = [settings?.telefone, settings?.email].filter(Boolean).join(' • ')

  const { data: rawTransactions, loading, error, refetch } = useAccounting()
  const { accounts } = useCompanyBankAccounts()

  const [selectedAccountId, setSelectedAccountId] = useState<string>('todas')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (forcedMonth) return forcedMonth
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [searchTerm, setSearchTerm] = useState('')

  // Sincroniza se a prop mudar
  useEffect(() => {
    if (forcedMonth && forcedMonth !== selectedMonth) {
      setSelectedMonth(forcedMonth)
    }
  }, [forcedMonth, selectedMonth])

  // Carrega todos os dados históricos sem restrição de data para calcular saldo inicial e corrido corretamente
  useEffect(() => {
    refetch()
  }, [refetch])

  // Opções de meses disponíveis (24 meses até o atual)
  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    // Adiciona os últimos 24 meses como padrão
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      set.add(`${y}-${m}`)
    }
    // Adiciona meses encontrados nas transações
    rawTransactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.slice(0, 7))
      }
    })
    return Array.from(set).sort().reverse()
  }, [rawTransactions])

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'todos') return 'Histórico Completo'
    const [ano, mes] = selectedMonth.split('-')
    if (!ano || !mes) return selectedMonth
    const dateObj = new Date(Number(ano), Number(mes) - 1, 1)
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [selectedMonth])

  // Identifica conta ativa padrão
  const activeAccountId = useMemo(() => {
    const act = accounts.find((a) => a.is_active)
    return act ? act.id : accounts[0]?.id || null
  }, [accounts])

  // Ordena cronologicamente e calcula o saldo acumulado corrido por conta e global
  const transactionsWithRunningBalance = useMemo(() => {
    // Cronológico crescente para correr o saldo
    const chronological = [...rawTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    const runningBalances: Record<string, number> = {}
    let globalRunning = 0

    return chronological.map((t) => {
      const accId = t.bank_account_id || activeAccountId || 'default'
      const prevBal = runningBalances[accId] ?? 0
      const delta = t.type === 'in' ? t.value : -t.value
      const newBal = prevBal + delta
      runningBalances[accId] = newBal
      globalRunning += delta

      return {
        ...t,
        computed_account_id: accId,
        account_running_balance: newBal,
        global_running_balance: globalRunning,
      }
    })
  }, [rawTransactions, activeAccountId])

  // Determina intervalo de datas da competência
  const { monthStart, monthEnd } = useMemo(() => {
    if (selectedMonth === 'todos') {
      return { monthStart: '', monthEnd: '' }
    }
    const [y, m] = selectedMonth.split('-')
    const yearNum = parseInt(y, 10)
    const monthNum = parseInt(m, 10)
    const firstDay = `${selectedMonth}-01`
    const lastDayDate = new Date(yearNum, monthNum, 0)
    const lastDay = `${selectedMonth}-${String(lastDayDate.getDate()).padStart(2, '0')}`
    return { monthStart: firstDay, monthEnd: lastDay }
  }, [selectedMonth])

  // Cálculo de saldos: Inicial, Entradas, Saídas, Saldo Período e Saldo Final Acumulado
  const summaryMetrics = useMemo(() => {
    let saldoInicial = 0
    let totalEntradas = 0
    let totalSaidas = 0
    let saldoFinalAcumulado = 0

    // Filtra transações que batem com a conta selecionada
    const accountEligible = transactionsWithRunningBalance.filter((t) => {
      if (selectedAccountId === 'todas') return true
      return t.computed_account_id === selectedAccountId
    })

    accountEligible.forEach((t) => {
      const delta = t.type === 'in' ? t.value : -t.value
      const dStr = t.date?.slice(0, 10) || ''

      if (selectedMonth !== 'todos' && monthStart && dStr < monthStart) {
        saldoInicial += delta
      }

      if (
        selectedMonth === 'todos' ||
        ((!monthStart || dStr >= monthStart) && (!monthEnd || dStr <= monthEnd))
      ) {
        if (t.type === 'in') totalEntradas += t.value
        else totalSaidas += t.value
      }

      if (selectedMonth === 'todos' || !monthEnd || dStr <= monthEnd) {
        saldoFinalAcumulado += delta
      }
    })

    const saldoPeriodo = totalEntradas - totalSaidas

    return {
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoPeriodo,
      saldoFinalAcumulado,
    }
  }, [transactionsWithRunningBalance, selectedAccountId, selectedMonth, monthStart, monthEnd])

  // Filtra as transações para a listagem (período, conta e busca)
  const filteredTransactions = useMemo(() => {
    return transactionsWithRunningBalance.filter((t) => {
      if (selectedAccountId !== 'todas') {
        if (t.computed_account_id !== selectedAccountId) {
          return false
        }
      }

      const dStr = t.date?.slice(0, 10) || ''
      if (selectedMonth !== 'todos') {
        if (monthStart && dStr < monthStart) return false
        if (monthEnd && dStr > monthEnd) return false
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const descMatch = t.description?.toLowerCase().includes(term)
        const catMatch = t.category?.toLowerCase().includes(term)
        const bankMatch = t.bank_account_info?.bank_name?.toLowerCase().includes(term)
        if (!descMatch && !catMatch && !bankMatch) return false
      }

      return true
    })
  }, [
    transactionsWithRunningBalance,
    selectedAccountId,
    selectedMonth,
    monthStart,
    monthEnd,
    searchTerm,
  ])

  // Ordenação para exibição: decrescente por data (mais recentes primeiro)
  const displayList = useMemo(() => {
    return [...filteredTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [filteredTransactions])

  // Contas disponíveis
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || null
  }, [accounts, selectedAccountId])

  const handleExportCSV = useCallback(() => {
    const csvData = displayList.map((t) => ({
      Data: formatDisplayDate(t.date),
      Tipo: t.type === 'in' ? 'Entrada' : 'Saída',
      'Conta Bancária': t.bank_account_info
        ? `${t.bank_account_info.bank_name} - Ag: ${t.bank_account_info.branch || 'S/A'} C/C: ${t.bank_account_info.account_number}`
        : 'Conta Principal',
      Categoria: t.category,
      Descrição: t.description,
      'Entrada (R$)': t.type === 'in' ? t.value : '',
      'Saída (R$)': t.type === 'out' ? t.value : '',
      'Saldo Acumulado Corrente (R$)':
        selectedAccountId === 'todas'
          ? (t as any).global_running_balance
          : t.account_running_balance,
    }))

    const labelConta = selectedAccount
      ? selectedAccount.bank_name.replace(/\s+/g, '_')
      : 'Todas_Contas'
    exportToCSV(csvData, `Extrato_Movimentacoes_Bancarias_${labelConta}_${selectedMonth}.csv`)
  }, [displayList, selectedAccountId, selectedAccount, selectedMonth])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div className="space-y-6">
      {/* Estilos embutidos para impressão contínua em PDF sem cortes e thead repetido — desativado quando embutido no relatório unificado para evitar conflito de @page */}
      {!embedded && (
        <style>{`
          @page {
            size: A4 landscape;
            margin: 10mm 8mm 10mm 8mm;
          }

          @media print {
            html, body {
              overflow: visible !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              background: white !important;
              color: black !important;
            }

            body * {
              visibility: hidden;
            }

            #root,
            #root > div,
            main,
            header,
            nav,
            aside,
            [data-sidebar="inset"],
            .flex,
            .flex-1,
            .space-y-6,
            .space-y-4 {
              overflow: visible !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              transform: none !important;
              animation: none !important;
            }

            #print-bank-extract-report,
            #print-bank-extract-report * {
              visibility: visible;
            }

            #print-bank-extract-report .no-print,
            #print-bank-extract-report .no-print * {
              display: none !important;
              visibility: hidden !important;
            }

            #print-bank-extract-report {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              font-size: 8.5px;
              background: white !important;
              color: black !important;
              box-shadow: none !important;
              overflow: visible !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
            }

            .no-print {
              display: none !important;
            }

            #print-bank-extract-report .shadow-sm,
            #print-bank-extract-report .shadow-md,
            #print-bank-extract-report .shadow-lg,
            #print-bank-extract-report .shadow {
              box-shadow: none !important;
            }

            #print-bank-extract-report .overflow-x-auto,
            #print-bank-extract-report .overflow-y-auto,
            #print-bank-extract-report .overflow-hidden,
            #print-bank-extract-report .overflow-auto,
            #print-bank-extract-report div:has(> table) {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
              display: block !important;
            }

            #print-bank-extract-report table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            #print-bank-extract-report thead {
              display: table-header-group !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #print-bank-extract-report tbody {
              display: table-row-group !important;
            }

            #print-bank-extract-report thead th {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #print-bank-extract-report tfoot {
              display: table-footer-group !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #print-bank-extract-report tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            #print-bank-extract-report th,
            #print-bank-extract-report td {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              padding: 3px 4px !important;
            }

            .print-break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}</style>
      )}

      {/* Cabeçalho da Seção */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Extrato de Movimentações Bancárias</h3>
            <p className="text-sm text-muted-foreground">
              Demonstrativo consolidado de todas as movimentações do Livro Caixa com critérios
              oficiais do DFC/Contabilidade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Baixar Planilha CSV
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
              <Printer className="w-4 h-4 text-blue-600" /> Imprimir / Salvar PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={loading}
              title="Recarregar dados"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      {!embedded && (
        <Card className="no-print">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Seletor de Mês de Competência */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Mês de Competência
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a competência" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="todos">Histórico Completo (Todos os Meses)</SelectItem>
                    {monthOptions.map((m) => {
                      const [ano, mes] = m.split('-')
                      const dateObj = new Date(Number(ano), Number(mes) - 1, 1)
                      const label = dateObj.toLocaleDateString('pt-BR', {
                        month: 'long',
                        year: 'numeric',
                      })
                      return (
                        <SelectItem key={m} value={m}>
                          {label.charAt(0).toUpperCase() + label.slice(1)} ({m})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Conta Bancária */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5" /> Conta Bancária
                </label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as Contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Consolidado Geral (Todas as Contas)</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.bank_name} — C/C: {acc.account_number}{' '}
                        {acc.is_active ? '(Principal)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca Textual */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Buscar Movimentação
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Descrição, categoria ou conta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Área Imprimível */}
      <div id="print-bank-extract-report" className="space-y-6">
        {/* Cabeçalho visível na impressão PDF */}
        <div className="hidden print:block border-b pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{secRazaoSocial}</h1>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {secNomeFantasia} — Securitizadora de Créditos & Emissora de Debêntures
              </div>
              <h2 className="text-lg font-semibold text-foreground mt-1">
                Extrato de Movimentações Bancárias (Livro Caixa Oficial)
              </h2>
              <div className="text-[11px] text-muted-foreground mt-0.5 space-x-2">
                <span>CNPJ: {secCnpj}</span>
                {secEndereco && <span>• {secEndereco}</span>}
                {secContato && <span>• {secContato}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Conta:{' '}
                <strong className="text-foreground">
                  {selectedAccount
                    ? `${selectedAccount.bank_name} (Ag: ${selectedAccount.branch || 'S/A'} - C/C: ${selectedAccount.account_number})`
                    : 'Consolidado Geral (Todas as Contas)'}
                </strong>
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                Competência: <strong className="text-foreground">{selectedMonthLabel}</strong>
              </div>
              <div>
                Gerado em: {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Resumo no Topo */}
        <div className="grid gap-4 md:grid-cols-4 print-break-inside-avoid">
          {/* Total Entradas */}
          <Card className="print-break-inside-avoid border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total de Entradas
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-emerald-600">
                  +{formatCurrency(summaryMetrics.totalEntradas)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Subscrições, liquidações e receitas da competência
              </p>
            </CardContent>
          </Card>

          {/* Total Saídas */}
          <Card className="print-break-inside-avoid border-l-4 border-l-rose-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total de Saídas
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-rose-600">
                  -{formatCurrency(summaryMetrics.totalSaidas)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Despesas, aquisições CCB, crédito e resgates
              </p>
            </CardContent>
          </Card>

          {/* Saldo do Período */}
          <Card
            className={cn(
              'print-break-inside-avoid border-l-4',
              summaryMetrics.saldoPeriodo >= 0 ? 'border-l-blue-500' : 'border-l-amber-500',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resultado do Período
              </CardTitle>
              <Layers className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div
                  className={cn(
                    'text-2xl font-bold font-mono',
                    summaryMetrics.saldoPeriodo >= 0 ? 'text-blue-600' : 'text-amber-600',
                  )}
                >
                  {formatCurrency(summaryMetrics.saldoPeriodo)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Variação líquida de caixa na competência
              </p>
            </CardContent>
          </Card>

          {/* Saldo Final Acumulado */}
          <Card className="print-break-inside-avoid bg-primary/5 border-primary border-l-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">
                Saldo Final Acumulado
              </CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(summaryMetrics.saldoFinalAcumulado)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Saldo corrido efetivo até o fim da competência
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Extrato Detalhado */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Movimentações Bancárias — {selectedMonthLabel}
                  {selectedAccount ? (
                    <Badge variant="secondary" className="font-normal text-xs ml-2">
                      {selectedAccount.bank_name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-xs ml-2">
                      Consolidado Geral
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Histórico completo de entradas, saídas, deduplicações do DFC e saldo acumulado
                  corrente linha a linha.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {displayList.length} registro{displayList.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 p-0 sm:p-6">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-600">
                <p className="font-semibold">Erro ao carregar dados do extrato bancário.</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <PackageOpen className="w-10 h-10 mb-2 opacity-40" />
                <p className="font-medium">
                  Nenhuma movimentação registrada para os filtros selecionados.
                </p>
                <p className="text-xs">Selecione outra competência ou altere a conta bancária.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[100px] whitespace-nowrap">Data Real</TableHead>
                      <TableHead className="w-[85px]">Tipo</TableHead>
                      <TableHead className="min-w-[150px]">Conta Bancária</TableHead>
                      <TableHead className="min-w-[160px]">Categoria</TableHead>
                      <TableHead className="min-w-[260px]">Descrição</TableHead>
                      <TableHead className="text-right min-w-[110px] whitespace-nowrap text-emerald-700">
                        Entrada (R$)
                      </TableHead>
                      <TableHead className="text-right min-w-[110px] whitespace-nowrap text-rose-700">
                        Saída (R$)
                      </TableHead>
                      <TableHead className="text-right min-w-[140px] whitespace-nowrap font-semibold">
                        Saldo Acumulado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayList.map((t) => {
                      const isEntrada = t.type === 'in'
                      const isTransfer =
                        t.category.toLowerCase().includes('transferência') ||
                        t.category.toLowerCase().includes('transferencia') ||
                        t.description.toLowerCase().includes('transferência entre contas') ||
                        t.description.toLowerCase().includes('transferencia entre contas')

                      const currentAccumulated =
                        selectedAccountId === 'todas'
                          ? ((t as any).global_running_balance ?? t.accumulated_balance)
                          : t.account_running_balance

                      return (
                        <TableRow key={t.id} className="hover:bg-muted/40 print-break-inside-avoid">
                          <TableCell className="whitespace-nowrap font-medium text-xs">
                            {formatDisplayDate(t.date)}
                          </TableCell>
                          <TableCell>
                            {isEntrada ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[11px] font-medium"
                              >
                                <ArrowDownLeft className="w-3 h-3" /> Entrada
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-200 gap-1 text-[11px] font-medium"
                              >
                                <ArrowUpRight className="w-3 h-3" /> Saída
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            <span className="font-semibold text-foreground">
                              {t.bank_account_info?.bank_name || 'Conta Ativa'}
                            </span>
                            {t.bank_account_info?.account_number && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Ag: {t.bank_account_info.branch || 'S/A'} | C/C:{' '}
                                {t.bank_account_info.account_number}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {isTransfer ? (
                              <Badge variant="secondary" className="text-[11px] font-normal">
                                Transferência Interna
                              </Badge>
                            ) : (
                              t.category
                            )}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground max-w-[320px] truncate"
                            title={t.description}
                          >
                            {t.description}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 font-medium">
                            {isEntrada ? `+${formatCurrency(t.value)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 font-medium">
                            {!isEntrada ? `-${formatCurrency(t.value)}` : '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono text-xs font-semibold',
                              currentAccumulated >= 0 ? 'text-foreground' : 'text-rose-600',
                            )}
                          >
                            {formatCurrency(currentAccumulated)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>

                  {/* Linha de Totais no Rodapé */}
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2 border-primary/20 text-xs">
                      <TableCell colSpan={5} className="uppercase tracking-wider">
                        Totais do Período ({displayList.length} movimentações)
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">
                        +{formatCurrency(summaryMetrics.totalEntradas)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-700">
                        -{formatCurrency(summaryMetrics.totalSaidas)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono text-sm',
                          summaryMetrics.saldoFinalAcumulado >= 0
                            ? 'text-primary'
                            : 'text-rose-600',
                        )}
                      >
                        {formatCurrency(summaryMetrics.saldoFinalAcumulado)}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé explicativo do relatório */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/20 rounded-md border border-dashed print-break-inside-avoid">
          <p className="font-semibold text-foreground">Regras e Critérios do Livro Caixa:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>Critérios de Data Real:</strong> As despesas utilizam a data efetiva de
              pagamento homologada na tabela oficial de despesas; resgates de investidores são
              registrados pela data da quitação bancária; aportes de capital utilizam valor
              histórico mesmo quando resgatados posteriormente.
            </li>
            <li>
              <strong>Operações e Aquisições:</strong> Desembolsos de crédito e aquisições de CCBs
              são computados como saídas pelo valor líquido transferido; parcelas e liquidações são
              computadas como entradas no recebimento.
            </li>
            <li>
              <strong>Transferências Internas:</strong> As transferências entre contas bancárias da
              própria securitizadora aparecem registradas para conciliação bancária, com o saldo
              corrido individual de cada conta atualizado com precisão.
            </li>
            <li>
              <strong>Saldo Acumulado Corrente:</strong> Calculado de forma estritamente cronológica
              desde o início da operação da empresa até cada registro apresentado.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
