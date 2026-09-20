import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  CalendarClock,
  ChevronRight,
  Receipt,
  FileText,
  DollarSign,
  Loader2,
  Filter,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

export type InstallmentItem = {
  number: number
  dueDate: string
  due_date?: string
  value: number | null
  valor_original?: number | null
  original_value?: number | null
  valor_atualizado?: number | null
  total_devido?: number | null
  prorrogacao_juros?: number | null
  prorrogacao_multa?: number | null
  status?: string
  documentName?: string | null
  file_url?: string | null
  payment_date?: string | null
  data_pagamento?: string | null
  amount_paid?: number | null
  interest_applied?: number | null
  penalty_applied?: number | null
  original_due_date?: string | null
  extension_interest?: number | null
  extension_penalty?: number | null
  extension_reason?: string | null
  notes?: string | null
}

export type CreditOperation = {
  id: string
  receivable_type: string
  cedente: string | null
  sacado: string | null
  document_number: string | null
  face_value: number
  requested_value: number
  issue_date: string | null
  due_date: string | null
  installments: number
  installments_data: InstallmentItem[] | null
  status: string
  liquidation_date: string | null
  liquidation_value: number | null
  operation_calculations?:
    | {
        discount_value: number
        interest_value: number
        net_value: number
        calculation_memory: any
      }[]
    | null
}

