import { useState, useMemo } from 'react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  FileSpreadsheet,
  FileText,
  Search,
  PackageOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react'
import { exportToCSV } from '@/lib/export-utils'
import type { Transaction } from '@/hooks/use-accounting'
import type { CompanyBankAccount } from '@/hooks/use-company-bank-accounts'
import { evaluateTransactionDeletionEligibility } from '@/services/financial-deletion'
import {
  DeleteFinancialRecordModal,
  type FinancialRecordToDelete,
} from '@/components/admin/DeleteFinancialRecordModal'

interface BankAccountStatementProps {
  transactions: Transaction[]
  accounts: CompanyBankAccount[]
  balances: Record<string, number>
  loading: boolean
  canWrite: boolean
  onRefresh: () => void
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function BankAccountStatement({
  transactions,
  accounts,
  balances,
  loading,
  canWrite,
  onRefresh,
}: BankAccountStatementProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('todas')
  const [selectedMonth, setSelectedMonth] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecordToDelete | null>(null)
  const [page, setPage] = useState(1)
  const itemsPerPage = 25

  // Opções de meses disponíveis
  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.slice(0, 7))
      }
    })
    return Array.from(set).sort().reverse()
  }, [transactions])

  // Contas disponíveis
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || null
  }, [accounts, selectedAccountId])

  // Identifica conta ativa
  const activeAccountId = useMemo(() => {
    const act = accounts.find((a) => a.is_active)
    return act ? act.id : accounts[0]?.id || null
  }, [accounts])

  // Lança o saldo corrido por conta (ou global se todas as contas)
  const transactionsWithAccountBalance = useMemo(() => {
    // Ordena cronologicamente crescente para correr o saldo
    const chronological = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    // Mapa de acumulador de saldo por conta bancária
    const runningBalances: Record<string, number> = {}
    let globalRunning = 0

    const calculated = chronological.map((t) => {
      // Determina a conta bancária da transação
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

    return calculated
  }, [transactions, activeAccountId])
  // Filtra por conta, mês e busca
  const filteredTransactions = useMemo(() => {
    return transactionsWithAccountBalance.filter((t) => {
      if (selectedAccountId !== 'todas') {
        if (t.computed_account_id !== selectedAccountId) {
          return false
        }
      }

      if (selectedMonth !== 'todos') {
        const tMonth = t.date?.slice(0, 7)
        if (tMonth !== selectedMonth) {
          return false
        }
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const descMatch = t.description?.toLowerCase().includes(term)
        const catMatch = t.category?.toLowerCase().includes(term)
        if (!descMatch && !catMatch) return false
      }

      return true
    })
  }, [transactionsWithAccountBalance, selectedAccountId, selectedMonth, searchTerm])

  // Ordena decrescente para exibição (mais recente primeiro)
  const displayList = useMemo(() => {
    return [...filteredTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [filteredTransactions])

  // Totais do período/filtro atual
  const { totalEntradas, totalSaidas, saldoPeriodo } = useMemo(() => {
    let ent = 0
    let sai = 0
    filteredTransactions.forEach((t) => {
      if (t.type === 'in') ent += t.value
      else sai += t.value
    })
    return {
      totalEntradas: ent,
      totalSaidas: sai,
      saldoPeriodo: ent - sai,
    }
  }, [filteredTransactions])

  // Paginação
  const paginatedList = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return displayList.slice(start, start + itemsPerPage)
  }, [displayList, page])

  const totalPages = Math.ceil(displayList.length / itemsPerPage)

  const handleExportCSV = () => {
    const csvData = displayList.map((t) => ({
      Data: formatDisplayDate(t.date),
      Tipo: t.type === 'in' ? 'Entrada' : 'Saída',
      Conta: t.bank_account_info
        ? `${t.bank_account_info.bank_name} - Ag: ${t.bank_account_info.branch || 'S/A'} C/C: ${t.bank_account_info.account_number}`
        : 'Conta Ativa Padrão',
      Categoria: t.category,
      Descrição: t.description,
      'Valor (R$)': t.type === 'in' ? t.value : -t.value,
      'Saldo Acumulado da Conta (R$)':
        selectedAccountId === 'todas'
          ? (t as any).global_running_balance
          : t.account_running_balance,
    }))
    const labelConta = selectedAccount ? selectedAccount.bank_name.replace(/\s+/g, '_') : 'Todas'
    exportToCSV(
      csvData,
      `Extrato_Conta_${labelConta}_${new Date().toISOString().split('T')[0]}.csv`,
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Cards de Saldo no Topo do Extrato */}
      <div className="grid gap-4 md:grid-cols-4">
        {accounts.map((acc) => {
          const bal = balances[acc.id] ?? 0
          const isSelected = selectedAccountId === acc.id

          return (
            <Card
              key={acc.id}
              onClick={() => {
                setSelectedAccountId(selectedAccountId === acc.id ? 'todas' : acc.id)
                setPage(1)
              }}
              className={`cursor-pointer transition-all border-l-4 ${
                isSelected
                  ? 'ring-2 ring-primary border-l-primary bg-primary/5'
                  : acc.is_active
                    ? 'border-l-emerald-500 hover:bg-muted/40'
                    : 'border-l-slate-400 hover:bg-muted/40'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-1">
                  <div>
                    <CardTitle className="text-sm font-semibold truncate flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-primary" />
                      {acc.bank_name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Ag: {acc.branch || 'S/A'} | C/C: {acc.account_number}
                    </p>
                  </div>
                  {acc.is_active && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Ativa
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-0.5 font-medium">
                  Saldo Atual em Caixa
                </div>
                <div
                  className={`text-2xl font-bold font-mono ${
                    bal >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(bal)}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {/* Card de Visão Geral / Consolidado */}
        <Card
          onClick={() => {
            setSelectedAccountId('todas')
            setPage(1)
          }}
          className={`cursor-pointer transition-all border-l-4 border-l-blue-500 ${
            selectedAccountId === 'todas'
              ? 'ring-2 ring-blue-500 bg-blue-50/20'
              : 'hover:bg-muted/40'
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              Consolidado Geral
            </CardTitle>
            <p className="text-xs text-muted-foreground">Soma de todas as contas cadastradas</p>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-0.5 font-medium">
              Saldo Total em Caixa
            </div>
            <div className="text-2xl font-bold font-mono text-blue-700">
              {formatCurrency(
                transactions.length > 0
                  ? transactions[0].accumulated_balance
                  : Object.values(balances).reduce((sum, v) => sum + (v || 0), 0),
              )}
            </div>
          </CardContent>
        </Card>{' '}
      </div>

      {/* Barra de Filtros e Ferramentas do Extrato */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Extrato Bancário Contábil
                {selectedAccount ? (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {selectedAccount.bank_name} ({selectedAccount.account_number})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-normal text-xs">
                    Todas as Contas (Agrupado/Separado)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Movimentações em tempo real do Livro Caixa vinculadas a cada conta bancária.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
                <FileText className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Seletor de Conta */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Conta Bancária</span>
              <Select
                value={selectedAccountId}
                onValueChange={(val) => {
                  setSelectedAccountId(val)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as Contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Contas</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bank_name} — C/C: {acc.account_number}{' '}
                      {acc.is_active ? '(Principal)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Período (Mês) */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Competência / Mês</span>
              <Select
                value={selectedMonth}
                onValueChange={(val) => {
                  setSelectedMonth(val)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Todos os Meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Histórico Completo</SelectItem>
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

            {/* Busca textual */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Buscar no Extrato</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Descrição, categoria ou valor..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
          </div>

          {/* Resumo de Entradas/Saídas do filtro */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-muted-foreground">Entradas no Filtro:</span>{' '}
                <strong className="text-emerald-600 font-mono font-semibold">
                  +{formatCurrency(totalEntradas)}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Saídas no Filtro:</span>{' '}
                <strong className="text-rose-600 font-mono font-semibold">
                  -{formatCurrency(totalSaidas)}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Resultado do Período:</span>{' '}
                <strong
                  className={`font-mono font-semibold ${
                    saldoPeriodo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(saldoPeriodo)}
                </strong>
              </div>
            </div>
            <div className="text-muted-foreground">
              Total de registros: <strong>{displayList.length}</strong>
            </div>
          </div>

          {/* Tabela de Extrato */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px] whitespace-nowrap">Data</TableHead>
                  <TableHead className="w-[80px]">Tipo</TableHead>
                  {selectedAccountId === 'todas' && <TableHead>Conta Bancária</TableHead>}
                  <TableHead className="min-w-[150px]">Categoria</TableHead>
                  <TableHead className="min-w-[280px]">Descrição</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Entrada</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Saída</TableHead>
                  <TableHead className="text-right whitespace-nowrap font-semibold">
                    Saldo Acumulado
                  </TableHead>
                  {canWrite && <TableHead className="text-center w-[60px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      {selectedAccountId === 'todas' && (
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      )}
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <Skeleton className="h-4 w-8 mx-auto" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : paginatedList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={selectedAccountId === 'todas' ? 9 : 8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <PackageOpen className="w-10 h-10 text-muted-foreground/40" />
                        <p>Nenhuma movimentação registrada para os filtros selecionados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedList.map((t) => {
                    const isTransfer =
                      t.category.toLowerCase().includes('transferência') ||
                      t.category.toLowerCase().includes('transferencia') ||
                      t.description.toLowerCase().includes('transferência entre contas') ||
                      t.description.toLowerCase().includes('transferencia entre contas')

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap font-medium text-xs">
                          {formatDisplayDate(t.date)}
                        </TableCell>
                        <TableCell>
                          {t.type === 'in' ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[11px]"
                            >
                              <ArrowDownLeft className="w-3 h-3" /> Entrada
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-200 gap-1 text-[11px]"
                            >
                              <ArrowUpRight className="w-3 h-3" /> Saída
                            </Badge>
                          )}
                        </TableCell>
                        {selectedAccountId === 'todas' && (
                          <TableCell className="whitespace-nowrap text-xs">
                            <span className="font-semibold text-foreground">
                              {t.bank_account_info?.bank_name || 'Conta Ativa'}
                            </span>
                            {t.bank_account_info?.account_number && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                C/C: {t.bank_account_info.account_number}
                              </div>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-xs font-medium">
                          {isTransfer ? (
                            <Badge variant="secondary" className="text-[11px] font-medium">
                              Transferência entre Contas
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
                          {t.type === 'in' ? `+${formatCurrency(t.value)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-rose-600 font-medium">
                          {t.type === 'out' ? `-${formatCurrency(t.value)}` : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-xs font-semibold ${
                            (selectedAccountId === 'todas'
                              ? ((t as any).global_running_balance ?? t.account_running_balance)
                              : t.account_running_balance) >= 0
                              ? 'text-foreground'
                              : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(
                            selectedAccountId === 'todas'
                              ? ((t as any).global_running_balance ?? t.account_running_balance)
                              : t.account_running_balance,
                          )}
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-center py-2">
                            <ExtractDeleteButtonCell
                              transaction={t}
                              onDelete={(item) => setRecordToDelete(item)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Exibindo {(page - 1) * itemsPerPage + 1} a{' '}
                {Math.min(page * itemsPerPage, displayList.length)} de {displayList.length}{' '}
                movimentações
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

      {/* Modal de exclusão com suporte ao par espelhado */}
      <DeleteFinancialRecordModal
        record={recordToDelete}
        open={!!recordToDelete}
        onClose={(open) => {
          if (!open) setRecordToDelete(null)
        }}
        onSuccess={() => {
          onRefresh()
        }}
      />
    </div>
  )
}

function ExtractDeleteButtonCell({
  transaction,
  onDelete,
}: {
  transaction: Transaction
  onDelete: (item: FinancialRecordToDelete) => void
}) {
  const eligibility = evaluateTransactionDeletionEligibility({
    id: transaction.id,
    categoria: transaction.category,
    descricao: transaction.description,
    type: transaction.type,
  })

  if (!eligibility.canDelete) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block cursor-not-allowed opacity-35">
              <Button
                variant="ghost"
                size="icon"
                disabled
                className="h-7 w-7 text-muted-foreground"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            {eligibility.reason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
      title="Excluir lançamento"
      onClick={() =>
        onDelete({
          id: transaction.id,
          descricao: transaction.description,
          valor: transaction.value,
          date: transaction.date,
          categoria: transaction.category,
          tipo: transaction.type,
          deletionTarget: eligibility,
        })
      }
    >
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  )
}
