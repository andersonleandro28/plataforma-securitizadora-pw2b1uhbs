import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Users,
  DollarSign,
  Pencil,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Percent,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import { onlyDigits, maskCpf, validateCpf } from '@/lib/cpf-cnpj'
import { exportToCSV } from '@/lib/export-utils'
import {
  CreditManager,
  CreditManagerFormData,
  ManagerCommissionSummary,
  fetchCreditManagers,
  createCreditManager,
  updateCreditManager,
  toggleCreditManagerActive,
  fetchCommissionsForPeriod,
  registerManagerCommissionExpense,
} from '@/services/credit-managers'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'
import { useCompanyBankAccounts, formatBankAccountLabel } from '@/hooks/use-company-bank-accounts'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { printIsolatedManagerReceipt } from '@/lib/manager-commission-receipt'
import { FileCheck2 } from 'lucide-react'

export default function CreditManagers() {
  const { activeRole } = useAuth()
  const isReadOnly = activeRole === 'accountant'

  // Competência selecionada padrão (mês corrente YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [loadingManagers, setLoadingManagers] = useState(true)
  const [loadingCommissions, setLoadingCommissions] = useState(true)
  const [managers, setManagers] = useState<CreditManager[]>([])
  const [commissionsData, setCommissionsData] = useState<{
    summaries: ManagerCommissionSummary[]
    unassignedTotals: { count: number; discount: number }
    grandTotals: { operationsCount: number; totalDiscount: number; totalCommission: number }
  }>({
    summaries: [],
    unassignedTotals: { count: 0, discount: 0 },
    grandTotals: { operationsCount: 0, totalDiscount: 0, totalCommission: 0 },
  })

  // Contas bancárias da empresa (para registrar pagamento de comissão no Livro Caixa)
  const { accounts: bankAccounts } = useCompanyBankAccounts()
  const { settings } = useCompanySettings()

  // Diálogo de criação/edição de Gerente
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({})

  // Diálogo de Registro de Pagamento de Comissão (Livro Caixa)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payingSummary, setPayingSummary] = useState<ManagerCommissionSummary | null>(null)
  const [paymentBankAccountId, setPaymentBankAccountId] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [registeringPayment, setRegisteringPayment] = useState(false)

  const [formData, setFormData] = useState<CreditManagerFormData>({
    full_name: '',
    cpf: '',
    phone: '',
    email: '',
    commission_anticipation_pct: 0,
    commission_ccb_pct: 0,
    is_active: true,
  })

  // Carregar lista de gerentes
  const loadManagers = useCallback(async () => {
    setLoadingManagers(true)
    try {
      const list = await fetchCreditManagers(false)
      setManagers(list)
    } catch (err: any) {
      toast.error('Erro ao carregar gerentes: ' + err.message)
    } finally {
      setLoadingManagers(false)
    }
  }, [])

  // Carregar apuração de comissões por competência
  const loadCommissions = useCallback(async () => {
    setLoadingCommissions(true)
    try {
      const res = await fetchCommissionsForPeriod(selectedMonth)
      setCommissionsData(res)
    } catch (err: any) {
      toast.error('Erro ao carregar comissões do período: ' + err.message)
    } finally {
      setLoadingCommissions(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    loadManagers()
  }, [loadManagers])

  useEffect(() => {
    loadCommissions()
  }, [loadCommissions])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  // Abrir modal para novo gerente
  const handleOpenNew = () => {
    setEditingManagerId(null)
    setFormData({
      full_name: '',
      cpf: '',
      phone: '',
      email: '',
      commission_anticipation_pct: 5,
      commission_ccb_pct: 5,
      is_active: true,
    })
    setManagerModalOpen(true)
  }

  // Abrir modal para edição
  const handleOpenEdit = (m: CreditManager) => {
    if (isReadOnly) return
    setEditingManagerId(m.id)
    setFormData({
      full_name: m.full_name,
      cpf: maskCpf(m.cpf),
      phone: m.phone || '',
      email: m.email || '',
      commission_anticipation_pct: Number(m.commission_anticipation_pct) || 0,
      commission_ccb_pct: Number(m.commission_ccb_pct) || 0,
      is_active: m.is_active,
    })
    setManagerModalOpen(true)
  }

  // Alternar ativo/inativo
  const handleToggleStatus = async (m: CreditManager) => {
    if (isReadOnly) return
    try {
      const newStatus = await toggleCreditManagerActive(m.id, m.is_active)
      setManagers((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, is_active: newStatus } : item)),
      )
      toast.success(`Gerente "${m.full_name}" marcado como ${newStatus ? 'Ativo' : 'Inativo'}.`)
    } catch (err: any) {
      toast.error('Erro ao atualizar status: ' + err.message)
    }
  }

  // Salvar formulário do gerente
  const handleSaveManager = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Informe o nome completo do gerente de crédito.')
      return
    }

    const cpfDigits = onlyDigits(formData.cpf)
    if (!cpfDigits || cpfDigits.length !== 11 || !validateCpf(cpfDigits)) {
      toast.error('CPF inválido. Verifique os dígitos verificadores informados.')
      return
    }

    if (
      formData.commission_anticipation_pct < 0 ||
      formData.commission_anticipation_pct > 100 ||
      formData.commission_ccb_pct < 0 ||
      formData.commission_ccb_pct > 100
    ) {
      toast.error('Os percentuais de comissão devem estar entre 0% e 100%.')
      return
    }

    setSaving(true)
    try {
      if (editingManagerId) {
        await updateCreditManager(editingManagerId, {
          ...formData,
          cpf: cpfDigits,
        })
        toast.success('Gerente de crédito atualizado com sucesso!')
      } else {
        await createCreditManager({
          ...formData,
          cpf: cpfDigits,
        })
        toast.success('Gerente de crédito cadastrado com sucesso!')
      }
      setManagerModalOpen(false)
      loadManagers()
      loadCommissions()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar gerente de crédito.')
    } finally {
      setSaving(false)
    }
  }

  // Alternar expansão de detalhes do gerente no painel
  const toggleExpand = (mgrId: string) => {
    setExpandedManagers((prev) => ({
      ...prev,
      [mgrId]: !prev[mgrId],
    }))
  }

  // Abrir modal de pagamento de comissão
  const handleOpenPayment = (s: ManagerCommissionSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isReadOnly) return
    if (s.totalCommission <= 0) {
      toast.error('Este gerente não possui comissão a pagar no período.')
      return
    }
    if (s.isPaid) {
      toast.info('A comissão desta competência já foi registrada como despesa.')
      return
    }
    const defaultAcc = bankAccounts.find((b) => b.is_active)?.id || bankAccounts[0]?.id || ''
    setPayingSummary(s)
    setPaymentBankAccountId(defaultAcc)
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentModalOpen(true)
  }

  // Confirmar pagamento no Livro Caixa
  const handleConfirmPayment = async () => {
    if (!payingSummary) return
    if (!paymentBankAccountId) {
      toast.error('Selecione a conta bancária da empresa para a saída do caixa.')
      return
    }
    if (!paymentDate) {
      toast.error('Informe a data de pagamento da despesa.')
      return
    }

    setRegisteringPayment(true)
    try {
      const summaryToPay = payingSummary
      const paidDate = paymentDate
      const bankId = paymentBankAccountId

      await registerManagerCommissionExpense({
        managerId: summaryToPay.manager.id,
        managerName: summaryToPay.manager.full_name,
        periodMonth: selectedMonth,
        amount: summaryToPay.totalCommission,
        bankAccountId: bankId,
        paymentDate: paidDate,
      })
      toast.success(
        `Pagamento de ${formatCurrency(summaryToPay.totalCommission)} para ${summaryToPay.manager.full_name} registrado com sucesso no Livro Caixa!`,
      )

      // Perguntar ou gerar recibo automaticamente
      const bankAcc = bankAccounts.find((b) => b.id === bankId)
      const bankLabel = bankAcc ? formatBankAccountLabel(bankAcc) : undefined

      setPaymentModalOpen(false)
      setPayingSummary(null)
      await loadCommissions()

      // Dispara a impressão do recibo oficial com quitação
      printIsolatedManagerReceipt({
        summary: {
          ...summaryToPay,
          isPaid: true,
          paymentDetails: {
            expenseId: '',
            paidAt: paidDate,
            amount: summaryToPay.totalCommission,
            bankAccountId: bankId,
          },
        },
        periodMonth: selectedMonth,
        settings,
        bankAccountLabel: bankLabel,
        paymentDate: paidDate,
      })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento de comissão.')
    } finally {
      setRegisteringPayment(false)
    }
  }

  // Gerar recibo de comissão sob demanda
  const handlePrintReceipt = (s: ManagerCommissionSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!s.isPaid) {
      toast.warning('O recibo com quitação fica disponível apenas para comissões já pagas e registradas no Livro Caixa.')
      return
    }

    const bankAcc = s.paymentDetails?.bankAccountId
      ? bankAccounts.find((b) => b.id === s.paymentDetails?.bankAccountId)
      : bankAccounts.find((b) => b.is_active) || bankAccounts[0]
    const bankLabel = bankAcc ? formatBankAccountLabel(bankAcc) : undefined

    printIsolatedManagerReceipt({
      summary: s,
      periodMonth: selectedMonth,
      settings,
      bankAccountLabel: bankLabel,
      paymentDate: s.paymentDetails?.paidAt,
    })
  }
  }

  // Exportar comissões para CSV
  const handleExportCommissionsCSV = () => {
    if (!commissionsData.summaries || commissionsData.summaries.length === 0) {
      toast.error('Nenhum dado de comissão para exportar nesta competência.')
      return
    }

    const rows: Record<string, any>[] = []

    commissionsData.summaries.forEach((s) => {
      if (s.items.length === 0) {
        // Gerente sem operações no período
        rows.push({
          Competência: selectedMonth,
          'Gerente de Crédito': s.manager.full_name,
          'CPF Gerente': maskCpf(s.manager.cpf),
          'Status Gerente': s.manager.is_active ? 'Ativo' : 'Inativo',
          'Tipo Operação': 'Sem operações no período',
          'Contrato / Identificador': '—',
          'Data Operação': '—',
          'Cliente / Tomador': '—',
          'Valor de Face (R$)': '0.00',
          'Valor Líquido (R$)': '0.00',
          'Deságio Operação (R$)': '0.00',
          '% Comissão': '0.00',
          'Comissão a Pagar (R$)': '0.00',
          'Status Operação': '—',
        })
      } else {
        s.items.forEach((item) => {
          rows.push({
            Competência: selectedMonth,
            'Gerente de Crédito': s.manager.full_name,
            'CPF Gerente': maskCpf(s.manager.cpf),
            'Status Gerente': s.manager.is_active ? 'Ativo' : 'Inativo',
            'Tipo Operação':
              item.operationType === 'antecipacao' ? 'Antecipação de Recebíveis' : 'Aquisição CCB',
            'Contrato / Identificador': item.contractOrIdentifier,
            'Data Operação': item.operationDate ? formatDate(item.operationDate) : '—',
            'Cliente / Tomador': item.clientName,
            'Valor de Face (R$)': item.faceValue.toFixed(2),
            'Valor Líquido (R$)': item.paidValue.toFixed(2),
            'Deságio Operação (R$)': item.discountValue.toFixed(2),
            '% Comissão': item.commissionRatePct.toFixed(2),
            'Comissão a Pagar (R$)': item.commissionAmount.toFixed(2),
            'Status Operação': item.status,
          })
        })
      }

      // Linha de subtotal por gerente
      rows.push({
        Competência: selectedMonth,
        'Gerente de Crédito': `SUBTOTAL — ${s.manager.full_name}`,
        'CPF Gerente': maskCpf(s.manager.cpf),
        'Status Gerente': s.manager.is_active ? 'Ativo' : 'Inativo',
        'Tipo Operação': `${s.totalOperations} operação(ões)`,
        'Contrato / Identificador': '—',
        'Data Operação': '—',
        'Cliente / Tomador': '—',
        'Valor de Face (R$)': '—',
        'Valor Líquido (R$)': '—',
        'Deságio Operação (R$)': s.totalDiscount.toFixed(2),
        '% Comissão': '—',
        'Comissão a Pagar (R$)': s.totalCommission.toFixed(2),
        'Status Operação': '—',
      })
    })

    // Total Geral
    rows.push({
      Competência: selectedMonth,
      'Gerente de Crédito': 'TOTAL GERAL DE COMISSÕES',
      'CPF Gerente': '—',
      'Status Gerente': '—',
      'Tipo Operação': `${commissionsData.grandTotals.operationsCount} operação(ões)`,
      'Contrato / Identificador': '—',
      'Data Operação': '—',
      'Cliente / Tomador': '—',
      'Valor de Face (R$)': '—',
      'Valor Líquido (R$)': '—',
      'Deságio Operação (R$)': commissionsData.grandTotals.totalDiscount.toFixed(2),
      '% Comissão': '—',
      'Comissão a Pagar (R$)': commissionsData.grandTotals.totalCommission.toFixed(2),
      'Status Operação': '—',
    })

    exportToCSV(rows, `comissoes_gerentes_${selectedMonth}.csv`)
    toast.success('Planilha de comissões exportada com sucesso!')
  }

  // Lista de meses para o seletor de competência (últimos 12 meses + próximos 2)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = -12; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      options.push({
        value: val,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      })
    }
    return options.reverse()
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerentes de Crédito</h1>
          <p className="text-muted-foreground">
            Gestão da equipe de originadores, parametrização de comissionamento individual sobre o
            deságio e apuração de comissões por competência.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={handleOpenNew} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Novo Gerente
          </Button>
        )}
      </div>

      <Tabs defaultValue="commissions" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Painel de Comissões
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Cadastro de Gerentes
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ABA: PAINEL DE COMISSÕES                                 */}
        {/* ======================================================== */}
        <TabsContent value="commissions" className="space-y-6">
          {/* Barra de Filtros e Resumo do Período */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-xs text-muted-foreground">Competência de Apuração</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[220px] font-medium">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleExportCommissionsCSV}
              disabled={loadingCommissions}
              className="gap-2"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>

          {/* Cards de Métricas do Período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Operações Trazidas</span>
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {commissionsData.grandTotals.operationsCount} op(s)
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vinculadas a gerentes ativos/inativos na competência
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Deságio Total Originado</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-600">
                  {formatCurrency(commissionsData.grandTotals.totalDiscount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Base de cálculo (spread/deságio bruto trazido)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Comissão Total a Pagar</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(commissionsData.grandTotals.totalCommission)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total apurado aos gerentes no mês selecionado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Aviso se houver operações sem indicação */}
          {commissionsData.unassignedTotals.count > 0 && (
            <div className="p-3 bg-muted/40 border rounded-md flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span>
                  <strong>{commissionsData.unassignedTotals.count} operações</strong> do período
                  estão como <em>&quot;Sem indicação de gerente&quot;</em> (deságio de{' '}
                  {formatCurrency(commissionsData.unassignedTotals.discount)} isento de comissão).
                </span>
              </span>
            </div>
          )}

          {/* Tabela de Comissões por Gerente */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Apuração por Gerente de Crédito</CardTitle>
                <CardDescription>
                  Clique na linha de um gerente para detalhar os títulos e contratos vinculados.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCommissions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : commissionsData.summaries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum gerente cadastrado para apuração.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Gerente de Crédito</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead className="text-center">% Antecipação</TableHead>
                        <TableHead className="text-center">% CCB</TableHead>
                        <TableHead className="text-center">Operações</TableHead>
                        <TableHead className="text-right">Deságio Originado</TableHead>
                        <TableHead className="text-right">Comissão Devida</TableHead>
                        <TableHead className="text-center">Status Pagamento</TableHead>
                        <TableHead className="text-right pr-4">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissionsData.summaries.map((s) => {
                        const isExpanded = !!expandedManagers[s.manager.id]
                        const hasItems = s.items.length > 0

                        return (
                          <React.Fragment key={s.manager.id}>
                            <TableRow
                              className={`cursor-pointer transition-colors ${
                                hasItems ? 'hover:bg-muted/50' : 'opacity-80'
                              }`}
                              onClick={() => hasItems && toggleExpand(s.manager.id)}
                            >
                              <TableCell className="w-10 px-2 text-center">
                                {hasItems ? (
                                  isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )
                                ) : (
                                  <span className="text-muted-foreground/40">•</span>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{s.manager.full_name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {maskCpf(s.manager.cpf)}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {s.manager.commission_anticipation_pct}%
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {s.manager.commission_ccb_pct}%
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {s.totalOperations}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-foreground">
                                {formatCurrency(s.totalDiscount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-bold text-emerald-600">
                                {formatCurrency(s.totalCommission)}
                              </TableCell>
                              <TableCell className="text-center">
                                {s.isPaid ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500 text-emerald-700 bg-emerald-50 text-[11px] font-semibold flex items-center gap-1 mx-auto w-fit"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Pago
                                  </Badge>
                                ) : s.totalCommission > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-400 text-amber-700 bg-amber-50 text-[11px] font-medium mx-auto w-fit"
                                  >
                                    Pendente
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell
                                className="text-right pr-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  {s.isPaid ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => handlePrintReceipt(s, e)}
                                      className="text-xs h-8 gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                      title="Imprimir Recibo de Comissão com Quitação"
                                    >
                                      <FileCheck2 className="w-3.5 h-3.5" /> Recibo
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => handlePrintReceipt(s, e)}
                                      className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                                      title="Recibo indisponível até o registro do pagamento"
                                    >
                                      <FileCheck2 className="w-3.5 h-3.5" /> Recibo
                                    </Button>
                                  )}

                                  {!isReadOnly &&
                                    s.totalCommission > 0 &&
                                    !s.isPaid && (
                                      <Button
                                        size="sm"
                                        onClick={(e) => handleOpenPayment(s, e)}
                                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                      >
                                        <DollarSign className="w-3.5 h-3.5" /> Pagar Comissão
                                      </Button>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Subtabela de itens detalhados do gerente */}
                            {isExpanded && hasItems && (
                              <TableRow className="bg-muted/20">
                                <TableCell colSpan={10} className="p-4">
                                  <div className="rounded-md border bg-background p-3 space-y-2">
                                    <div className="flex items-center justify-between border-b pb-2">
                                      <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        Operações Trazidas por {s.manager.full_name} no período (
                                        {s.items.length})
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Antecipações: {s.anticipationsCount} | CCBs: {s.ccbsCount}
                                      </span>
                                    </div>

                                    <Table>
                                      <TableHeader>
                                        <TableRow className="text-[11px]">
                                          <TableHead>Tipo</TableHead>
                                          <TableHead>Identificador / Contrato</TableHead>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Cliente / Tomador</TableHead>
                                          <TableHead className="text-right">Valor Face</TableHead>
                                          <TableHead className="text-right">
                                            Valor Líquido
                                          </TableHead>
                                          <TableHead className="text-right">Deságio</TableHead>
                                          <TableHead className="text-center">
                                            % Comis. Aplicado
                                          </TableHead>
                                          <TableHead className="text-right">Comissão</TableHead>
                                          <TableHead className="text-center">Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {s.items.map((it) => (
                                          <TableRow
                                            key={it.operationId}
                                            className="text-xs hover:bg-muted/30"
                                          >
                                            <TableCell className="capitalize">
                                              {it.operationType === 'antecipacao'
                                                ? 'Antecipação'
                                                : 'CCB'}
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">
                                              {it.contractOrIdentifier}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {it.operationDate
                                                ? formatDate(it.operationDate)
                                                : '—'}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate">
                                              {it.clientName}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-[11px]">
                                              {formatCurrency(it.faceValue)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-[11px]">
                                              {formatCurrency(it.paidValue)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-[11px] text-foreground font-medium">
                                              {formatCurrency(it.discountValue)}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-[11px]">
                                              <span className="inline-flex items-center gap-1">
                                                {it.commissionRatePct}%
                                                {it.isHistoricalRate && (
                                                  <Badge
                                                    variant="secondary"
                                                    className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border border-primary/20"
                                                    title="Alíquota histórica vigente na data da operação"
                                                  >
                                                    histórico
                                                  </Badge>
                                                )}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">
                                              {formatCurrency(it.commissionAmount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <Badge
                                                variant="secondary"
                                                className="text-[10px] uppercase font-mono"
                                              >
                                                {it.status}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}

                      {/* Linha de Total Geral */}
                      <TableRow className="bg-muted/60 font-semibold border-t-2">
                        <TableCell></TableCell>
                        <TableCell colSpan={4} className="text-right uppercase text-xs">
                          Total Geral do Período:
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {commissionsData.grandTotals.operationsCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          {formatCurrency(commissionsData.grandTotals.totalDiscount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 text-base">
                          {formatCurrency(commissionsData.grandTotals.totalCommission)}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA: CADASTRO DE GERENTES                                */}
        {/* ======================================================== */}
        <TabsContent value="managers" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Equipe de Gerentes de Crédito</CardTitle>
                <CardDescription>
                  Configure os dados cadastrais e as taxas de comissionamento individual sobre o
                  deságio de antecipações e CCBs.
                </CardDescription>
              </div>
              {!isReadOnly && (
                <Button onClick={handleOpenNew} className="gap-2">
                  <Plus className="w-4 h-4" /> Novo Gerente
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingManagers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : managers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum gerente de crédito cadastrado. Clique no botão acima para adicionar o
                  primeiro.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-center">Comissão Antecipações</TableHead>
                      <TableHead className="text-center">Comissão CCBs</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-foreground">{m.full_name}</TableCell>
                        <TableCell className="font-mono text-xs">{maskCpf(m.cpf)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground space-y-0.5">
                          {m.email && <div>{m.email}</div>}
                          {m.phone && <div>{m.phone}</div>}
                          {!m.email && !m.phone && <div>—</div>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                            <Percent className="w-3 h-3" />
                            {m.commission_anticipation_pct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                            <Percent className="w-3 h-3" />
                            {m.commission_ccb_pct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={m.is_active}
                              onCheckedChange={() => handleToggleStatus(m)}
                              disabled={isReadOnly}
                            />
                            <span className="text-xs text-muted-foreground">
                              {m.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(m)}
                              className="px-2 text-blue-600 hover:text-blue-700"
                              title="Editar Gerente"
                            >
                              <Pencil className="w-4 h-4 mr-1" /> Editar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======================================================== */}
      {/* DIÁLOGO: CRIAR / EDITAR GERENTE                         */}
      {/* ======================================================== */}
      <Dialog
        open={managerModalOpen}
        onOpenChange={(open) => {
          setManagerModalOpen(open)
          if (!open) setEditingManagerId(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingManagerId ? 'Editar Gerente de Crédito' : 'Cadastrar Gerente de Crédito'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados cadastrais e as regras individuais de comissão sobre o deságio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mgr-name">Nome Completo *</Label>
              <Input
                id="mgr-name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ex: Carlos Eduardo de Oliveira"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mgr-cpf">CPF *</Label>
              <Input
                id="mgr-cpf"
                value={formData.cpf}
                onChange={(e) => {
                  const val = e.target.value
                  const digits = onlyDigits(val)
                  setFormData({ ...formData, cpf: maskCpf(digits) })
                }}
                onBlur={() => {
                  const digits = onlyDigits(formData.cpf)
                  if (!digits) return
                  if (digits.length !== 11 || !validateCpf(digits)) {
                    toast.error('CPF inválido. Verifique os dígitos verificadores.')
                  }
                }}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mgr-email">E-mail</Label>
                <Input
                  id="mgr-email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="gerente@nexum.com.br"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mgr-phone">Telefone / WhatsApp</Label>
                <Input
                  id="mgr-phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Configuração de Comissões */}
            <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
              <div className="border-b pb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" /> Comissionamento Individual (% sobre o Deságio)
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Percentual pago ao gerente incidente sobre o spread / deságio nominal das
                  operações trazidas.{' '}
                  <strong>
                    Alterar este percentual não afeta operações já registradas no histórico.
                  </strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mgr-comm-ant" className="text-xs">
                    % Antecipação de Recebíveis
                  </Label>
                  <div className="relative">
                    <Input
                      id="mgr-comm-ant"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.commission_anticipation_pct}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commission_anticipation_pct: Number(e.target.value),
                        })
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ex: Duplicatas, Cheques, etc.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mgr-comm-ccb" className="text-xs">
                    % Aquisição de CCBs
                  </Label>
                  <div className="relative">
                    <Input
                      id="mgr-comm-ccb"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.commission_ccb_pct}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commission_ccb_pct: Number(e.target.value),
                        })
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ex: Compras CCB BDIGITAL</p>
                </div>
              </div>
            </div>

            {/* Status Ativo / Inativo */}
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label className="text-sm font-medium">Status do Gerente</Label>
                <p className="text-xs text-muted-foreground">
                  Se inativo, não aparecerá para novas operações trazidas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <span className="text-xs font-semibold">
                  {formData.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setManagerModalOpen(false)
                setEditingManagerId(null)
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveManager} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingManagerId ? 'Salvar Alterações' : 'Cadastrar Gerente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIÁLOGO: REGISTRAR PAGAMENTO DE COMISSÃO (LIVRO CAIXA)  */}
      {/* ======================================================== */}
      <Dialog
        open={paymentModalOpen}
        onOpenChange={(open) => {
          setPaymentModalOpen(open)
          if (!open) setPayingSummary(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Registrar Pagamento de Comissão
            </DialogTitle>
            <DialogDescription>
              Registra uma despesa administrativa real no Livro Caixa na categoria{' '}
              <strong>Comissões de Gerentes</strong>, liquidando a apuração do mês.
            </DialogDescription>
          </DialogHeader>

          {payingSummary && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gerente:</span>
                  <span className="font-semibold text-foreground">
                    {payingSummary.manager.full_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF:</span>
                  <span className="font-mono">{maskCpf(payingSummary.manager.cpf)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Competência:</span>
                  <span className="font-semibold">{selectedMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operações apuradas:</span>
                  <span>{payingSummary.totalOperations} op(s)</span>
                </div>
                <div className="flex justify-between pt-1 border-t text-sm font-bold">
                  <span className="text-foreground">Valor da Comissão:</span>
                  <span className="text-emerald-600 font-mono">
                    {formatCurrency(payingSummary.totalCommission)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-date">Data do Pagamento *</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <CompanyBankAccountSelect
                value={paymentBankAccountId}
                onChange={setPaymentBankAccountId}
                label="Conta Bancária de Saída (Caixa) *"
                required
              />

              <p className="text-[11px] text-muted-foreground">
                Ao confirmar, um lançamento de despesa será gravado com status <strong>Pago</strong>{' '}
                e refletirá diretamente na conciliação contábil, DRE e Extrato Bancário.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentModalOpen(false)
                setPayingSummary(null)
              }}
              disabled={registeringPayment}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={registeringPayment || !paymentBankAccountId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {registeringPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
