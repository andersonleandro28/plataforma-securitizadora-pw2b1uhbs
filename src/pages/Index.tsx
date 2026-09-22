import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  CalendarClock,
  ArrowDownLeft,
  CircleAlert,
  Wallet,
  Receipt,
  PiggyBank,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export type DashboardInstallment = {
  id: string
  operationId: string
  sourceType: 'antecipacao' | 'ccb'
  installmentNumber: number
  totalInstallments: number
  sacado: string
  cedente: string
  documentNumber: string
  dueDateStr: string
  daysDifference: number // < 0 se vencida há X dias (positivo em atraso), >= 0 dias até o vencimento
  daysLate: number
  originalValue: number
  totalValue: number
  isExtended: boolean
  status: 'paga' | 'vencida' | 'a_vencer' | 'prorrogada'
  statusLabel: string
  statusColor: string
}

export type DashboardRedemption = {
  id: string
  investmentId: string
  userId: string
  investorName: string
  investorDocument: string
  productTitle: string
  requestedQuotas: number
  netValue: number
  grossValue: number
  status: string
  createdAt: string
}

export type MonthlyCaptacao = {
  monthKey: string // "2025-09"
  label: string // "Set/25"
  total: number
  count: number
}

export default function Index() {
  const { activeRole, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [investments, setInvestments] = useState<any[]>([])
  const [creditOperations, setCreditOperations] = useState<any[]>([])
  const [ccbPurchases, setCcbPurchases] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])
  const { toast } = useToast()
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Função auxiliar de valores e status conforme /admin/recebiveis-parcelados
  const getInstallmentValues = useCallback((inst: any, op: any) => {
    const count = (op.installments_data || []).length || op.installments || 1
    const defaultVal = count > 0 ? Number(op.face_value || 0) / count : 0

    const rawStatus = (inst.status || '').toLowerCase()
    const isExtended =
      rawStatus === 'prorrogado' ||
      rawStatus === 'prorrogada' ||
      inst.original_due_date != null ||
      Number(inst.extension_interest || inst.prorrogacao_juros || 0) > 0

    const originalValue =
      inst.valor_original != null
        ? Number(inst.valor_original)
        : inst.original_value != null
          ? Number(inst.original_value)
          : inst.value != null
            ? Number(inst.value)
            : defaultVal

    const extensionInterest = Number(inst.prorrogacao_juros ?? inst.extension_interest ?? 0)
    const extensionPenalty = Number(inst.prorrogacao_multa ?? inst.extension_penalty ?? 0)

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
  }, [])

  const getInstallmentCalculatedStatus = useCallback((inst: any, op: any) => {
    const rawStatus = (inst.status || '').toLowerCase()

    const hasPayment = Boolean(
      (rawStatus === 'pago' || rawStatus === 'liquidado') &&
      (inst.payment_date || inst.data_pagamento),
    )

    if (hasPayment) {
      return {
        status: 'paga' as const,
        label: 'Paga',
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        daysLate: 0,
      }
    }

    const isExtended =
      rawStatus === 'prorrogado' ||
      rawStatus === 'prorrogada' ||
      inst.original_due_date != null ||
      Number(inst.extension_interest || inst.prorrogacao_juros || 0) > 0

    const dueDateStr = inst.dueDate || inst.due_date || op.due_date
    const todayStr = new Date().toISOString().split('T')[0]
    const isLate = Boolean(dueDateStr && dueDateStr < todayStr)
    const diffDays = dueDateStr
      ? Math.max(
          0,
          Math.round(
            (new Date(todayStr).getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24),
          ),
        )
      : 0

    if (isExtended || rawStatus === 'prorrogado' || rawStatus === 'prorrogada') {
      if (isLate) {
        return {
          status: 'vencida' as const,
          label: `Prorrogada (Vencida há ${diffDays}d)`,
          color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
          daysLate: diffDays,
        }
      }
      return {
        status: 'prorrogada' as const,
        label: 'Prorrogada',
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        daysLate: 0,
      }
    }

    if (!dueDateStr) {
      return {
        status: 'a_vencer' as const,
        label: 'Pendente',
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        daysLate: 0,
      }
    }

    if (isLate) {
      return {
        status: 'vencida' as const,
        label: `Vencida (${diffDays}d)`,
        color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        daysLate: diffDays,
      }
    }

    return {
      status: 'a_vencer' as const,
      label: 'Pendente',
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      daysLate: 0,
    }
  }, [])

  const fetchData = useCallback(
    async (isSilent = false) => {
      if (activeRole !== 'admin' && activeRole !== 'staff' && activeRole !== 'accountant') return

      if (!isSilent) setLoading(true)
      else setRefreshing(true)

      try {
        const [invRes, creditRes, ccbRes, redemptionsRes] = await Promise.all([
          supabase
            .from('investments')
            .select('id, total_value, status, transfer_date, created_at, quotas, unit_price')
            .in('status', ['approved', 'Ativo']),
          supabase
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
              created_at
            `)
            .order('issue_date', { ascending: false, nullsFirst: false }),
          supabase
            .from('recebiveis_ccb')
            .select(`
              id,
              ccb_id,
              tomador_id,
              acquisition_value,
              boleto_count,
              boleto_unit_value,
              gross_profit,
              tir_effective,
              provision_amount,
              boletos,
              status,
              created_at,
              ccb_solicitacoes (
                id,
                user_id,
                requested_value,
                term_months,
                created_at,
                profiles!ccb_solicitacoes_user_id_fkey (
                  id,
                  full_name,
                  document_number,
                  pj_company_name
                )
              )
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('investment_redemptions')
            .select(`
              id,
              investment_id,
              user_id,
              requested_quotas,
              net_value,
              gross_value,
              status,
              created_at,
              profiles(full_name, document_number),
              investments(
                id,
                total_value,
                investment_products(title, quota_value)
              )
            `)
            .order('created_at', { ascending: false }),
        ])

        if (invRes.error) throw invRes.error
        if (creditRes.error) throw creditRes.error
        if (ccbRes.error) throw ccbRes.error
        if (redemptionsRes.error) throw redemptionsRes.error

        setInvestments(invRes.data || [])
        setCreditOperations(creditRes.data || [])
        setCcbPurchases(ccbRes.data || [])
        setRedemptions(redemptionsRes.data || [])
      } catch (error: any) {
        console.error('Erro ao carregar dados do dashboard:', error)
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Falha na comunicação com o servidor',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeRole, toast],
  )

  useEffect(() => {
    if (activeRole !== 'admin' && activeRole !== 'staff' && activeRole !== 'accountant') return

    fetchData()

    const channel = supabase
      .channel('dashboard_admin_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_operations' }, () =>
        fetchData(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () =>
        fetchData(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () =>
        fetchData(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investment_redemptions' },
        () => fetchData(true),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, activeRole])

  // Processamento e Agregação de Dados
  const processed = useMemo(() => {
    // 1. Total captado de investimentos e evolução mensal (últimos 12 meses)
    let totalCaptado = 0
    const monthlyMap: Record<string, { total: number; count: number; date: Date }> = {}

    // Inicializar os últimos 12 meses para o gráfico ter linha do tempo contínua
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthNames = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ]
      const shortYear = String(d.getFullYear()).slice(-2)
      const label = `${monthNames[d.getMonth()]}/${shortYear}`
      monthlyMap[key] = { total: 0, count: 0, date: d }
    }

    investments.forEach((inv) => {
      // Valor ativo considerando cotas remanescentes
      const unitPrice = Number(inv.unit_price || 1000)
      const remainingQuotas = Math.max(
        0,
        Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0),
      )
      const calculatedActive = remainingQuotas * unitPrice
      const totalVal = Number(inv.total_value)
      const val =
        !isNaN(totalVal) && totalVal >= 0 && totalVal <= calculatedActive
          ? totalVal
          : calculatedActive

      totalCaptado += val

      // Usar transfer_date ou created_at
      const dateStr = inv.transfer_date || inv.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (monthlyMap[key]) {
            monthlyMap[key].total += val
            monthlyMap[key].count += 1
          } else {
            // Se estiver fora da janela inicial de 12 meses mas recente
            const monthNames = [
              'Jan',
              'Fev',
              'Mar',
              'Abr',
              'Mai',
              'Jun',
              'Jul',
              'Ago',
              'Set',
              'Out',
              'Nov',
              'Dez',
            ]
            const shortYear = String(d.getFullYear()).slice(-2)
            monthlyMap[key] = {
              total: val,
              count: 1,
              date: d,
            }
          }
        }
      }
    })

    const monthlyChartData = Object.entries(monthlyMap)
      .map(([key, item]) => {
        const monthNames = [
          'Jan',
          'Fev',
          'Mar',
          'Abr',
          'Mai',
          'Jun',
          'Jul',
          'Ago',
          'Set',
          'Out',
          'Nov',
          'Dez',
        ]
        const label = `${monthNames[item.date.getMonth()]}/${String(item.date.getFullYear()).slice(-2)}`
        return {
          monthKey: key,
          label,
          total: Number(item.total.toFixed(2)),
          count: item.count,
          dateMs: item.date.getTime(),
        }
      })
      .sort((a, b) => a.dateMs - b.dateMs)
      // Exibir os últimos 12 meses ordenados
      .slice(-12)

    // 2. Extrair todas as parcelas normalizadas:
    // (A) Antecipações de Recebíveis (credit_operations)
    // (B) Compras de CCBs (recebiveis_ccb e seus boletos)
    const allInstallments: DashboardInstallment[] = []

    let totalAReceber = 0
    let totalJaRecebido = 0
    let totalEmAtraso = 0
    let countVencidas = 0
    let countPendentes = 0
    let countProrrogadas = 0
    let countPagas = 0

    // Métricas segregadas por fonte para exibição discriminada
    let antecipacaoAReceber = 0
    let antecipacaoJaRecebido = 0
    let antecipacaoEmAtraso = 0
    let antecipacaoCountPagas = 0
    let antecipacaoCountAbertas = 0

    let ccbAReceber = 0
    let ccbJaRecebido = 0
    let ccbEmAtraso = 0
    let ccbCountPagas = 0
    let ccbCountAbertas = 0

    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date(todayStr + 'T00:00:00')

    // (A) Processar Operações de Crédito de Antecipação
    creditOperations.forEach((op) => {
      const arr = Array.isArray(op.installments_data) ? op.installments_data : []
      const isOpPaid =
        ((op.status || '').toLowerCase() === 'pago' ||
          (op.status || '').toLowerCase() === 'liquidado') &&
        Boolean(op.liquidation_date)

      const normalizedInstallments =
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

      const totalInstCount = Math.max(
        1,
        Number(op.installments || 1),
        normalizedInstallments.length,
      )

      normalizedInstallments.forEach((inst: any, idx: number) => {
        const vals = getInstallmentValues(inst, op)
        const calc = getInstallmentCalculatedStatus(inst, op)
        const dueDateStr = inst.dueDate || inst.due_date || op.due_date || ''

        let daysDiff = 999
        if (dueDateStr) {
          const dObj = new Date(dueDateStr + 'T00:00:00')
          daysDiff = Math.round((dObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }

        const item: DashboardInstallment = {
          id: `credit-${op.id}-${idx}`,
          operationId: op.id,
          sourceType: 'antecipacao',
          installmentNumber: inst.number || idx + 1,
          totalInstallments: totalInstCount,
          sacado: op.sacado || 'Sacado não informado',
          cedente: op.cedente || '—',
          documentNumber: op.document_number || `OP-${op.id.substring(0, 6).toUpperCase()}`,
          dueDateStr,
          daysDifference: daysDiff,
          daysLate: calc.daysLate,
          originalValue: vals.originalValue,
          totalValue: vals.totalValue,
          isExtended: vals.isExtended,
          status: calc.status,
          statusLabel: calc.label,
          statusColor: calc.color,
        }

        allInstallments.push(item)

        // Agregações financeiras de antecipações
        if (calc.status === 'paga') {
          countPagas++
          antecipacaoCountPagas++
          const paidVal = Number(inst.amount_paid || vals.totalValue)
          totalJaRecebido += paidVal
          antecipacaoJaRecebido += paidVal
        } else {
          // Em aberto (a_vencer, prorrogada ou vencida)
          totalAReceber += vals.totalValue
          antecipacaoAReceber += vals.totalValue
          antecipacaoCountAbertas++

          if (calc.status === 'vencida') {
            countVencidas++
            totalEmAtraso += vals.totalValue
            antecipacaoEmAtraso += vals.totalValue
          } else if (calc.status === 'prorrogada') {
            countProrrogadas++
          } else {
            countPendentes++
          }
        }
      })
    })

    // (B) Processar Compras de CCBs (recebiveis_ccb e boletos)
    // Regra consolidada em /admin/ccb-purchases:
    // - Parcela paga: status 'Pago'/'Liquidado' ou payment_date/data_pagamento preenchido
    // - Parcela a receber: pendente/vencida/prorrogada em aberto
    // - Data real de pagamento: b.payment_date || b.data_pagamento
    ccbPurchases.forEach((purch) => {
      const boletosList = Array.isArray(purch.boletos) ? purch.boletos : []
      const ccbProfile =
        purch.ccb_solicitacoes?.profiles?.full_name ||
        purch.ccb_solicitacoes?.profiles?.pj_company_name ||
        'Tomador CCB'
      const ccbDoc = purch.ccb_solicitacoes?.profiles?.document_number || ''
      const totalCount = Math.max(1, Number(purch.boleto_count || boletosList.length || 1))

      boletosList.forEach((b: any, idx: number) => {
        const rawStatus = String(b.status || '')
          .trim()
          .toLowerCase()
        const effectivePaymentDate = b.payment_date || b.data_pagamento
        const isPaid =
          rawStatus === 'pago' || rawStatus === 'liquidado' || Boolean(effectivePaymentDate)

        const unitVal = Number(b.unit_value ?? purch.boleto_unit_value ?? 0)
        const interestApplied = Number(b.interest_applied || 0)
        const penaltyApplied = Number(b.penalty_applied || 0)

        const dueDateStr = b.due_date || ''
        const isLate = Boolean(dueDateStr && dueDateStr < todayStr)
        const diffDays = dueDateStr
          ? Math.max(
              0,
              Math.round(
                (new Date(todayStr).getTime() - new Date(dueDateStr).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0

        let daysDiff = 999
        if (dueDateStr) {
          const dObj = new Date(dueDateStr + 'T00:00:00')
          daysDiff = Math.round((dObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }

        let statusKey: 'paga' | 'vencida' | 'a_vencer' | 'prorrogada' = 'a_vencer'
        let statusLabel = 'Pendente'
        let statusColor = 'bg-blue-500/10 text-blue-600 border-blue-500/20'
        let daysLate = 0

        if (isPaid) {
          statusKey = 'paga'
          statusLabel = 'Paga'
          statusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          daysLate = 0
        } else if (rawStatus === 'prorrogado' || rawStatus === 'prorrogada') {
          if (isLate) {
            statusKey = 'vencida'
            statusLabel = `Prorrogada (Vencida há ${diffDays}d)`
            statusColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            daysLate = diffDays
          } else {
            statusKey = 'prorrogada'
            statusLabel = 'Prorrogada'
            statusColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            daysLate = 0
          }
        } else if (isLate) {
          statusKey = 'vencida'
          statusLabel = `Vencida (${diffDays}d)`
          statusColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20'
          daysLate = diffDays
        } else {
          statusKey = 'a_vencer'
          statusLabel = 'Pendente'
          statusColor = 'bg-blue-500/10 text-blue-600 border-blue-500/20'
          daysLate = 0
        }

        const totalValue = isPaid ? unitVal + interestApplied + penaltyApplied : unitVal

        const ccbCode = purch.ccb_id
          ? purch.ccb_id.substring(0, 8).toUpperCase()
          : purch.id.substring(0, 8).toUpperCase()

        const item: DashboardInstallment = {
          id: `ccb-${purch.id}-${idx}`,
          operationId: purch.id,
          sourceType: 'ccb',
          installmentNumber: idx + 1,
          totalInstallments: totalCount,
          sacado: ccbProfile,
          cedente: 'Nexum Securitizadora',
          documentNumber: `CCB #${ccbCode}`,
          dueDateStr,
          daysDifference: daysDiff,
          daysLate,
          originalValue: unitVal,
          totalValue,
          isExtended: rawStatus === 'prorrogado' || rawStatus === 'prorrogada',
          status: statusKey,
          statusLabel,
          statusColor,
        }

        allInstallments.push(item)

        // Agregações financeiras de CCBs
        if (isPaid) {
          countPagas++
          ccbCountPagas++
          totalJaRecebido += totalValue
          ccbJaRecebido += totalValue
        } else {
          totalAReceber += totalValue
          ccbAReceber += totalValue
          ccbCountAbertas++

          if (statusKey === 'vencida') {
            countVencidas++
            totalEmAtraso += totalValue
            ccbEmAtraso += totalValue
          } else if (statusKey === 'prorrogada') {
            countProrrogadas++
          } else {
            countPendentes++
          }
        }
      })
    })

    // 3. Recebíveis Próximos da Cobrança:
    // Parcelas em aberto (pendente ou prorrogada não vencida) com vencimento entre hoje e os próximos 15 dias (ou até 30 se poucos)
    const upcomingReceivables = allInstallments
      .filter((item) => {
        // Não pode estar paga nem vencida
        if (item.status === 'paga' || item.status === 'vencida') return false
        // Vencimento de hoje até 30 dias (foco em próximos dias)
        return item.daysDifference >= 0 && item.daysDifference <= 30
      })
      .sort((a, b) => a.daysDifference - b.daysDifference)

    // 4. Alertas de Recebíveis em Atraso:
    // Parcelas com status 'vencida' (dias em atraso > 0)
    const overdueReceivables = allInstallments
      .filter((item) => item.status === 'vencida')
      .sort((a, b) => b.daysLate - a.daysLate) // Maiores atrasos primeiro

    // 5. Pedidos de Resgate de Investimento (status pendente):
    const pendingRedemptions: DashboardRedemption[] = redemptions
      .filter(
        (r) =>
          (r.status || '').toLowerCase() === 'pending' ||
          (r.status || '').toLowerCase() === 'pendente',
      )
      .map((r) => ({
        id: r.id,
        investmentId: r.investment_id,
        userId: r.user_id,
        investorName: r.profiles?.full_name || 'Investidor não identificado',
        investorDocument: r.profiles?.document_number || '—',
        productTitle: r.investments?.investment_products?.title || 'Produto de Investimento',
        requestedQuotas: Number(r.requested_quotas || 0),
        netValue: Number(r.net_value || 0),
        grossValue: Number(r.gross_value || 0),
        status: r.status,
        createdAt: r.created_at,
      }))

    const totalPendingRedemptionsValue = pendingRedemptions.reduce(
      (acc, curr) => acc + curr.netValue,
      0,
    )

    return {
      totalCaptado,
      investmentsCount: investments.length,
      monthlyChartData,
      // Totais consolidados
      totalAReceber,
      totalJaRecebido,
      totalEmAtraso,
      countVencidas,
      countPendentes,
      countProrrogadas,
      countPagas,
      totalParcelas: allInstallments.length,
      // Detalhamento por fonte
      antecipacaoAReceber,
      antecipacaoJaRecebido,
      antecipacaoEmAtraso,
      antecipacaoCountPagas,
      antecipacaoCountAbertas,
      ccbAReceber,
      ccbJaRecebido,
      ccbEmAtraso,
      ccbCountPagas,
      ccbCountAbertas,
      upcomingReceivables,
      overdueReceivables,
      pendingRedemptions,
      totalPendingRedemptionsValue,
    }
  }, [
    investments,
    creditOperations,
    ccbPurchases,
    redemptions,
    getInstallmentValues,
    getInstallmentCalculatedStatus,
  ])

  if (authLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (activeRole === 'investor') {
    return <Navigate to="/investidor" replace />
  }

  if (activeRole === 'borrower') {
    return <Navigate to="/tomador" replace />
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in-up pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Dashboard de Gestão
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-normal border-primary/30 text-primary bg-primary/5"
            >
              Nexum Security 360º
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Painel executivo com captações, fluxo de recebíveis e fila de liquidação.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="gap-2 h-9 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Atualizar dados
          </Button>
          <Button asChild size="sm" className="h-9 gap-1.5 text-xs">
            <Link to="/admin/recebiveis-parcelados">
              Mesa de Recebíveis
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {/* BLOCO 5 & INDICADORES CHAVE: Cards Financeiros Agregados */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Captado de Investimentos */}
            <Card className="relative overflow-hidden border-border/60 bg-card/70 backdrop-blur shadow-sm hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total de Captações
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <PiggyBank className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {formatCurrency(processed.totalCaptado)}
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>{processed.investmentsCount} aportes ativos aprovados</span>
                  <Link
                    to="/admin/investments"
                    className="text-primary hover:underline inline-flex items-center gap-0.5 text-[11px] font-medium"
                  >
                    Ver aportes <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Total de Recebíveis a Receber */}
            <Card className="relative overflow-hidden border-border/60 bg-card/70 backdrop-blur shadow-sm hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 h-1 w-full bg-indigo-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                <div>
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total de Recebíveis a Receber
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Antecipações + CCBs</p>
                </div>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Receipt className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {formatCurrency(processed.totalAReceber)}
                </div>

                {/* Composição discriminada: Antecipações e CCBs */}
                <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      Antecipações:
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(processed.antecipacaoAReceber)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-500" />
                      CCBs:
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(processed.ccbAReceber)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>
                    {processed.countPendentes +
                      processed.countProrrogadas +
                      processed.countVencidas}{' '}
                    parc. em aberto ({processed.antecipacaoCountAbertas} Antecip. ·{' '}
                    {processed.ccbCountAbertas} CCB)
                  </span>
                  <Link
                    to="/admin/recebiveis-parcelados"
                    className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                  >
                    Cronograma <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Total Já Recebido */}
            <Card className="relative overflow-hidden border-border/60 bg-card/70 backdrop-blur shadow-sm hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                <div>
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Já Recebido
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Antecipações + CCBs</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(processed.totalJaRecebido)}
                </div>

                {/* Composição discriminada: Antecipações e CCBs */}
                <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Antecipações:
                    </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatCurrency(processed.antecipacaoJaRecebido)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-500" />
                      CCBs:
                    </span>
                    <span className="font-semibold text-teal-700 dark:text-teal-400 font-mono">
                      {formatCurrency(processed.ccbJaRecebido)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>
                    {processed.countPagas} parcelas liquidadas ({processed.antecipacaoCountPagas}{' '}
                    Antecip. · {processed.ccbCountPagas} CCB)
                  </span>
                  <Link
                    to="/admin/ccb-purchases"
                    className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                  >
                    CCBs <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Alertas de Atraso (Resumo) */}
            <Card
              className={cn(
                'relative overflow-hidden border-border/60 bg-card/70 backdrop-blur shadow-sm hover:shadow-md transition-all',
                processed.countVencidas > 0 && 'border-rose-500/40 bg-rose-500/[0.03]',
              )}
            >
              <div
                className={cn(
                  'absolute top-0 left-0 h-1 w-full',
                  processed.countVencidas > 0 ? 'bg-rose-500 animate-pulse' : 'bg-muted',
                )}
              />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                <div>
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recebíveis em Atraso
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Antecipações + CCBs</p>
                </div>
                <div
                  className={cn(
                    'p-2 rounded-lg',
                    processed.countVencidas > 0
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    'text-2xl font-bold tracking-tight',
                    processed.countVencidas > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-foreground',
                  )}
                >
                  {formatCurrency(processed.totalEmAtraso)}
                </div>

                {/* Composição de atraso discriminada quando houver */}
                <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Antecipações:
                    </span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
                      {formatCurrency(processed.antecipacaoEmAtraso)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      CCBs:
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                      {formatCurrency(processed.ccbEmAtraso)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>
                    {processed.countVencidas === 0
                      ? 'Nenhuma parcela em atraso'
                      : `${processed.countVencidas} parcela(s) vencida(s)`}
                  </span>
                  {processed.countVencidas > 0 && (
                    <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                      Ação necessária
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* BLOCO 1: Gráfico de Evolução Mensal de Captações de Investimentos */}
          <Card className="border-border/60 bg-card/70 backdrop-blur shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolução Mensal de Captações de Investimentos
                </CardTitle>
                <CardDescription>
                  Volume histórico mensal de aportes aprovados nos últimos 12 meses (Total
                  acumulado:{' '}
                  <strong className="text-foreground">
                    {formatCurrency(processed.totalCaptado)}
                  </strong>
                  )
                </CardDescription>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 self-start sm:self-auto"
              >
                <Link to="/admin/investments">
                  Gerenciar Aportes
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={processed.monthlyChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(val) =>
                        val >= 1000000
                          ? `R$ ${(val / 1000000).toFixed(1)}M`
                          : val >= 1000
                            ? `R$ ${(val / 1000).toFixed(0)}k`
                            : `R$ ${val}`
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Captação']}
                      labelFormatter={(label) => `Mês de referência: ${label}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name="Captação"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* GRID COM BLOCO 3 (PEDIDOS DE RESGATE) E INDICADOR RESUMO */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* BLOCO 3: Pedidos de Resgate de Investimento (Fila Pendente) */}
            <Card className="lg:col-span-12 border-border/60 bg-card/70 backdrop-blur shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                      <ArrowDownLeft className="h-5 w-5 text-amber-500" />
                      Pedidos de Resgate de Investimento
                    </CardTitle>
                    {processed.pendingRedemptions.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-600 bg-amber-500/10"
                      >
                        {processed.pendingRedemptions.length} pendente(s)
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Solicitações de liquidação de cotas aguardando conferência e liquidação pelo
                    admin.
                    {processed.pendingRedemptions.length > 0 && (
                      <span className="ml-1 text-foreground font-medium">
                        (Total solicitado: {formatCurrency(processed.totalPendingRedemptionsValue)})
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0">
                  <Link to="/admin/investments">
                    Ir para Fila de Resgates
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {processed.pendingRedemptions.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
                    <p className="text-sm font-medium">Nenhum pedido de resgate pendente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Todos os resgates solicitados pelos investidores foram processados.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Data Solicitação</TableHead>
                        <TableHead>Investidor</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Cotas</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right pr-6">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processed.pendingRedemptions.slice(0, 5).map((red) => (
                        <TableRow key={red.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                            {formatDate(red.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-foreground">
                                {red.investorName}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {red.investorDocument}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {red.productTitle}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {red.requestedQuotas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-foreground">
                            {formatCurrency(red.netValue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-xs"
                            >
                              Pendente
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary hover:text-primary"
                            >
                              <Link to="/admin/investments">
                                Avaliar <ChevronRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* GRID: BLOCO 4 (ALERTAS DE ATRASO) E BLOCO 2 (PRÓXIMOS DA COBRANÇA) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* BLOCO 4: Alertas de Recebíveis em Atraso */}
            <Card
              className={cn(
                'border-border/60 bg-card/70 backdrop-blur shadow-sm flex flex-col',
                processed.overdueReceivables.length > 0 && 'border-rose-500/30',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <CircleAlert className="h-5 w-5" />
                      Alertas de Recebíveis em Atraso
                    </CardTitle>
                    {processed.overdueReceivables.length > 0 && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">
                        {processed.overdueReceivables.length}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Parcelas vencidas e não pagas que exigem cobrança ou prorrogação.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0">
                  <Link to="/admin/recebiveis-parcelados">
                    Ver todos
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                {processed.overdueReceivables.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground px-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      Inadimplência sob controle
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Não há nenhuma parcela vencida em aberto no momento.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {processed.overdueReceivables.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 hover:bg-rose-500/[0.04] transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {item.sacado}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-4 px-1 font-semibold uppercase',
                                item.sourceType === 'ccb'
                                  ? 'border-violet-500/40 text-violet-600 bg-violet-500/10'
                                  : 'border-blue-500/40 text-blue-600 bg-blue-500/10',
                              )}
                            >
                              {item.sourceType === 'ccb' ? 'CCB' : 'Antecipação'}
                            </Badge>
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              {item.daysLate}d atraso
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>Doc: {item.documentNumber}</span>
                            <span>•</span>
                            <span>
                              Parc. {item.installmentNumber}/{item.totalInstallments}
                            </span>
                            <span>•</span>
                            <span>Venc: {formatDate(item.dueDateStr)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                            {formatCurrency(item.totalValue)}
                          </div>
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-[11px] text-primary font-medium hover:underline"
                          >
                            <Link
                              to={
                                item.sourceType === 'ccb'
                                  ? '/admin/ccb-purchases'
                                  : '/admin/recebiveis-parcelados'
                              }
                            >
                              Cobrar / Tratar
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {processed.overdueReceivables.length > 6 && (
                      <div className="p-3 text-center bg-muted/20">
                        <Link
                          to="/admin/recebiveis-parcelados"
                          className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                        >
                          Ver mais {processed.overdueReceivables.length - 6} parcela(s) em atraso
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BLOCO 2: Recebíveis Próximos da Cobrança */}
            <Card className="border-border/60 bg-card/70 backdrop-blur shadow-sm flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      Recebíveis Próximos da Cobrança
                    </CardTitle>
                    {processed.upcomingReceivables.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-blue-500/40 text-blue-600 bg-blue-500/10 h-5 px-1.5 text-[11px]"
                      >
                        {processed.upcomingReceivables.length}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Parcelas a vencer nos próximos 15 a 30 dias para régua de relacionamento e aviso
                    prévio.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0">
                  <Link to="/admin/recebiveis-parcelados">
                    Ver todos
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                {processed.upcomingReceivables.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground px-4">
                    <Calendar className="h-8 w-8 text-blue-500/60 mb-2" />
                    <p className="text-sm font-medium text-foreground">Nenhum vencimento próximo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Não há recebíveis programados para cobrança nos próximos dias.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {processed.upcomingReceivables.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {item.sacado}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-4 px-1 font-semibold uppercase',
                                item.sourceType === 'ccb'
                                  ? 'border-violet-500/40 text-violet-600 bg-violet-500/10'
                                  : 'border-blue-500/40 text-blue-600 bg-blue-500/10',
                              )}
                            >
                              {item.sourceType === 'ccb' ? 'CCB' : 'Antecipação'}
                            </Badge>
                            {item.daysDifference === 0 ? (
                              <Badge className="text-[10px] h-4 px-1 bg-amber-500 text-white">
                                Vence Hoje
                              </Badge>
                            ) : item.daysDifference === 1 ? (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                Vence Amanhã
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1 text-muted-foreground"
                              >
                                Em {item.daysDifference} dias
                              </Badge>
                            )}
                            {item.isExtended && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1 border-amber-500/30 text-amber-600 bg-amber-500/5"
                              >
                                Prorrogada
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>Doc: {item.documentNumber}</span>
                            <span>•</span>
                            <span>
                              Parc. {item.installmentNumber}/{item.totalInstallments}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-foreground/80">
                              Venc: {formatDate(item.dueDateStr)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-foreground text-sm">
                            {formatCurrency(item.totalValue)}
                          </div>
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-[11px] text-primary font-medium hover:underline"
                          >
                            <Link
                              to={
                                item.sourceType === 'ccb'
                                  ? '/admin/ccb-purchases'
                                  : '/admin/recebiveis-parcelados'
                              }
                            >
                              Ver detalhes
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {processed.upcomingReceivables.length > 6 && (
                      <div className="p-3 text-center bg-muted/20">
                        <Link
                          to="/admin/recebiveis-parcelados"
                          className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                        >
                          Ver mais {processed.overdueReceivables.length} parcela(s) no cronograma
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