export function InstallmentReceivables() {
  const [operations, setOperations] = useState<CreditOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [selectedOp, setSelectedOp] = useState<CreditOperation | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Modais de ação
  const [liquidationOpen, setLiquidationOpen] = useState(false)
  const [activeInstallmentIdx, setActiveInstallmentIdx] = useState<number | null>(null)
  const [liquidationForm, setLiquidationForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    interest: '0',
    penalty: '0',
    notes: '',
  })
  const [actionLoading, setActionLoading] = useState(false)

  // Prorrogação
  const [extensionOpen, setExtensionOpen] = useState(false)
  const [extensionForm, setExtensionForm] = useState({
    new_due_date: '',
    interest: '0',
    penalty: '0',
    reason: '',
  })

  // Reversão
  const [revertOpen, setRevertOpen] = useState(false)

  // Edição rápida de valores de parcela
  const [editingValues, setEditingValues] = useState<Record<number, string>>({})
  const [isEditingValues, setIsEditingValues] = useState(false)
  const [savingValues, setSavingValues] = useState(false)

  // Helper para normalizar o array de parcelas de uma operação (inclusive parcela única)
  const getNormalizedInstallments = useCallback((op: CreditOperation): InstallmentItem[] => {
    if (Array.isArray(op.installments_data) && op.installments_data.length > 0) {
      return op.installments_data
    }
    // Para operações de parcela única ou sem installments_data preenchido
    const isOpPaid =
      (op.status || '').toLowerCase() === 'pago' || (op.status || '').toLowerCase() === 'liquidado'
    return [
      {
        number: 1,
        dueDate: op.due_date || '',
        due_date: op.due_date || '',
        value: Number(op.face_value || 0),
        valor_original: Number(op.face_value || 0),
        original_value: Number(op.face_value || 0),
        status: isOpPaid ? 'pago' : 'pendente',
        payment_date: isOpPaid ? op.liquidation_date : null,
        data_pagamento: isOpPaid ? op.liquidation_date : null,
        amount_paid: isOpPaid ? Number(op.liquidation_value || op.face_value || 0) : null,
      },
    ]
  }, [])

  const fetchOperations = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('credit_operations')
        .select(`
          id,
          receivable_type,
          cedente,
          sacado,
          document_number,
          face_value,
          requested_value,
          issue_date,
          due_date,
          installments,
          installments_data,
          status,
          liquidation_date,
          liquidation_value,
          operation_calculations(
            discount_value,
            interest_value,
            net_value,
            calculation_memory
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Inclui tanto operações parceladas quanto operações de parcela única
      // Normaliza garantindo que toda operação tenha um cronograma navegável
      const allReceivableOps = (data || []).map((op: any) => {
        const count = Number(op.installments || 1)
        const arr = Array.isArray(op.installments_data) ? op.installments_data : []
        const isOpPaid =
          (op.status || '').toLowerCase() === 'pago' ||
          (op.status || '').toLowerCase() === 'liquidado'

        const installmentsData =
          arr.length > 0
            ? arr
            : [
                {
                  number: 1,
                  dueDate: op.due_date || '',
                  due_date: op.due_date || '',
                  value: Number(op.face_value || 0),
                  valor_original: Number(op.face_value || 0),
                  original_value: Number(op.face_value || 0),
                  status: isOpPaid ? 'pago' : 'pendente',
                  payment_date: isOpPaid ? op.liquidation_date : null,
                  data_pagamento: isOpPaid ? op.liquidation_date : null,
                  amount_paid: isOpPaid ? Number(op.liquidation_value || op.face_value || 0) : null,
                },
              ]

        return {
          ...op,
          installments: Math.max(1, count, installmentsData.length),
          installments_data: installmentsData,
        }
      })

      setOperations(allReceivableOps as unknown as CreditOperation[])

      // Atualizar o selectedOp se estiver aberto
      if (selectedOp) {
        const current = (allReceivableOps as unknown as CreditOperation[]).find(
          (o) => o.id === selectedOp.id,
        )
        if (current) setSelectedOp(current)
      }
    } catch (err: any) {
      console.error('Erro ao buscar recebíveis:', err)
      toast.error('Erro ao carregar recebíveis: ' + (err.message || 'Falha de conexão'))
    } finally {
      setLoading(false)
    }
  }, [selectedOp])

  useEffect(() => {
    fetchOperations()
  }, [])

  // Helper para obter valores decompostos da parcela (original, juros prorrogação, multa prorrogação e total)
  const getInstallmentValues = (
    inst: InstallmentItem,
    op: CreditOperation,
  ): {
    originalValue: number
    extensionInterest: number
    extensionPenalty: number
    totalValue: number
    isExtended: boolean
  } => {
    const count = (op.installments_data || []).length || op.installments || 1
    const defaultVal = count > 0 ? Number(op.face_value || 0) / count : 0

    const rawStatus = (inst.status || '').toLowerCase()
    const isExtended =
      rawStatus === 'prorrogado' ||
      rawStatus === 'prorrogada' ||
      inst.original_due_date != null ||
      Number(inst.extension_interest || inst.prorrogacao_juros || 0) > 0

    // Valor original base do documento
    const originalValue =
      inst.valor_original != null
        ? Number(inst.valor_original)
        : inst.original_value != null
          ? Number(inst.original_value)
          : inst.value != null
            ? Number(inst.value)
            : defaultVal

    // Juros e multa da prorrogação
    const extensionInterest = Number(inst.prorrogacao_juros ?? inst.extension_interest ?? 0)
    const extensionPenalty = Number(inst.prorrogacao_multa ?? inst.extension_penalty ?? 0)

    // Se estiver prorrogada, o total é original + juros + multa (ou valor_atualizado / total_devido)
    let totalValue = originalValue
    if (isExtended) {
      if (inst.valor_atualizado != null && Number(inst.valor_atualizado) > 0) {
        totalValue = Number(inst.valor_atualizado)
      } else if (inst.total_devido != null && Number(inst.total_devido) > 0) {
        totalValue = Number(inst.total_devido)
      } else {
        totalValue = Number((originalValue + extensionInterest + extensionPenalty).toFixed(2))
      }
    }

    return {
      originalValue,
      extensionInterest,
      extensionPenalty,
      totalValue,
      isExtended,
    }
  }

  // Helper para calcular status da parcela
  const getInstallmentCalculatedStatus = (
    inst: InstallmentItem,
    op: CreditOperation,
  ): {
    status: 'paga' | 'vencida' | 'a_vencer' | 'prorrogada'
    label: string
    color: string
    daysLate: number
  } => {
    const rawStatus = (inst.status || '').toLowerCase()
    if (rawStatus === 'pago' || rawStatus === 'liquidado' || inst.payment_date) {
      return {
        status: 'paga',
        label: 'Paga',
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        daysLate: 0,
      }
    }

    const dueDateStr = inst.dueDate || inst.due_date || op.due_date
    if (!dueDateStr) {
      return {
        status: 'a_vencer',
        label: 'A Vencer',
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        daysLate: 0,
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const isLate = dueDateStr < todayStr

    const diffDays = Math.max(
      0,
      Math.round(
        (new Date(todayStr).getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24),
      ),
    )

    if (rawStatus === 'prorrogado') {
      if (isLate) {
        return {
          status: 'vencida',
          label: `Prorrogada (Vencida há ${diffDays}d)`,
          color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
          daysLate: diffDays,
        }
      }
      return {
        status: 'prorrogada',
        label: 'Prorrogada',
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        daysLate: 0,
      }
    }

    if (isLate) {
      return {
        status: 'vencida',
        label: `Vencida (${diffDays}d)`,
        color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        daysLate: diffDays,
      }
    }

    return {
      status: 'a_vencer',
      label: 'A Vencer',
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      daysLate: 0,
    }
  }

  // Filtragem
  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      const search = searchTerm.toLowerCase().trim()
      const matchSearch =
        !search ||
        (op.sacado && op.sacado.toLowerCase().includes(search)) ||
        (op.cedente && op.cedente.toLowerCase().includes(search)) ||
        (op.document_number && op.document_number.toLowerCase().includes(search)) ||
        op.id.toLowerCase().includes(search)

      if (!matchSearch) return false

      if (statusFilter === 'todas') return true

      const insts = Array.isArray(op.installments_data) ? op.installments_data : []
      if (insts.length === 0) return true

      const statuses = insts.map((i) => getInstallmentCalculatedStatus(i, op).status)

      if (statusFilter === 'vencidas') return statuses.includes('vencida')
      if (statusFilter === 'pendentes')
        return statuses.some((s) => s === 'vencida' || s === 'a_vencer' || s === 'prorrogada')
      if (statusFilter === 'pagas') return statuses.every((s) => s === 'paga')
      if (statusFilter === 'prorrogadas') return statuses.includes('prorrogada')

      return true
    })
  }, [operations, searchTerm, statusFilter])

  // Indicadores
  const indicators = useMemo(() => {
    let totalParcelas = 0
    let parcelasVencidas = 0
    let parcelasPagas = 0
    let parcelasProrrogadas = 0
    let valorTotalVencido = 0
    let valorTotalRecebido = 0
    let valorTotalProrrogado = 0
    let valorTotalJurosProrrogacao = 0

    operations.forEach((op) => {
      const insts = Array.isArray(op.installments_data) ? op.installments_data : []

      insts.forEach((inst) => {
        totalParcelas++
        const values = getInstallmentValues(inst, op)
        const calc = getInstallmentCalculatedStatus(inst, op)

        if (calc.status === 'vencida') {
          parcelasVencidas++
          valorTotalVencido += values.totalValue
        } else if (calc.status === 'paga') {
          parcelasPagas++
          valorTotalRecebido += Number(inst.amount_paid || values.totalValue)
        } else if (calc.status === 'prorrogada') {
          parcelasProrrogadas++
          valorTotalProrrogado += values.totalValue
          valorTotalJurosProrrogacao += values.extensionInterest + values.extensionPenalty
        }

        // Se for prorrogada mas estiver vencida, também soma no total de prorrogadas
        if (values.isExtended && calc.status !== 'prorrogada' && calc.status !== 'paga') {
          valorTotalProrrogado += values.totalValue
          valorTotalJurosProrrogacao += values.extensionInterest + values.extensionPenalty
        }
      })
    })

    return {
      totalParcelas,
      parcelasVencidas,
      parcelasPagas,
      parcelasProrrogadas,
      valorTotalVencido,
      valorTotalRecebido,
      valorTotalProrrogado,
      valorTotalJurosProrrogacao,
    }
  }, [operations])

  // Abrir detalhes de uma operação
  const handleOpenDetails = (op: CreditOperation) => {
    const insts = getNormalizedInstallments(op)
    const normalizedOp: CreditOperation = {
      ...op,
      installments_data: insts,
    }
    setSelectedOp(normalizedOp)

    const initValues: Record<number, string> = {}
    insts.forEach((inst, idx) => {
      const vals = getInstallmentValues(inst, normalizedOp)
      initValues[idx] = String(vals.originalValue)
    })
    setEditingValues(initValues)
    setIsEditingValues(false)
    setDetailsOpen(true)
  }

  // Preencher valores das parcelas se estiverem nulos
  const handleSaveInstallmentValues = async () => {
    if (!selectedOp) return
    setSavingValues(true)
    try {
      const insts = Array.isArray(selectedOp.installments_data)
        ? [...selectedOp.installments_data]
        : []
      const updated = insts.map((inst, idx) => {
        const newVal = Number(editingValues[idx] || 0)
        const vals = getInstallmentValues(inst, selectedOp)
        const isExt = vals.isExtended
        const extInterest = vals.extensionInterest
        const extPenalty = vals.extensionPenalty
        const newTotal = isExt ? Number((newVal + extInterest + extPenalty).toFixed(2)) : newVal

        return {
          ...inst,
          value: newVal,
          valor_original: newVal,
          original_value: newVal,
          ...(isExt
            ? {
                valor_atualizado: newTotal,
                total_devido: newTotal,
              }
            : {}),
        }
      })

      const { data, error } = await (supabase.rpc as any)('save_credit_operation_installments', {
        p_operation_id: selectedOp.id,
        p_installments_data: updated,
      })

      if (error) throw error

      toast.success('Valores das parcelas salvos com sucesso!')
      setIsEditingValues(false)
      fetchOperations()
      setSelectedOp({
        ...selectedOp,
        installments_data: updated,
      })
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao salvar valores: ' + (err.message || 'Falha ao salvar'))
    } finally {
      setSavingValues(false)
    }
  }

  // Iniciar Baixa
  const handleOpenLiquidation = (idx: number, inst: InstallmentItem) => {
    if (!selectedOp) return
    setActiveInstallmentIdx(idx)

    // Obter valores decompostos da parcela
    const instVals = getInstallmentValues(inst, selectedOp)
    const todayStr = new Date().toISOString().split('T')[0]
    const dueDateStr = inst.dueDate || inst.due_date || todayStr

    // Para parcelas prorrogadas, o valor sugerido principal já é o total atualizado
    // (valor original do documento + juros de prorrogação + multa pactuada)
    const baseAmount = instVals.isExtended ? instVals.totalValue : instVals.originalValue

    // Calcular atraso adicional após a data de vencimento (nova data se prorrogada)
    let suggestedInterest = 0
    let suggestedPenalty = 0

    if (dueDateStr < todayStr) {
      const daysLate = Math.max(
        0,
        Math.round(
          (new Date(todayStr).getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
      // Buscar taxa de juros da operação em calculations ou 3.5% a.m. padrão
      const calcMemory = (selectedOp.operation_calculations as any)?.[0]?.calculation_memory
      const monthlyRate = Number(
        calcMemory?.applied_params?.interest_rate_monthly ||
          calcMemory?.applied_params?.discount_rate_monthly ||
          3.5,
      )
      const penaltyRate = Number(calcMemory?.applied_params?.penalty_rate || 2.0)

      suggestedInterest = Number((baseAmount * (monthlyRate / 100 / 30) * daysLate).toFixed(2))
      suggestedPenalty = Number((baseAmount * (penaltyRate / 100)).toFixed(2))
    }

    setLiquidationForm({
      payment_date: todayStr,
      amount: String(baseAmount),
      interest: String(suggestedInterest),
      penalty: String(suggestedPenalty),
      notes: instVals.isExtended
        ? `Liquidação de parcela prorrogada (Nominal R$ ${instVals.originalValue.toFixed(2)} + Juros Prorr. R$ ${instVals.extensionInterest.toFixed(2)}${instVals.extensionPenalty > 0 ? ` + Multa R$ ${instVals.extensionPenalty.toFixed(2)}` : ''})`
        : '',
    })

    setLiquidationOpen(true)
  }

  // Confirmar Baixa
  const handleConfirmLiquidation = async () => {
    if (!selectedOp || activeInstallmentIdx === null) return
    setActionLoading(true)

    try {
      const amountPaid =
        Number(liquidationForm.amount || 0) +
        Number(liquidationForm.interest || 0) +
        Number(liquidationForm.penalty || 0)

      const { data, error } = await (supabase.rpc as any)(
        'liquidate_credit_operation_installment',
        {
          p_operation_id: selectedOp.id,
          p_installment_idx: activeInstallmentIdx,
          p_payment_date: liquidationForm.payment_date,
          p_amount_paid: amountPaid,
          p_interest_applied: Number(liquidationForm.interest || 0),
          p_penalty_applied: Number(liquidationForm.penalty || 0),
          p_notes: liquidationForm.notes || null,
        },
      )

      if (error) throw error

      toast.success(
        `Parcela ${activeInstallmentIdx + 1} baixada com sucesso! Lançamento de R$ ${amountPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sincronizado no Caixa e DRE.`,
      )
      setLiquidationOpen(false)
      setActiveInstallmentIdx(null)
      fetchOperations()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao baixar parcela: ' + (err.message || 'Falha na baixa'))
    } finally {
      setActionLoading(false)
    }
  }

  // Iniciar Prorrogação
  const handleOpenExtension = (idx: number, inst: InstallmentItem) => {
    if (!selectedOp) return
    setActiveInstallmentIdx(idx)

    const instVals = getInstallmentValues(inst, selectedOp)
    const baseVal = instVals.originalValue
    // Usa o vencimento original se existir para base de dias, ou o dueDate atual
    const origDue =
      inst.original_due_date ||
      inst.dueDate ||
      inst.due_date ||
      new Date().toISOString().split('T')[0]
    const currentDue = inst.dueDate || inst.due_date || origDue

    // Sugere prorrogação de 30 dias a partir do vencimento atual
    // Evitar bug de fuso horário ao somar 30 dias na string YYYY-MM-DD
    const [y, m, d] = (currentDue || new Date().toISOString().split('T')[0]).split('-').map(Number)
    const nextDueObj = new Date(y, m - 1, d)
    nextDueObj.setDate(nextDueObj.getDate() + 30)
    const nextDueYear = nextDueObj.getFullYear()
    const nextDueMonth = String(nextDueObj.getMonth() + 1).padStart(2, '0')
    const nextDueDate = String(nextDueObj.getDate()).padStart(2, '0')
    const nextDueStr = `${nextDueYear}-${nextDueMonth}-${nextDueDate}`

    // Cálculo automático de juros pró-rata desde a data de vencimento original até a nova data
    let days = 30
    if (nextDueStr > origDue) {
      const origDateObj = new Date(origDue + 'T00:00:00')
      const targetDateObj = new Date(nextDueStr + 'T00:00:00')
      days = Math.max(
        0,
        Math.round((targetDateObj.getTime() - origDateObj.getTime()) / (1000 * 60 * 60 * 24)),
      )
    }

    const calcMemory = (selectedOp.operation_calculations as any)?.[0]?.calculation_memory
    const monthlyRate = Number(
      calcMemory?.applied_params?.interest_rate_monthly ||
        calcMemory?.applied_params?.discount_rate_monthly ||
        3.5,
    )
    const penaltyRate = Number(calcMemory?.applied_params?.penalty_rate || 0)

    const calcInterest = Number((baseVal * (monthlyRate / 100 / 30) * days).toFixed(2))
    const calcPenalty = Number((baseVal * (penaltyRate / 100)).toFixed(2))

    setExtensionForm({
      new_due_date: nextDueStr,
      interest: String(calcInterest),
      penalty: String(calcPenalty),
      reason: inst.extension_reason || 'Solicitação do cliente para extensão do prazo',
    })

    setExtensionOpen(true)
  }

  // Recalcular juros quando a nova data for alterada na prorrogação
  const handleNewDueDateChange = (newDate: string) => {
    if (!selectedOp || activeInstallmentIdx === null) return
    const inst = (selectedOp.installments_data || [])[activeInstallmentIdx]
    const instVals = getInstallmentValues(inst, selectedOp)
    const baseVal = instVals.originalValue
    const origDue =
      inst?.original_due_date ||
      inst?.dueDate ||
      inst?.due_date ||
      new Date().toISOString().split('T')[0]

    let days = 0
    if (newDate && newDate > origDue) {
      const origDateObj = new Date(origDue + 'T00:00:00')
      const targetDateObj = new Date(newDate + 'T00:00:00')
      days = Math.max(
        0,
        Math.round((targetDateObj.getTime() - origDateObj.getTime()) / (1000 * 60 * 60 * 24)),
      )
    }

    const calcMemory = (selectedOp.operation_calculations as any)?.[0]?.calculation_memory
    const monthlyRate = Number(
      calcMemory?.applied_params?.interest_rate_monthly ||
        calcMemory?.applied_params?.discount_rate_monthly ||
        3.5,
    )

    const calcInterest = Number((baseVal * (monthlyRate / 100 / 30) * days).toFixed(2))

    setExtensionForm((prev) => ({
      ...prev,
      new_due_date: newDate,
      interest: String(calcInterest),
    }))
  }
  // Confirmar Prorrogação
  const handleConfirmExtension = async () => {
    if (!selectedOp || activeInstallmentIdx === null) return
    if (!extensionForm.new_due_date) {
      return toast.error('Informe a nova data de vencimento')
    }

    setActionLoading(true)
    try {
      const { data, error } = await (supabase.rpc as any)('extend_credit_operation_installment', {
        p_operation_id: selectedOp.id,
        p_installment_idx: activeInstallmentIdx,
        p_new_due_date: extensionForm.new_due_date,
        p_interest_calculated: Number(extensionForm.interest || 0),
        p_penalty_calculated: Number(extensionForm.penalty || 0),
        p_reason: extensionForm.reason || null,
      })

      if (error) throw error

      toast.success(
        `Parcela ${activeInstallmentIdx + 1} prorrogada com sucesso para ${formatDate(extensionForm.new_due_date)}! Juros de R$ ${Number(extensionForm.interest).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} incorporados.`,
      )
      setExtensionOpen(false)
      setActiveInstallmentIdx(null)
      fetchOperations()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao prorrogar parcela: ' + (err.message || 'Falha na prorrogação'))
    } finally {
      setActionLoading(false)
    }
  }

  // Iniciar Reversão
  const handleOpenRevert = (idx: number) => {
    setActiveInstallmentIdx(idx)
    setRevertOpen(true)
  }

  // Confirmar Reversão
  const handleConfirmRevert = async () => {
    if (!selectedOp || activeInstallmentIdx === null) return
    setActionLoading(true)

    try {
      const { data, error } = await (supabase.rpc as any)(
        'revert_credit_operation_installment_liquidation',
        {
          p_operation_id: selectedOp.id,
          p_installment_idx: activeInstallmentIdx,
        },
      )

      if (error) throw error

      toast.success(
        `Baixa da Parcela ${activeInstallmentIdx + 1} revertida com sucesso! Lançamento de receita estornado do Caixa e DRE.`,
      )
      setRevertOpen(false)
      setActiveInstallmentIdx(null)
      fetchOperations()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao reverter baixa: ' + (err.message || 'Falha ao reverter'))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Recebíveis e Parcelas</h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Mesa de Operações
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Gestão operacional de cronogramas (parceladas e parcela única), prorrogação de
            vencimentos com cálculo automático e baixa com conciliação contábil (DRE & Caixa).
          </p>
        </div>
        <Button variant="outline" onClick={fetchOperations} disabled={loading} className="gap-2">
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* Cards Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 flex items-center justify-between">
              <span>Parcelas Vencidas</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{indicators.parcelasVencidas}</div>
            <p className="text-xs text-rose-600/80 mt-1 font-medium">
              Total: R${' '}
              {indicators.valorTotalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>Parcelas Pagas</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{indicators.parcelasPagas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              R${' '}
              {indicators.valorTotalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
              recebidos
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center justify-between">
              <span>Prorrogadas</span>
              <CalendarClock className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {indicators.parcelasProrrogadas}
            </div>
            <p className="text-xs text-amber-600/90 mt-1 font-medium">
              Total a receber: R${' '}
              {indicators.valorTotalProrrogado.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
              {indicators.valorTotalJurosProrrogacao > 0 && (
                <span className="block text-[11px] font-normal text-amber-600/75">
                  (+R${' '}
                  {indicators.valorTotalJurosProrrogacao.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  juros/multa)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>Total no Cronograma</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indicators.totalParcelas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {indicators.totalParcelas} parcelas em {operations.length} operações
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por sacado, cedente, número de documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Operações (Parceladas e Únicas)</SelectItem>
                  <SelectItem value="vencidas">Com Vencidas</SelectItem>
                  <SelectItem value="pendentes">Pendentes (A vencer)</SelectItem>
                  <SelectItem value="prorrogadas">Com Prorrogações</SelectItem>
                  <SelectItem value="pagas">Liquidadas / Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Operações com Cronograma (Parceladas e Parcela Única) */}
      <Card>
        <CardHeader>
          <CardTitle>Recebíveis e Operações de Crédito</CardTitle>
          <CardDescription>
            Lista de operações parceladas e de parcela única. Clique em qualquer operação para
            visualizar o cronograma, realizar prorrogações automáticas com juros/multa ou registrar
            baixa com conciliação contábil.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Operação / Doc</TableHead>
                <TableHead>Sacado / Tomador</TableHead>
                <TableHead>Cedente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Formato / Parcelas</TableHead>
                <TableHead>Valor Face</TableHead>
                <TableHead>Status Geral</TableHead>
                <TableHead className="text-right pr-6">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Carregando operações e recebíveis...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredOperations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhuma operação encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOperations.map((op) => {
                  const insts = Array.isArray(op.installments_data) ? op.installments_data : []
                  const hasLate = insts.some(
                    (i) => getInstallmentCalculatedStatus(i, op).status === 'vencida',
                  )
                  const paidCount = insts.filter(
                    (i) => getInstallmentCalculatedStatus(i, op).status === 'paga',
                  ).length

                  // Calcular total atualizado do cronograma (incorporando juros/multas das parcelas prorrogadas)
                  let opTotalCronograma = 0
                  let opJurosProrrogacao = 0
                  let hasProrrogada = false

                  insts.forEach((i) => {
                    const vals = getInstallmentValues(i, op)
                    opTotalCronograma += vals.totalValue
                    if (vals.isExtended) {
                      hasProrrogada = true
                      opJurosProrrogacao += vals.extensionInterest + vals.extensionPenalty
                    }
                  })

                  // Se não houver cronograma ou for zero, fallback para face_value
                  if (insts.length === 0 || opTotalCronograma === 0) {
                    opTotalCronograma = Number(op.face_value || 0)
                  }

                  return (
                    <TableRow
                      key={op.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleOpenDetails(op)}
                    >
                      <TableCell className="pl-6 font-medium">
                        <div className="flex flex-col">
                          <span>{op.document_number || `OP-${op.id.substring(0, 8)}`}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(op.issue_date)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {op.sacado || 'Sacado não informado'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {op.cedente || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs font-normal">
                          {op.receivable_type || 'Crédito'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">
                              {paidCount} / {insts.length || op.installments || 1}
                            </span>
                            {(insts.length || op.installments || 1) === 1 && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[9px] font-normal"
                              >
                                Parcela Única
                              </Badge>
                            )}
                            {hasLate && (
                              <Badge
                                variant="destructive"
                                className="h-5 px-1.5 text-[10px] animate-pulse"
                              >
                                Vencida(s)
                              </Badge>
                            )}
                            {hasProrrogada && (
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 text-[10px] border-amber-500/50 bg-amber-500/10 text-amber-600"
                              >
                                Prorrogada
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            R${' '}
                            {opTotalCronograma.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {hasProrrogada && opJurosProrrogacao > 0 && (
                            <span
                              className="text-[10px] text-amber-600 font-medium"
                              title="Valor inclui juros/multas de prorrogação calculados"
                            >
                              (+R${' '}
                              {opJurosProrrogacao.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              juros)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            hasLate
                              ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                              : paidCount === (insts.length || op.installments)
                                ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                                : 'border-blue-500 text-blue-600 bg-blue-500/10'
                          }
                        >
                          {hasLate
                            ? 'Contém Atraso'
                            : paidCount === (insts.length || op.installments)
                              ? 'Liquidada'
                              : 'Em Aberto'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-primary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetails(op)
                          }}
                        >
                          Ver Parcelas
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Detalhes do Cronograma da Operação */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <span>Cronograma da Operação — {selectedOp?.sacado}</span>
                  {selectedOp && (selectedOp.installments_data || []).length <= 1 && (
                    <Badge variant="outline" className="text-xs">
                      Parcela Única
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Operação nº {selectedOp?.document_number || selectedOp?.id.substring(0, 8)} •
                  Cedente: {selectedOp?.cedente || 'N/A'} • Tipo:{' '}
                  {selectedOp?.receivable_type || 'Crédito'} • Valor de Face Original: R${' '}
                  {Number(selectedOp?.face_value || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                  {(() => {
                    const insts = Array.isArray(selectedOp?.installments_data)
                      ? selectedOp!.installments_data
                      : []
                    let totalJurosProrr = 0
                    insts.forEach((i) => {
                      const vals = getInstallmentValues(i, selectedOp!)
                      if (vals.isExtended) {
                        totalJurosProrr += vals.extensionInterest + vals.extensionPenalty
                      }
                    })
                    if (totalJurosProrr > 0) {
                      const totalAtual = Number(selectedOp?.face_value || 0) + totalJurosProrr
                      return (
                        <span className="font-semibold text-amber-600 block sm:inline sm:ml-2">
                          • Total Atualizado c/ Prorrogações: R${' '}
                          {totalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+R${' '}
                          {totalJurosProrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      )
                    }
                    return null
                  })()}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-2 overflow-y-auto flex-1 pr-1">
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Data de Emissão</span>
                  <span className="font-semibold text-sm">
                    {formatDate(selectedOp?.issue_date)}
                  </span>
                </div>
                <div className="h-6 w-px bg-border" />
                <div>
                  <span className="text-muted-foreground block">Vencimento Geral</span>
                  <span className="font-semibold text-sm">{formatDate(selectedOp?.due_date)}</span>
                </div>
                <div className="h-6 w-px bg-border" />
                <div>
                  <span className="text-muted-foreground block">Valor Solicitado</span>
                  <span className="font-semibold text-sm">
                    R${' '}
                    {Number(selectedOp?.requested_value || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {!isEditingValues ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingValues(true)}
                  className="gap-1 text-xs"
                >
                  Editar Valores das Parcelas
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingValues(false)}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveInstallmentValues}
                    disabled={savingValues}
                    className="gap-1 text-xs"
                  >
                    {savingValues ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Salvar Valores
                  </Button>
                </div>
              )}
            </div>

            {/* Cronograma Parcelas */}
            <Table className="border rounded-lg">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor a Receber</TableHead>
                  <TableHead>Status Calculado</TableHead>
                  <TableHead>Pagamento / Detalhes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOp &&
                  (selectedOp.installments_data || []).map((inst, idx) => {
                    const calc = getInstallmentCalculatedStatus(inst, selectedOp)
                    const instVals = getInstallmentValues(inst, selectedOp)
                    const isPaid = calc.status === 'paga'

                    return (
                      <TableRow
                        key={idx}
                        className={
                          calc.status === 'vencida'
                            ? 'bg-rose-500/5'
                            : instVals.isExtended && !isPaid
                              ? 'bg-amber-500/5'
                              : ''
                        }
                      >
                        <TableCell className="font-bold text-sm">
                          {inst.number || idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span
                              className={`font-medium ${calc.status === 'vencida' ? 'text-rose-600 font-bold' : ''}`}
                            >
                              {formatDate(inst.dueDate || inst.due_date)}
                            </span>
                            {inst.original_due_date &&
                              inst.original_due_date !== (inst.dueDate || inst.due_date) && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  Venc. Orig: {formatDate(inst.original_due_date)}
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditingValues && !isPaid ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingValues[idx] || ''}
                                  onChange={(e) =>
                                    setEditingValues({ ...editingValues, [idx]: e.target.value })
                                  }
                                  className="h-8 w-28 text-sm"
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                Valor nominal base
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {/* Valor principal em destaque: total (original + juros + multa) para prorrogadas */}
                              <div className="flex items-baseline gap-1.5">
                                <span
                                  className={`font-bold text-sm ${instVals.isExtended && !isPaid ? 'text-amber-600 dark:text-amber-400 font-mono text-base' : ''}`}
                                >
                                  R${' '}
                                  {instVals.totalValue.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                {instVals.isExtended && !isPaid && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10"
                                  >
                                    Total Atualizado
                                  </Badge>
                                )}
                              </div>

                              {/* Detalhamento visível para parcelas prorrogadas */}
                              {instVals.isExtended && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                                  <div>
                                    <span>Nominal: </span>
                                    <span className="font-mono">
                                      R${' '}
                                      {instVals.originalValue.toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                  {(instVals.extensionInterest > 0 ||
                                    instVals.extensionPenalty > 0) && (
                                    <div className="text-amber-700 dark:text-amber-400 font-medium">
                                      <span>+ Juros: </span>
                                      <span className="font-mono">
                                        R${' '}
                                        {instVals.extensionInterest.toLocaleString('pt-BR', {
                                          minimumFractionDigits: 2,
                                        })}
                                      </span>
                                      {instVals.extensionPenalty > 0 && (
                                        <span>
                                          {' '}
                                          + Multa: R${' '}
                                          {instVals.extensionPenalty.toLocaleString('pt-BR', {
                                            minimumFractionDigits: 2,
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {inst.value == null && !instVals.isExtended && (
                                <span className="text-[10px] text-muted-foreground">
                                  (rateio sugerido)
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${calc.color} text-xs font-medium`}>
                            {calc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isPaid ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-600 font-medium">
                                Pago em {formatDate(inst.payment_date || inst.data_pagamento)}
                              </span>
                              <span className="text-[11px]">
                                Total: R${' '}
                                {Number(inst.amount_paid || instVals.totalValue).toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )}
                              </span>
                              {(Number(inst.interest_applied || 0) > 0 ||
                                Number(inst.penalty_applied || 0) > 0) && (
                                <span className="text-[10px] text-muted-foreground">
                                  (+R${' '}
                                  {(
                                    Number(inst.interest_applied || 0) +
                                    Number(inst.penalty_applied || 0)
                                  ).toFixed(2)}{' '}
                                  juros/multa pós-vencimento)
                                </span>
                              )}
                            </div>
                          ) : inst.extension_reason ? (
                            <div className="flex flex-col">
                              <span className="italic line-clamp-1" title={inst.extension_reason}>
                                Motivo: {inst.extension_reason}
                              </span>
                              <span className="text-[10px] text-amber-600 font-medium">
                                Recalculado c/ juros diários
                              </span>
                            </div>
                          ) : (
                            <span>Aguardando liquidação</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenExtension(idx, inst)}
                                  className="h-8 text-xs gap-1 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                                  title="Prorrogar vencimento calculando juros automáticos"
                                >
                                  <CalendarClock className="w-3.5 h-3.5" />
                                  Prorrogar
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => handleOpenLiquidation(idx, inst)}
                                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Dar baixa nesta parcela (registra receita no DRE e Caixa)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Dar Baixa
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenRevert(idx)}
                                className="h-8 text-xs gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                title="Reverter liquidação e estornar lançamento da contabilidade/DRE"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reverter Baixa
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Baixa de Parcela */}
      <Dialog open={liquidationOpen} onOpenChange={setLiquidationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Dar Baixa na Parcela {(activeInstallmentIdx ?? 0) + 1}
            </DialogTitle>
            <DialogDescription>
              Operação {selectedOp?.sacado} — Confirme a data e os valores recebidos. O lançamento
              será sincronizado na Tesouraria (DRE) e no Livro Caixa (Contabilidade).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay_date">Data do Pagamento</Label>
                <Input
                  id="pay_date"
                  type="date"
                  value={liquidationForm.payment_date}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, payment_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_amount">Valor Base da Parcela</Label>
                <Input
                  id="pay_amount"
                  type="number"
                  step="0.01"
                  value={liquidationForm.amount}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, amount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay_interest">Juros de Atraso (R$)</Label>
                <Input
                  id="pay_interest"
                  type="number"
                  step="0.01"
                  value={liquidationForm.interest}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, interest: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_penalty">Multa (R$)</Label>
                <Input
                  id="pay_penalty"
                  type="number"
                  step="0.01"
                  value={liquidationForm.penalty}
                  onChange={(e) =>
                    setLiquidationForm({ ...liquidationForm, penalty: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay_notes">Observações / Comprovante</Label>
              <Textarea
                id="pay_notes"
                placeholder="Ex.: Recebido via PIX banco Itaú"
                value={liquidationForm.notes}
                onChange={(e) => setLiquidationForm({ ...liquidationForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="bg-muted p-3 rounded-lg border space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Valor Nominal:</span>
                <span>
                  R${' '}
                  {Number(liquidationForm.amount || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Juros / Multa:</span>
                <span>
                  + R${' '}
                  {(
                    Number(liquidationForm.interest || 0) + Number(liquidationForm.penalty || 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-foreground border-t pt-1.5">
                <span>Total a Liquidar:</span>
                <span className="text-emerald-600">
                  R${' '}
                  {(
                    Number(liquidationForm.amount || 0) +
                    Number(liquidationForm.interest || 0) +
                    Number(liquidationForm.penalty || 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setLiquidationOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmLiquidation}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Prorrogação de Parcela */}
      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              Prorrogar Parcela {(activeInstallmentIdx ?? 0) + 1}
            </DialogTitle>
            <DialogDescription>
              O sistema calcula automaticamente os juros proporcional diários até a nova data com
              base na taxa pactuada na operação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="ext_date">Nova Data de Vencimento</Label>
              <Input
                id="ext_date"
                type="date"
                value={extensionForm.new_due_date}
                onChange={(e) => handleNewDueDateChange(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ext_interest">Juros Calculados (R$)</Label>
                <Input
                  id="ext_interest"
                  type="number"
                  step="0.01"
                  value={extensionForm.interest}
                  onChange={(e) => setExtensionForm({ ...extensionForm, interest: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext_penalty">Multa se houver (R$)</Label>
                <Input
                  id="ext_penalty"
                  type="number"
                  step="0.01"
                  value={extensionForm.penalty}
                  onChange={(e) => setExtensionForm({ ...extensionForm, penalty: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ext_reason">Motivo / Justificativa da Prorrogação</Label>
              <Textarea
                id="ext_reason"
                placeholder="Ex.: Solicitação expressa do sacado via e-mail formal..."
                value={extensionForm.reason}
                onChange={(e) => setExtensionForm({ ...extensionForm, reason: e.target.value })}
                rows={2}
              />
            </div>

            <div className="bg-muted p-3 rounded-lg border space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Valor Original:</span>
                {(() => {
                  if (!selectedOp || activeInstallmentIdx === null) return null
                  const currentInst = (selectedOp.installments_data || [])[activeInstallmentIdx]
                  const currentVals = currentInst
                    ? getInstallmentValues(currentInst, selectedOp)
                    : null
                  return (
                    <span className="font-mono">
                      R${' '}
                      {Number(currentVals?.originalValue || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  )
                })()}
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>+ Juros e Multa Calculados:</span>
                <span className="font-mono text-amber-600 font-medium">
                  + R${' '}
                  {(
                    Number(extensionForm.interest || 0) + Number(extensionForm.penalty || 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-foreground border-t pt-1.5">
                <span>Novo Total da Parcela:</span>
                <span className="text-amber-600 font-mono">
                  {(() => {
                    if (!selectedOp || activeInstallmentIdx === null) return 'R$ 0,00'
                    const currentInst = (selectedOp.installments_data || [])[activeInstallmentIdx]
                    const currentVals = currentInst
                      ? getInstallmentValues(currentInst, selectedOp)
                      : null
                    const totalExt =
                      Number(currentVals?.originalValue || 0) +
                      Number(extensionForm.interest || 0) +
                      Number(extensionForm.penalty || 0)
                    return `R$ ${totalExt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  })()}
                </span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Atenção sobre a Prorrogação:
              </p>
              <p className="text-muted-foreground">
                A prorrogação atualiza o cronograma para exibir o valor total devido (original +
                juros/multa).{' '}
                <strong>Nenhum lançamento contábil de receita será gerado agora</strong>; o
                lançamento financeiro ocorrerá apenas no momento da baixa efetiva.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setExtensionOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmExtension}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarClock className="w-4 h-4" />
              )}
              Confirmar Prorrogação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Reversão de Baixa */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Reverter Liquidação da Parcela {(activeInstallmentIdx ?? 0) + 1}?
            </DialogTitle>
            <DialogDescription>
              Esta ação desfaz o recebimento e estorna automaticamente as receitas associadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <p>Ao confirmar a reversão:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                O status da parcela voltará a ser <strong>Pendente</strong>.
              </li>
              <li>A data e valores recebidos serão desvinculados do cronograma.</li>
              <li>
                O lançamento de receita será <strong>removido da Tesouraria e DRE</strong>.
              </li>
              <li>
                A movimentação será <strong>estornada do Livro Caixa (Contabilidade)</strong>.
              </li>
              <li>A ação será devidamente auditada com o identificador do administrador logado.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevertOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevert}
              disabled={actionLoading}
              className="gap-1"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Confirmar Reversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default InstallmentReceivables
