import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  ArrowUpDown,
  Building2,
  TrendingUp,
} from 'lucide-react'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { formatCompanyAddress } from '@/services/company-settings'
import { formatDate, cn } from '@/lib/utils'
import { exportToCSV } from '@/lib/export-utils'
import { maskCpf, maskCnpj, onlyDigits } from '@/lib/cpf-cnpj'
import { printWithReportTitle } from '@/lib/print-with-title'

function formatCpfOrCnpj(val: string | null | undefined): string {
  if (!val) return '—'
  const digits = onlyDigits(val)
  if (digits.length === 11) return maskCpf(digits)
  if (digits.length === 14) return maskCnpj(digits)
  return val
}

export type ReceivableOriginType = 'antecipacao' | 'ccb'

export interface SingleReceivableItem {
  id: string // Identificador único da parcela (ex: op_id-inst_idx ou ccb_id-idx)
  originType: ReceivableOriginType
  originOperationId: string
  contractNumber: string // Número do documento ou OP-xxx / CCB-xxx
  receivableSubtype: string // "Duplicata", "Cheque", "CCB", etc.
  operationDate: string // Data de emissão/aquisição YYYY-MM-DD
  cedenteTomadorName: string // Nome da empresa tomadora/cedente
  cedenteTomadorDocument: string // CNPJ/CPF do cedente/tomador
  sacadoName: string // Sacado quando houver, ou parceiro/banco
  sacadoDocument: string // CNPJ/CPF do sacado se houver
  installmentNumber: number // Número da parcela (ex: 1, 2, 3...)
  totalInstallments: number // Total de parcelas do contrato (ex: 24)
  dueDate: string // Data de vencimento YYYY-MM-DD
  originalDueDate?: string | null
  faceValue: number // Valor de face da parcela (nominal ou atualizado com prorrogação)
  originalFaceValue: number
  isExtended: boolean
  extensionInterest: number
  extensionPenalty: number
  status: 'a_vencer' | 'vencido' | 'recebido' | 'prorrogado'
  statusLabel: string
  paymentDate?: string | null
  amountPaid?: number | null
  daysLate: number
  daysUntilDue: number
}

export interface ReceivablesToReceiveReportTabProps {
  embedded?: boolean
}

export function ReceivablesToReceiveReportTab({
  embedded = false,
}: ReceivablesToReceiveReportTabProps = {}) {
  const { settings } = useCompanySettings()
  const secRazaoSocial = settings?.razao_social || 'Nexum Securitizadora S.A.'
  const secNomeFantasia = settings?.nome_fantasia || 'Nexum Security 360º'
  const secCnpj = settings?.cnpj || '00.000.000/0001-00'
  const secEndereco = settings ? formatCompanyAddress(settings) : 'São Paulo - SP | Brasil'
  const secContato = [settings?.telefone, settings?.email].filter(Boolean).join(' • ')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rawReceivables, setRawReceivables] = useState<SingleReceivableItem[]>([])

  // Modo de filtro: 'competencia' (Mês e Ano) ou 'periodo' (Data Inicial e Data Final)
  const [filterMode, setFilterMode] = useState<'competencia' | 'periodo'>('competencia')

  // Filtro de competência (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Filtro de intervalo de datas customizado
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Filtros adicionais
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrigin, setSelectedOrigin] = useState<'todas' | 'antecipacao' | 'ccb'>('todas')
  const [includePaid, setIncludePaid] = useState<boolean>(false)
  const [statusFilter, setStatusFilter] = useState<
    'todos' | 'a_vencer' | 'vencido' | 'prorrogado' | 'recebido'
  >('todos')
  const [sortBy, setSortBy] = useState<'dueDate_asc' | 'dueDate_desc' | 'value_desc' | 'value_asc'>(
    'dueDate_asc',
  )

  // Geração de competências (36 meses para trás até 24 meses para frente, cobrindo o fluxo futuro de parcelas)
  const availableMonths = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'todos', label: 'Todos os Meses (Sem corte de competência)' },
    ]
    const now = new Date()
    // 24 meses para o futuro até 36 meses no passado
    for (let i = 24; i >= -36; i--) {
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

  /* ------------------------------------------------------------------ */
  /* Carga de Dados do Supabase                                         */
  /* ------------------------------------------------------------------ */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Operações de Antecipação de Recebíveis (credit_operations)
      const { data: creditOpsData, error: opsErr } = await supabase
        .from('credit_operations')
        .select(`
          id,
          document_number,
          receivable_type,
          receivable_type_other,
          cedente,
          sacado,
          sacado_document,
          face_value,
          requested_value,
          issue_date,
          due_date,
          installments,
          installments_data,
          status,
          liquidation_date,
          liquidation_value,
          created_at,
          profiles!credit_operations_borrower_id_fkey (
            id,
            full_name,
            document_number,
            pj_company_name
          )
        `)
        .not('status', 'in', '("cancelado","excluido","reprovado")')

      if (opsErr) throw opsErr

      // 2. Operações de CCBs (recebiveis_ccb)
      const { data: ccbData, error: ccbErr } = await supabase
        .from('recebiveis_ccb')
        .select(`
          id,
          ccb_id,
          acquisition_value,
          boleto_count,
          boleto_unit_value,
          gross_profit,
          boletos,
          status,
          created_at,
          ccb_solicitacoes (
            id,
            term_months,
            operation_data,
            borrower_data
          ),
          profiles!recebiveis_ccb_tomador_id_fkey (
            id,
            full_name,
            document_number,
            pj_company_name
          )
        `)
        .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")')

      if (ccbErr) throw ccbErr

      const items: SingleReceivableItem[] = []
      const todayStr = new Date().toISOString().split('T')[0]
      const todayTime = new Date(todayStr + 'T00:00:00').getTime()

      // Processar credit_operations (Antecipações)
      ;(creditOpsData || []).forEach((op: any) => {
        const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
        const tomadorName =
          prof?.pj_company_name || prof?.full_name || op.cedente || 'Cedente não informado'
        const tomadorDoc = prof?.document_number || ''
        const docNum = op.document_number || `OP-${op.id.substring(0, 8).toUpperCase()}`
        const subtype =
          op.receivable_type === 'outro' && op.receivable_type_other
            ? op.receivable_type_other
            : op.receivable_type || 'Duplicata'

        const instCount = Number(op.installments || 1)
        const arr = Array.isArray(op.installments_data) ? op.installments_data : []

        const isOpFullyPaid =
          ((op.status || '').toLowerCase() === 'pago' ||
            (op.status || '').toLowerCase() === 'liquidado') &&
          Boolean(op.liquidation_date)

        const rawList =
          arr.length > 0
            ? arr
            : [
                {
                  number: 1,
                  dueDate: op.due_date || op.issue_date || todayStr,
                  due_date: op.due_date || op.issue_date || todayStr,
                  value: Number(op.face_value || 0),
                  valor_original: Number(op.face_value || 0),
                  original_value: Number(op.face_value || 0),
                  status: isOpFullyPaid ? 'pago' : 'pendente',
                  payment_date: isOpFullyPaid ? op.liquidation_date : null,
                  data_pagamento: isOpFullyPaid ? op.liquidation_date : null,
                  amount_paid: isOpFullyPaid
                    ? Number(op.liquidation_value || op.face_value || 0)
                    : null,
                },
              ]

        rawList.forEach((inst: any, idx: number) => {
          const rawStatus = (inst.status || '').toLowerCase()
          const hasPayment = Boolean(
            (rawStatus === 'pago' || rawStatus === 'liquidado' || isOpFullyPaid) &&
            (inst.payment_date || inst.data_pagamento || op.liquidation_date),
          )

          const origVal =
            inst.valor_original != null
              ? Number(inst.valor_original)
              : inst.original_value != null
                ? Number(inst.original_value)
                : inst.value != null
                  ? Number(inst.value)
                  : instCount > 0
                    ? Number(op.face_value || 0) / instCount
                    : 0

          const isExt =
            rawStatus === 'prorrogado' ||
            rawStatus === 'prorrogada' ||
            inst.original_due_date != null ||
            Number(inst.extension_interest || inst.prorrogacao_juros || 0) > 0

          const extInterest = Number(inst.prorrogacao_juros ?? inst.extension_interest ?? 0)
          const extPenalty = Number(inst.prorrogacao_multa ?? inst.extension_penalty ?? 0)

          let faceVal = origVal
          if (isExt) {
            if (inst.valor_atualizado != null && Number(inst.valor_atualizado) > 0) {
              faceVal = Number(inst.valor_atualizado)
            } else if (inst.total_devido != null && Number(inst.total_devido) > 0) {
              faceVal = Number(inst.total_devido)
            } else {
              faceVal = Number((origVal + extInterest + extPenalty).toFixed(2))
            }
          }

          const dueStr = inst.dueDate || inst.due_date || op.due_date || todayStr
          const dueTime = new Date(dueStr + 'T00:00:00').getTime()
          const diffDays = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24))
          const daysLate = diffDays > 0 ? diffDays : 0
          const daysUntilDue = diffDays < 0 ? Math.abs(diffDays) : 0

          let calcStatus: 'a_vencer' | 'vencido' | 'recebido' | 'prorrogado' = 'a_vencer'
          let calcLabel = 'A Vencer'

          if (hasPayment) {
            calcStatus = 'recebido'
            calcLabel = 'Recebido'
          } else if (isExt) {
            if (dueStr < todayStr) {
              calcStatus = 'vencido'
              calcLabel = `Prorrogado (Vencido há ${daysLate}d)`
            } else {
              calcStatus = 'prorrogado'
              calcLabel = 'Prorrogado'
            }
          } else if (dueStr < todayStr) {
            calcStatus = 'vencido'
            calcLabel = `Vencido há ${daysLate}d`
          } else {
            calcStatus = 'a_vencer'
            calcLabel = daysUntilDue === 0 ? 'Vence Hoje' : `A Vencer (${daysUntilDue}d)`
          }

          items.push({
            id: `ant-${op.id}-${idx}`,
            originType: 'antecipacao',
            originOperationId: op.id,
            contractNumber: docNum,
            receivableSubtype: subtype,
            operationDate: op.issue_date || op.created_at?.split('T')[0] || todayStr,
            cedenteTomadorName: tomadorName,
            cedenteTomadorDocument: tomadorDoc,
            sacadoName: op.sacado || 'Sacado não informado',
            sacadoDocument: op.sacado_document || '',
            installmentNumber: Number(inst.number || idx + 1),
            totalInstallments: Math.max(instCount, rawList.length),
            dueDate: dueStr,
            originalDueDate: inst.original_due_date || null,
            faceValue: faceVal,
            originalFaceValue: origVal,
            isExtended: isExt,
            extensionInterest: extInterest,
            extensionPenalty: extPenalty,
            status: calcStatus,
            statusLabel: calcLabel,
            paymentDate: hasPayment
              ? inst.payment_date || inst.data_pagamento || op.liquidation_date
              : null,
            amountPaid: hasPayment
              ? Number(inst.amount_paid || op.liquidation_value || faceVal)
              : null,
            daysLate,
            daysUntilDue,
          })
        })
      })

      // Processar recebiveis_ccb (CCBs)
      ;(ccbData || []).forEach((ccb: any) => {
        const prof = Array.isArray(ccb.profiles) ? ccb.profiles[0] : ccb.profiles
        const ccbSol = Array.isArray(ccb.ccb_solicitacoes)
          ? ccb.ccb_solicitacoes[0]
          : ccb.ccb_solicitacoes

        const tomadorName =
          prof?.pj_company_name || prof?.full_name || ccbSol?.borrower_data?.name || 'Tomador CCB'
        const tomadorDoc = prof?.document_number || ccbSol?.borrower_data?.cpf || ''
        const partnerBank = ccbSol?.operation_data?.partner_bank || 'BDIGITAL'
        const contractNum = ccbSol?.id
          ? `CCB-${ccbSol.id.substring(0, 8).toUpperCase()}`
          : `AQC-${ccb.id.substring(0, 8).toUpperCase()}`

        const count = Number(ccb.boleto_count || 0)
        const unitVal = Number(ccb.boleto_unit_value || 0)
        const boletosList = Array.isArray(ccb.boletos) ? ccb.boletos : []

        boletosList.forEach((b: any, idx: number) => {
          const rawStatus = (b.status || '').toLowerCase()
          const isPaid =
            rawStatus === 'pago' ||
            rawStatus === 'liquidado' ||
            Boolean(b.payment_date || b.data_pagamento)

          const isExt =
            rawStatus === 'prorrogado' ||
            rawStatus === 'prorrogada' ||
            b.original_due_date != null ||
            b.extended_due_date != null ||
            Number(b.extension_interest || b.prorrogacao_juros || b.extended_fee || 0) > 0

          const origVal =
            b.original_value != null
              ? Number(b.original_value)
              : b.valor_original != null
                ? Number(b.valor_original)
                : Number(b.unit_value ?? unitVal ?? 0)

          const extInterest = Number(
            b.prorrogacao_juros ?? b.extension_interest ?? b.extended_fee ?? 0,
          )
          const extPenalty = Number(b.prorrogacao_multa ?? b.extension_penalty ?? 0)

          let faceVal = origVal
          if (isExt) {
            if (b.valor_atualizado != null && Number(b.valor_atualizado) > 0) {
              faceVal = Number(b.valor_atualizado)
            } else if (b.total_devido != null && Number(b.total_devido) > 0) {
              faceVal = Number(b.total_devido)
            } else if (b.unit_value != null && Number(b.unit_value) > 0) {
              faceVal = Number(b.unit_value)
            } else {
              faceVal = Number((origVal + extInterest + extPenalty).toFixed(2))
            }
          } else {
            faceVal = Number(b.unit_value ?? unitVal ?? 0)
          }

          const dueStr = b.due_date || b.dueDate || b.extended_due_date || todayStr
          const dueTime = new Date(dueStr + 'T00:00:00').getTime()
          const diffDays = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24))
          const daysLate = diffDays > 0 ? diffDays : 0
          const daysUntilDue = diffDays < 0 ? Math.abs(diffDays) : 0

          let calcStatus: 'a_vencer' | 'vencido' | 'recebido' | 'prorrogado' = 'a_vencer'
          let calcLabel = 'A Vencer'

          if (isPaid) {
            calcStatus = 'recebido'
            calcLabel = 'Recebido'
          } else if (isExt) {
            if (dueStr < todayStr) {
              calcStatus = 'vencido'
              calcLabel = `Prorrogado (Vencido há ${daysLate}d)`
            } else {
              calcStatus = 'prorrogado'
              calcLabel = 'Prorrogado'
            }
          } else if (dueStr < todayStr) {
            calcStatus = 'vencido'
            calcLabel = `Vencido há ${daysLate}d`
          } else {
            calcStatus = 'a_vencer'
            calcLabel = daysUntilDue === 0 ? 'Vence Hoje' : `A Vencer (${daysUntilDue}d)`
          }

          items.push({
            id: `ccb-${ccb.id}-${idx}`,
            originType: 'ccb',
            originOperationId: ccb.id,
            contractNumber: contractNum,
            receivableSubtype: `CCB (${partnerBank})`,
            operationDate: ccb.created_at?.split('T')[0] || todayStr,
            cedenteTomadorName: tomadorName,
            cedenteTomadorDocument: tomadorDoc,
            sacadoName: `Emissor Direto / ${partnerBank}`,
            sacadoDocument: '',
            installmentNumber: idx + 1,
            totalInstallments: count || boletosList.length,
            dueDate: dueStr,
            originalDueDate: b.original_due_date || null,
            faceValue: faceVal,
            originalFaceValue: origVal,
            isExtended: isExt,
            extensionInterest: extInterest,
            extensionPenalty: extPenalty,
            status: calcStatus,
            statusLabel: calcLabel,
            paymentDate: isPaid ? b.payment_date || b.data_pagamento : null,
            amountPaid: isPaid ? Number(b.amount_paid || faceVal) : null,
            daysLate,
            daysUntilDue,
          })
        })
      })

      setRawReceivables(items)
    } catch (err: any) {
      console.error('Erro ao buscar recebíveis a receber:', err)
      setError(err.message || 'Falha ao buscar dados no banco.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ------------------------------------------------------------------ */
  /* Filtragem dos Recebíveis                                           */
  /* ------------------------------------------------------------------ */
  const filteredList = useMemo(() => {
    return rawReceivables.filter((item) => {
      // 1. Filtro de Origem (Antecipações vs CCBs)
      if (selectedOrigin !== 'todas' && item.originType !== selectedOrigin) {
        return false
      }

      // 2. Filtro de Recebidos / Liquidados
      if (!includePaid && item.status === 'recebido') {
        return false
      }

      // 3. Filtro por Situação específica se selecionada
      if (statusFilter !== 'todos') {
        if (statusFilter === 'vencido' && item.status !== 'vencido') return false
        if (statusFilter === 'a_vencer' && item.status !== 'a_vencer') return false
        if (statusFilter === 'prorrogado' && item.status !== 'prorrogado') return false
        if (statusFilter === 'recebido' && item.status !== 'recebido') return false
      }

      // 4. Filtro de Período (Competência vs Intervalo de Datas)
      // Se filterMode === 'periodo' e houver startDate ou endDate preenchidos:
      if (filterMode === 'periodo') {
        if (startDate && item.dueDate < startDate) return false
        if (endDate && item.dueDate > endDate) return false
      } else {
        // Modo 'competencia'
        if (selectedMonth !== 'todos') {
          const itemMonth = item.dueDate.substring(0, 7) // YYYY-MM
          if (itemMonth !== selectedMonth) return false
        }
      }

      // 5. Busca textual
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim()
        const matchesContract = item.contractNumber.toLowerCase().includes(term)
        const matchesTomador = item.cedenteTomadorName.toLowerCase().includes(term)
        const matchesTomadorDoc = item.cedenteTomadorDocument.includes(term)
        const matchesSacado = item.sacadoName.toLowerCase().includes(term)
        const matchesSacadoDoc = item.sacadoDocument.includes(term)
        const matchesSubtype = item.receivableSubtype.toLowerCase().includes(term)
        if (
          !matchesContract &&
          !matchesTomador &&
          !matchesTomadorDoc &&
          !matchesSacado &&
          !matchesSacadoDoc &&
          !matchesSubtype
        ) {
          return false
        }
      }

      return true
    })
  }, [
    rawReceivables,
    selectedOrigin,
    includePaid,
    statusFilter,
    filterMode,
    startDate,
    endDate,
    selectedMonth,
    searchTerm,
  ])

  // Ordenação
  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      if (sortBy === 'dueDate_asc') {
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'dueDate_desc') {
        return b.dueDate.localeCompare(a.dueDate)
      }
      if (sortBy === 'value_desc') {
        return b.faceValue - a.faceValue
      }
      if (sortBy === 'value_asc') {
        return a.faceValue - b.faceValue
      }
      return 0
    })
  }, [filteredList, sortBy])

  /* ------------------------------------------------------------------ */
  /* Agregações e Métricas Financeiras                                  */
  /* ------------------------------------------------------------------ */
  const aggregations = useMemo(() => {
    let totalAReceber = 0
    let countTotal = 0

    let totalAntecipacoes = 0
    let countAntecipacoes = 0

    let totalCcbs = 0
    let countCcbs = 0

    let totalVencido = 0
    let countVencido = 0

    let totalAVencer = 0
    let countAVencer = 0

    let totalRecebido = 0
    let countRecebido = 0

    // Aging de vencidos
    let agingAte30 = { count: 0, val: 0 }
    let aging31a60 = { count: 0, val: 0 }
    let aging61a90 = { count: 0, val: 0 }
    let agingAcima90 = { count: 0, val: 0 }

    sortedList.forEach((it) => {
      countTotal++
      if (it.status === 'recebido') {
        countRecebido++
        totalRecebido += it.faceValue
      } else {
        // Pendente / A vencer / Vencido / Prorrogado
        totalAReceber += it.faceValue

        if (it.originType === 'antecipacao') {
          countAntecipacoes++
          totalAntecipacoes += it.faceValue
        } else {
          countCcbs++
          totalCcbs += it.faceValue
        }

        if (it.status === 'vencido') {
          countVencido++
          totalVencido += it.faceValue

          if (it.daysLate <= 30) {
            agingAte30.count++
            agingAte30.val += it.faceValue
          } else if (it.daysLate <= 60) {
            aging31a60.count++
            aging31a60.val += it.faceValue
          } else if (it.daysLate <= 90) {
            aging61a90.count++
            aging61a90.val += it.faceValue
          } else {
            agingAcima90.count++
            agingAcima90.val += it.faceValue
          }
        } else {
          countAVencer++
          totalAVencer += it.faceValue
        }
      }
    })

    return {
      totalAReceber,
      countTotal,
      countPendentes: countAntecipacoes + countCcbs,
      totalAntecipacoes,
      countAntecipacoes,
      totalCcbs,
      countCcbs,
      totalVencido,
      countVencido,
      totalAVencer,
      countAVencer,
      totalRecebido,
      countRecebido,
      agingAte30,
      aging31a60,
      aging61a90,
      agingAcima90,
    }
  }, [sortedList])

  // Rótulo amigável do período ativo para exibição no cabeçalho e na impressão
  const activePeriodLabel = useMemo(() => {
    if (filterMode === 'periodo') {
      if (startDate && endDate) {
        return `Período Personalizado: ${formatDate(startDate)} até ${formatDate(endDate)}`
      }
      if (startDate) return `A partir de ${formatDate(startDate)}`
      if (endDate) return `Até ${formatDate(endDate)}`
      return 'Período Personalizado (Todos os Vencimentos)'
    }
    if (selectedMonth === 'todos') {
      return 'Fluxo Completo de Todos os Vencimentos'
    }
    const [y, m] = selectedMonth.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
    return `Competência: ${capitalized} (${selectedMonth})`
  }, [filterMode, startDate, endDate, selectedMonth])

  /* ------------------------------------------------------------------ */
  /* Exportações CSV e Impressão PDF                                    */
  /* ------------------------------------------------------------------ */
  const handleExportCSV = useCallback(() => {
    const csvData = sortedList.map((item) => ({
      Origem: item.originType === 'antecipacao' ? 'Antecipação de Recebíveis' : 'Aquisição de CCB',
      'Contrato / Documento': item.contractNumber,
      'Subtipo / Modalidade': item.receivableSubtype,
      'Data Emissão / Aquisição': formatDate(item.operationDate),
      'Tomador / Cedente': item.cedenteTomadorName,
      'CPF/CNPJ Cedente': item.cedenteTomadorDocument
        ? formatCpfOrCnpj(item.cedenteTomadorDocument)
        : '—',
      'Sacado / Devedor': item.sacadoName,
      'CPF/CNPJ Sacado': item.sacadoDocument ? formatCpfOrCnpj(item.sacadoDocument) : '—',
      Parcela: `${item.installmentNumber} / ${item.totalInstallments}`,
      'Data de Vencimento': formatDate(item.dueDate),
      'Vencimento Original': item.originalDueDate ? formatDate(item.originalDueDate) : '—',
      'Valor de Face / Parcela (R$)': item.faceValue.toFixed(2),
      'Prorrogado?': item.isExtended ? 'Sim' : 'Não',
      'Juros Prorrogação (R$)': item.extensionInterest.toFixed(2),
      'Multa Prorrogação (R$)': item.extensionPenalty.toFixed(2),
      Situação: item.statusLabel,
      'Dias de Atraso': item.status === 'vencido' ? item.daysLate : 0,
      'Data Liquidação': item.paymentDate ? formatDate(item.paymentDate) : '—',
      'Valor Pago (R$)': item.amountPaid ? item.amountPaid.toFixed(2) : '—',
    }))

    // Subtotal agregado no CSV
    csvData.push({
      Origem: 'RESUMO / TOTAL GERAL A RECEBER NO PERÍODO',
      'Contrato / Documento': `${aggregations.countPendentes} parcela(s)`,
      'Subtipo / Modalidade': `Antecipações: R$ ${aggregations.totalAntecipacoes.toFixed(2)} | CCBs: R$ ${aggregations.totalCcbs.toFixed(2)}`,
      'Data Emissão / Aquisição': '—',
      'Tomador / Cedente': '—',
      'CPF/CNPJ Cedente': '—',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcela: '—',
      'Data de Vencimento': '—',
      'Vencimento Original': '—',
      'Valor de Face / Parcela (R$)': aggregations.totalAReceber.toFixed(2),
      'Prorrogado?': '—',
      'Juros Prorrogação (R$)': '—',
      'Multa Prorrogação (R$)': '—',
      Situação: `Vencidos: R$ ${aggregations.totalVencido.toFixed(2)} (${aggregations.countVencido})`,
      'Dias de Atraso': 0,
      'Data Liquidação': '—',
      'Valor Pago (R$)': aggregations.totalRecebido.toFixed(2),
    })

    const cleanPeriod = activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')
    exportToCSV(csvData, `Relatorio_Recebiveis_A_Receber_${cleanPeriod}.csv`)
  }, [sortedList, aggregations, activePeriodLabel])

  const handlePrint = useCallback(() => {
    const reportTitle = activePeriodLabel
      ? `Recebíveis a Receber — ${activePeriodLabel}`
      : 'Recebíveis a Receber'
    printWithReportTitle(reportTitle)
  }, [activePeriodLabel])

  return (
    <div className="space-y-6">
      {/* Estilos embutidos para impressão contínua em PDF sem cortes e thead repetido */}
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

            #print-receivables-to-receive-report,
            #print-receivables-to-receive-report * {
              visibility: visible;
            }

            #print-receivables-to-receive-report .no-print,
            #print-receivables-to-receive-report .no-print * {
              display: none !important;
              visibility: hidden !important;
            }

            #print-receivables-to-receive-report {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              font-size: 8px;
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

            #print-receivables-to-receive-report .shadow-sm,
            #print-receivables-to-receive-report .shadow-md,
            #print-receivables-to-receive-report .shadow-lg,
            #print-receivables-to-receive-report .shadow {
              box-shadow: none !important;
            }

            #print-receivables-to-receive-report .overflow-x-auto,
            #print-receivables-to-receive-report .overflow-y-auto,
            #print-receivables-to-receive-report .overflow-hidden,
            #print-receivables-to-receive-report .overflow-auto,
            #print-receivables-to-receive-report div:has(> table) {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
              display: block !important;
            }

            #print-receivables-to-receive-report table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            #print-receivables-to-receive-report thead {
              display: table-header-group !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #print-receivables-to-receive-report tbody {
              display: table-row-group !important;
            }

            #print-receivables-to-receive-report thead th {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #print-receivables-to-receive-report tfoot {
              display: table-footer-group !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #print-receivables-to-receive-report tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            #print-receivables-to-receive-report th,
            #print-receivables-to-receive-report td {
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
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">Recebíveis a Receber</h3>
              <Badge variant="outline" className="border-primary/40 text-primary">
                Posição Futura de Caixa
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Demonstrativo analítico do fluxo futuro de entradas: contratos de antecipação e
              cronograma de parcelas das CCBs adquiridas.
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
              onClick={fetchData}
              disabled={loading}
              title="Recarregar dados"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      )}

      {/* Barra de Filtros Interativos */}
      {!embedded && (
        <Card className="no-print">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Filtros de Vencimento e Período</span>
              </div>

              {/* Botões alternadores de modo: Competência vs Intervalo Customizado */}
              <div className="inline-flex rounded-md shadow-sm border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('competencia')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    filterMode === 'competencia'
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Modo Competência (Mês/Ano)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('periodo')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    filterMode === 'periodo'
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Modo Intervalo (Data Inicial / Final)
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 pb-4 pt-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Seletor do Período */}
              {filterMode === 'competencia' ? (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Mês de Vencimento (Competência)
                  </label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                    <SelectTrigger className="w-full">
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
              ) : (
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Data Inicial
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Data Final
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Origem: Todas vs Antecipação vs CCBs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tipo de Operação
                </label>
                <Select
                  value={selectedOrigin}
                  onValueChange={(val: any) => setSelectedOrigin(val)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas (Antecipações e CCBs)</SelectItem>
                    <SelectItem value="antecipacao">Apenas Antecipação de Recebíveis</SelectItem>
                    <SelectItem value="ccb">Apenas Aquisições de CCBs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Situação */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Situação
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(val: any) => setStatusFilter(val)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="a_vencer">A Vencer (Dentro do Prazo)</SelectItem>
                    <SelectItem value="vencido">Vencidos (Em Atraso)</SelectItem>
                    <SelectItem value="prorrogado">Prorrogados</SelectItem>
                    {includePaid && (
                      <SelectItem value="recebido">Liquidados / Recebidos</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2 border-t">
              {/* Busca */}
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por contrato, tomador, sacado, CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Checkbox de Incluir Recebidos */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includePaid"
                  checked={includePaid}
                  onCheckedChange={(checked) => setIncludePaid(Boolean(checked))}
                />
                <label
                  htmlFor="includePaid"
                  className="text-xs font-medium cursor-pointer leading-none text-muted-foreground hover:text-foreground"
                >
                  Incluir parcelas já recebidas/liquidadas no período
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo Imprimível do Relatório */}
      <div id="print-receivables-to-receive-report" className="space-y-6">
        {/* Cabeçalho Corporativo Oficial para Impressão */}
        <div className="bg-card border rounded-lg p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">{secRazaoSocial}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {secNomeFantasia} • CNPJ: {secCnpj}
              </p>
              <p className="text-xs text-muted-foreground">
                {secEndereco}
                {secContato ? ` • ${secContato}` : ''}
              </p>
            </div>
            <div className="text-right sm:text-right">
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1">
                Relatório Operacional • Financeiro
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Emissão:{' '}
                {new Date().toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground">
                RELATÓRIO DE RECEBÍVEIS A RECEBER (FLUXO FUTURO DE CAIXA)
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Corte selecionado:{' '}
                <span className="text-foreground font-semibold">{activePeriodLabel}</span>
              </p>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span>
                Total no filtro: <strong>{aggregations.countTotal}</strong> parcela(s)
              </span>
              <span>•</span>
              <span>
                Pendentes a receber: <strong>{aggregations.countPendentes}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Cards de Métricas e Agregações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center justify-between">
                <span>Total a Receber no Filtro</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                R${' '}
                {aggregations.totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {aggregations.countPendentes} parcelas em aberto
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
                <span>Parcelas Vencidas (Em Atraso)</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-rose-600">
                R$ {aggregations.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-rose-600/80 font-medium mt-1">
                {aggregations.countVencido} parcela(s) em atraso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Antecipações vs CCBs</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xs space-y-1 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Antecipações ({aggregations.countAntecipacoes}):
                  </span>
                  <span className="font-semibold">
                    R${' '}
                    {aggregations.totalAntecipacoes.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">CCBs ({aggregations.countCcbs}):</span>
                  <span className="font-semibold">
                    R${' '}
                    {aggregations.totalCcbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>A Vencer (Dentro do Prazo)</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-emerald-600">
                R$ {aggregations.totalAVencer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {aggregations.countAVencer} parcela(s) em dia
                {includePaid && aggregations.countRecebido > 0 && (
                  <span className="block text-[11px] text-muted-foreground">
                    (+R${' '}
                    {aggregations.totalRecebido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    já liquidadas)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Card de Aging da Carteira em Atraso (visível quando há vencidos) */}
        {aggregations.countVencido > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 print-break-inside-avoid">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600" />
                Aging de Vencimentos em Atraso (Distribuição por Faixas de Dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-background/80 p-2.5 rounded border border-amber-500/20">
                  <div className="text-muted-foreground font-medium">Até 30 dias</div>
                  <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    R${' '}
                    {aggregations.agingAte30.val.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {aggregations.agingAte30.count} título(s)
                  </div>
                </div>

                <div className="bg-background/80 p-2.5 rounded border border-amber-500/20">
                  <div className="text-muted-foreground font-medium">31 a 60 dias</div>
                  <div className="text-base font-bold text-amber-800 dark:text-amber-400 mt-0.5">
                    R${' '}
                    {aggregations.aging31a60.val.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {aggregations.aging31a60.count} título(s)
                  </div>
                </div>

                <div className="bg-background/80 p-2.5 rounded border border-amber-500/20">
                  <div className="text-muted-foreground font-medium">61 a 90 dias</div>
                  <div className="text-base font-bold text-rose-600 mt-0.5">
                    R${' '}
                    {aggregations.aging61a90.val.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {aggregations.aging61a90.count} título(s)
                  </div>
                </div>

                <div className="bg-background/80 p-2.5 rounded border border-amber-500/20">
                  <div className="text-muted-foreground font-medium">&gt; 90 dias (Crítico)</div>
                  <div className="text-base font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                    R${' '}
                    {aggregations.agingAcima90.val.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {aggregations.agingAcima90.count} título(s)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela Principal Analítica dos Recebíveis */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Detalhamento dos Recebíveis</CardTitle>
                <CardDescription>
                  Listagem ordenada de todos os títulos e parcelas do fluxo financeiro futuro.
                </CardDescription>
              </div>

              {/* Ordenação rápida */}
              <div className="flex items-center gap-2 no-print">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar por:
                </span>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate_asc">Vencimento (Mais Próximo)</SelectItem>
                    <SelectItem value="dueDate_desc">Vencimento (Mais Distante)</SelectItem>
                    <SelectItem value="value_desc">Maior Valor de Parcela</SelectItem>
                    <SelectItem value="value_asc">Menor Valor de Parcela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                    <TableHead className="min-w-[130px]">Contrato / Origem</TableHead>
                    <TableHead className="min-w-[170px]">Tomador / Cedente</TableHead>
                    <TableHead className="min-w-[160px]">Sacado / Devedor</TableHead>
                    <TableHead className="w-24 text-center">Parcela</TableHead>
                    <TableHead className="min-w-[110px]">Vencimento</TableHead>
                    <TableHead className="text-right min-w-[120px]">Valor de Face</TableHead>
                    <TableHead className="min-w-[130px] text-center">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Carregando títulos e parcelas da carteira...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-rose-600">
                        {error}
                      </TableCell>
                    </TableRow>
                  ) : sortedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        Nenhum recebível encontrado para os filtros selecionados (
                        {activePeriodLabel}).
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedList.map((item, idx) => {
                      const isLate = item.status === 'vencido'
                      const isPaid = item.status === 'recebido'
                      const isExtended = item.isExtended && !isPaid

                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            'hover:bg-muted/50 transition-colors',
                            isLate && 'bg-rose-500/5',
                            isExtended && 'bg-amber-500/5',
                            isPaid && 'opacity-70 bg-emerald-500/5',
                          )}
                        >
                          <TableCell className="text-center text-xs font-mono text-muted-foreground">
                            {idx + 1}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-foreground">
                                {item.contractNumber}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[9px] px-1 py-0 h-4 font-normal',
                                    item.originType === 'antecipacao'
                                      ? 'border-blue-500/30 text-blue-700 bg-blue-500/10'
                                      : 'border-purple-500/30 text-purple-700 bg-purple-500/10',
                                  )}
                                >
                                  {item.originType === 'antecipacao' ? 'Antecipação' : 'CCB'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
                                  {item.receivableSubtype}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className="font-medium text-xs text-foreground line-clamp-1"
                                title={item.cedenteTomadorName}
                              >
                                {item.cedenteTomadorName}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {item.cedenteTomadorDocument
                                  ? formatCpfOrCnpj(item.cedenteTomadorDocument)
                                  : 'Doc. não informado'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className="text-xs text-foreground line-clamp-1"
                                title={item.sacadoName}
                              >
                                {item.sacadoName}
                              </span>
                              {item.sacadoDocument && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {formatCpfOrCnpj(item.sacadoDocument)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="font-mono text-xs font-semibold">
                              {item.installmentNumber} / {item.totalInstallments}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  'text-xs font-semibold font-mono',
                                  isLate ? 'text-rose-600 font-bold' : 'text-foreground',
                                )}
                              >
                                {formatDate(item.dueDate)}
                              </span>
                              {item.originalDueDate && item.originalDueDate !== item.dueDate && (
                                <span className="text-[9px] text-muted-foreground line-through font-mono">
                                  Orig: {formatDate(item.originalDueDate)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={cn(
                                  'text-xs font-bold font-mono',
                                  isExtended && 'text-amber-700 dark:text-amber-400',
                                )}
                              >
                                R${' '}
                                {item.faceValue.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              {isExtended && (
                                <span className="text-[9px] text-amber-600 font-normal">
                                  (Orig R${' '}
                                  {item.originalFaceValue.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                  )
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            {isPaid ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-[10px] font-normal"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Recebido em {formatDate(item.paymentDate)}
                              </Badge>
                            ) : isLate ? (
                              <Badge
                                variant="destructive"
                                className="text-[10px] font-medium h-5 px-1.5 animate-pulse"
                              >
                                {item.statusLabel}
                              </Badge>
                            ) : isExtended ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px] font-medium"
                              >
                                <CalendarClock className="w-3 h-3 mr-1" />
                                {item.statusLabel}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-blue-500/30 bg-blue-500/10 text-blue-700 text-[10px] font-normal"
                              >
                                <Clock className="w-3 h-3 mr-1" />
                                {item.statusLabel}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>

                {/* Rodapé Totalizador da Tabela */}
                {sortedList.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2">
                      <TableCell colSpan={4} className="pl-6 text-xs uppercase tracking-wider">
                        Total Geral a Receber no Filtro ({aggregations.countPendentes} parcela(s)
                        pendente(s))
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {aggregations.countTotal} títulos
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">—</TableCell>
                      <TableCell className="text-right text-sm font-mono text-primary font-extrabold">
                        R${' '}
                        {aggregations.totalAReceber.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {aggregations.countVencido > 0
                          ? `R$ ${aggregations.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencidos`
                          : '100% em dia'}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé informativo de conformidade e notas técnicas */}
        <div className="text-[11px] text-muted-foreground border-t pt-3 space-y-1">
          <p>
            * Este demonstrativo reflete exclusivamente a posição de caixa futura dos ativos de
            crédito (recebíveis e parcelas de CCB) em cobrança pela Securitizadora.
          </p>
          <p>
            * Conforme as regras operacionais da plataforma, valores prorrogados já contemplam os
            juros e multas apurados pró-rata no saldo total devido, sem alteração dos lançamentos de
            DRE/DFC até a data de sua liquidação efetiva.
          </p>
        </div>
      </div>
    </div>
  )
}
export default ReceivablesToReceiveReportTab
