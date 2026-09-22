import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2,
  CalendarDays,
  CheckCircle,
  XCircle,
  Pencil,
  AlertTriangle,
  ArrowRightLeft,
  Trash2,
  Ban,
  FileText,
  Filter,
  FileCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { formatDate, toISODate } from '@/lib/utils'
import { InvestmentProofModal, InvestmentProof } from '@/components/admin/InvestmentProofModal'
import { sendNotification } from '@/services/notifications'
import { evaluateGracePeriod } from '@/lib/redemption-utils'

export default function InvestmentsReview() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [investments, setInvestments] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [proofsMap, setProofsMap] = useState<Record<string, InvestmentProof>>({})

  // Aportes States
  const [editOpen, setEditOpen] = useState(false)
  const [selectedInv, setSelectedInv] = useState<any>(null)
  const [editInvForm, setEditInvForm] = useState({
    transfer_date: '',
    quotas: 1,
    unit_price: 1000,
    total_value: 1000,
  })

  // Comprovante Modal State
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedProof, setSelectedProof] = useState<InvestmentProof | null>(null)
  const [selectedProofInv, setSelectedProofInv] = useState<any>(null)

  // Novos States de Reprovação e Exclusão de Aportes
  const [rejectInvOpen, setRejectInvOpen] = useState(false)
  const [invToReject, setInvToReject] = useState<any>(null)
  const [invRejectionReason, setInvRejectionReason] = useState('')
  const [deleteInvOpen, setDeleteInvOpen] = useState(false)
  const [invToDelete, setInvToDelete] = useState<any>(null)
  const [invStatusFilter, setInvStatusFilter] = useState<
    'pending' | 'all' | 'rejected' | 'approved' | 'resgatado'
  >('pending')

  // Aportes avaliados com data de liberação para saque e ordenados por proximidade da liberação
  const sortedInvestments = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayMs = today.getTime()

    const evaluated = investments.map((inv) => {
      const graceEval = evaluateGracePeriod(inv, today)
      const releaseDate = graceEval?.graceReleaseDate || null
      const releaseMs = releaseDate ? releaseDate.getTime() : null

      const daysUntilRelease =
        releaseMs !== null ? Math.round((releaseMs - todayMs) / (1000 * 60 * 60 * 24)) : 0

      // Considera liberado se a data de carência já passou ou se o produto não tem carência mínima obrigatória
      const isLiberado = !releaseDate || releaseMs <= todayMs

      return {
        investment: inv,
        graceEval,
        releaseDate,
        releaseMs,
        daysUntilRelease,
        isLiberado,
      }
    })

    // Ordenação desejada pelo usuário:
    // 1. TOPO: Aportes que JÁ PODEM ser sacados (carência já liberada ou sem carência)
    //    - Ordenados do mais recentemente liberado para o mais antigo (releaseMs desc)
    // 2. EM SEGUIDA: Aportes ainda em carência
    //    - Ordenados pela proximidade da liberação (quem libera primeiro vem antes, releaseMs asc)
    // 3. FINAL: Aportes que faltam mais tempo para liberar (mais distantes por último)
    return evaluated.sort((a, b) => {
      // Grupo 1: Já liberados (isLiberado === true)
      // Grupo 2: Ainda em carência (isLiberado === false)
      if (a.isLiberado && !b.isLiberado) return -1
      if (!a.isLiberado && b.isLiberado) return 1

      // Se ambos já estão liberados:
      // Mais recentemente liberados primeiro (releaseMs desc).
      // Se não tiverem releaseDate (sem carência), usa created_at desc como fallback.
      if (a.isLiberado && b.isLiberado) {
        const aTime = a.releaseMs ?? new Date(a.investment.created_at || 0).getTime()
        const bTime = b.releaseMs ?? new Date(b.investment.created_at || 0).getTime()
        if (bTime !== aTime) return bTime - aTime

        const aCreated = new Date(a.investment.created_at || 0).getTime()
        const bCreated = new Date(b.investment.created_at || 0).getTime()
        return bCreated - aCreated
      }

      // Se ambos ainda estão em carência (não liberados):
      // Quem libera primeiro vem antes (releaseMs asc, ou seja, menor data primeiro).
      // Os que faltam mais tempo ficam no final da página.
      const aRelease = a.releaseMs ?? Number.MAX_SAFE_INTEGER
      const bRelease = b.releaseMs ?? Number.MAX_SAFE_INTEGER
      if (aRelease !== bRelease) {
        return aRelease - bRelease
      }

      const aCreated = new Date(a.investment.created_at || 0).getTime()
      const bCreated = new Date(b.investment.created_at || 0).getTime()
      return bCreated - aCreated
    })
  }, [investments])

  // Resgates States
  const [rejectOpen, setRejectOpen] = useState(false)
  const [editRedemptionOpen, setEditRedemptionOpen] = useState(false)
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [editRedemptionForm, setEditRedemptionForm] = useState({ effective_date: '' })
  const [recalcResult, setRecalcResult] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  // Aprovação States
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveData, setApproveData] = useState<any>(null)
  const [manualTax, setManualTax] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [invRes, proofsRes] = await Promise.all([
      supabase
        .from('investments')
        .select('*, profiles(full_name, document_number), investment_products(*)')
        .order('created_at', { ascending: false }),
      supabase.from('investment_proofs').select('*').order('uploaded_at', { ascending: false }),
    ])

    if (invRes.data) setInvestments(invRes.data)

    if (proofsRes.data) {
      // Mapear por investment_id pegando o mais recente
      const map: Record<string, InvestmentProof> = {}
      for (const proof of proofsRes.data) {
        if (!map[proof.investment_id]) {
          map[proof.investment_id] = proof
        }
      }
      setProofsMap(map)
    }
  }

  const fetchRedemptions = async () => {
    const { data, error } = await supabase
      .from('investment_redemptions')
      .select('*, profiles(full_name, document_number), investments(*, investment_products(*))')
      .order('created_at', { ascending: false })

    if (data) setRedemptions(data)
  }

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchData(), fetchRedemptions()])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const calculateInvestmentMetricsToDate = (inv: any, quotas: number, targetDateStr: string) => {
    if (!inv)
      return {
        principal: 0,
        yieldAmount: 0,
        penalty: 0,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        netValue: 0,
        grossValue: 0,
        daysElapsed: 0,
      }

    const prod = inv.investment_products || {}
    const unitPrice = inv.unit_price || prod.quota_value || 1000
    const principal = quotas * unitPrice

    const startDate = new Date(inv.transfer_date || inv.created_at)
    const targetDate = new Date(targetDateStr + 'T12:00:00Z')
    startDate.setUTCHours(0, 0, 0, 0)
    targetDate.setUTCHours(0, 0, 0, 0)

    const daysElapsed = Math.max(
      0,
      (targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24),
    )

    const rateMatch = prod.rate?.match(/(\d+[.,]\d+|\d+)/)
    const numericRate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 10
    const annualRate = numericRate / 100

    const yieldAmount =
      principal > 0 ? principal * Math.pow(1 + annualRate, daysElapsed / 365) - principal : 0

    let taxRate = 0
    if (daysElapsed <= 180) taxRate = 22.5
    else if (daysElapsed <= 360) taxRate = 20
    else if (daysElapsed <= 720) taxRate = 17.5
    else taxRate = 15

    const taxAmount = yieldAmount * (taxRate / 100)

    const monthsElapsed = daysElapsed / 30
    const gracePeriodMet = monthsElapsed >= (prod.min_grace_period_months || 0)

    let penalty = 0
    let discount = 0
    if (!gracePeriodMet) {
      penalty = principal * ((prod.early_redemption_penalty_pct || 0) / 100)
      discount = yieldAmount * ((prod.early_redemption_discount_pct || 0) / 100)
    }

    const netValue = principal + yieldAmount - penalty - discount - taxAmount

    return {
      principal,
      yieldAmount,
      penalty,
      discount,
      taxRate,
      taxAmount,
      netValue,
      grossValue: principal + yieldAmount,
      daysElapsed,
    }
  }

  useEffect(() => {
    if (editRedemptionOpen && selectedRedemption && editRedemptionForm.effective_date) {
      const result = calculateInvestmentMetricsToDate(
        selectedRedemption.investments,
        selectedRedemption.requested_quotas,
        editRedemptionForm.effective_date,
      )
      setRecalcResult(result)
    }
  }, [editRedemptionForm.effective_date, editRedemptionOpen, selectedRedemption])

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.rpc('approve_investment', { p_investment_id: id })
      if (error) throw error
      toast.success('Aporte aprovado com sucesso!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aprovar aporte.')
    }
  }

  const handleOpenRejectInvModal = (inv: any) => {
    if (inv.status === 'approved') {
      toast.error('Não é possível reprovar um aporte que já foi aprovado.')
      return
    }
    setInvToReject(inv)
    setInvRejectionReason(inv.rejection_reason || '')
    setRejectInvOpen(true)
  }

  const handleConfirmRejectInv = async () => {
    if (!invToReject) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('reject_investment', {
        p_investment_id: invToReject.id,
        p_rejection_reason: invRejectionReason.trim() || null,
      })
      if (error) throw error

      toast.success(
        'Aporte reprovado com sucesso. Ele não será contabilizado na carteira do investidor.',
      )
      setRejectInvOpen(false)
      setInvToReject(null)
      setInvRejectionReason('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reprovar aporte.')
    } finally {
      setProcessing(false)
    }
  }

  const handleOpenDeleteInvModal = (inv: any) => {
    if (inv.status === 'approved') {
      toast.error('Atenção: Aportes já aprovados/liquidados NUNCA podem ser excluídos.')
      return
    }
    setInvToDelete(inv)
    setDeleteInvOpen(true)
  }

  const handleConfirmDeleteInv = async () => {
    if (!invToDelete) return
    if (invToDelete.status === 'approved') {
      toast.error('Atenção: Aportes já aprovados/liquidados NUNCA podem ser excluídos.')
      setDeleteInvOpen(false)
      setInvToDelete(null)
      return
    }

    setProcessing(true)
    try {
      const { error } = await supabase.rpc('delete_unapproved_investment', {
        p_investment_id: invToDelete.id,
      })
      if (error) throw error

      toast.success('Aporte e registros dependentes excluídos permanentemente.')
      setDeleteInvOpen(false)
      setInvToDelete(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir aporte.')
    } finally {
      setProcessing(false)
    }
  }

  const handleViewProof = (inv: any) => {
    const proof = proofsMap[inv.id]
    if (!proof) {
      toast.info('Nenhum comprovante anexado para este aporte.')
      return
    }
    setSelectedProof(proof)
    setSelectedProofInv(inv)
    setProofModalOpen(true)
  }

  const handleEditDates = (inv: any) => {
    setSelectedInv(inv)
    const quotas = Number(inv.quotas) || 1
    const unitPrice = Number(inv.unit_price) || 1000
    const totalValue = Number(inv.total_value) || quotas * unitPrice

    setEditInvForm({
      transfer_date: inv.transfer_date || '',
      quotas,
      unit_price: unitPrice,
      total_value: totalValue,
    })
    setEditOpen(true)
  }

  const handleSaveDates = async () => {
    if (!selectedInv) return

    if (editInvForm.transfer_date) {
      const selectedDate = new Date(editInvForm.transfer_date + 'T12:00:00Z')
      const today = new Date()
      today.setUTCHours(23, 59, 59, 999)
      if (selectedDate > today) {
        return toast.error('A data do aporte não pode ser posterior à data atual.')
      }
    }

    const quotas = Math.max(1, parseInt(String(editInvForm.quotas), 10) || 1)
    const unitPrice = Math.max(0, parseFloat(String(editInvForm.unit_price)) || 0)
    const totalValue = quotas * unitPrice

    try {
      // 1. Atualiza na tabela investments
      const { error } = await supabase
        .from('investments')
        .update({
          transfer_date: editInvForm.transfer_date || null,
          quotas,
          unit_price: unitPrice,
          total_value: totalValue,
        })
        .eq('id', selectedInv.id)
      if (error) throw error

      // 2. Sincronização direta e explícita em debenture_subscriptions (garantia além dos triggers)
      await supabase
        .from('debenture_subscriptions')
        .update({
          subscription_date: editInvForm.transfer_date || null,
          quantity: quotas,
          unit_price: unitPrice,
          total_amount: totalValue,
        })
        .eq('investment_id', selectedInv.id)

      await supabase.from('audit_logs').insert({
        entity_type: 'investments',
        entity_id: selectedInv.id,
        action: 'admin_updated_dates',
        details: {
          admin_id: user?.id,
          message: `Aporte ID ${selectedInv.id} atualizado por ${user?.email}: data ${selectedInv.transfer_date || 'N/A'} -> ${editInvForm.transfer_date}, valor R$ ${selectedInv.total_value} -> R$ ${totalValue}`,
          old_transfer_date: selectedInv.transfer_date,
          new_transfer_date: editInvForm.transfer_date,
          old_total_value: selectedInv.total_value,
          new_total_value: totalValue,
          quotas,
          unit_price: unitPrice,
        },
      })

      toast.success(
        'Aporte atualizado com sucesso. Sincronização em cascata concluída com a Carteira de Investidores.',
      )
      setEditOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao atualizar aporte: ' + err.message)
    }
  }

  const handleOpenApproveModal = (red: any) => {
    const dateStr = toISODate(red.updated_at || red.created_at)
    const metrics = calculateInvestmentMetricsToDate(red.investments, red.requested_quotas, dateStr)
    setApproveData({ red, metrics })
    setManualTax(metrics.taxAmount.toFixed(2))
    setApproveModalOpen(true)
  }

  const handleConfirmApproval = async () => {
    if (!approveData) return
    setProcessing(true)
    try {
      const finalTax = parseFloat(manualTax.replace(',', '.')) || 0
      const netVal =
        approveData.metrics.grossValue -
        approveData.metrics.penalty -
        approveData.metrics.discount -
        finalTax

      const { error: updErr } = await supabase
        .from('investment_redemptions')
        .update({
          status: 'approved',
          tax_amount: finalTax,
          tax_rate: approveData.metrics.taxRate,
          yield_amount: approveData.metrics.yieldAmount,
          net_value: netVal,
          gross_value: approveData.metrics.grossValue,
        })
        .eq('id', approveData.red.id)

      if (updErr) throw updErr

      const { error: rpcErr } = await supabase.rpc('process_redemption_payment', {
        p_redemption_id: approveData.red.id,
        p_admin_id: user?.id,
      })

      if (rpcErr) throw rpcErr

      // Notificar investidor sobre aprovação/pagamento
      const productName = approveData.red.investments?.investment_products?.title || 'Investimento'
      const netFormatted = formatC(netVal)

      await sendNotification({
        userId: approveData.red.user_id,
        title: 'Saque Aprovado e Pago!',
        message: `Seu saque no valor líquido de ${netFormatted} referente a ${productName} (${approveData.red.requested_quotas} cota(s)) foi APROVADO e PAGO pela administração. O saldo está disponível em sua conta.`,
        type: 'success',
        link: '/investidor',
        metadata: {
          redemptionId: approveData.red.id,
          productTitle: productName,
          netValue: netVal,
          status: 'paid',
        },
      })

      toast.success('Resgate aprovado e liquidado com sucesso. Investidor notificado!')
      setApproveModalOpen(false)
      fetchRedemptions()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectRedemption = async () => {
    if (!selectedRedemption || !rejectionReason) return
    setProcessing(true)
    try {
      // Se porventura um resgate pago for revertido/rejeitado, invoca RPC de reversão para estornar lançamentos
      if (selectedRedemption.status === 'paid') {
        const { error: revErr } = await (supabase.rpc as any)('revert_redemption_payment', {
          p_redemption_id: selectedRedemption.id,
          p_reason: rejectionReason.trim(),
        })
        if (revErr) throw revErr
      }

      const { error } = await supabase
        .from('investment_redemptions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRedemption.id)
      if (error) throw error

      // Notificar investidor sobre a rejeição
      const productName =
        selectedRedemption.investments?.investment_products?.title || 'Investimento'
      const netFormatted = formatC(selectedRedemption.net_value)

      await sendNotification({
        userId: selectedRedemption.user_id,
        title: 'Solicitação de Saque Reprovada',
        message: `Sua solicitação de saque de ${netFormatted} em ${productName} foi REJEITADA. Motivo informado: "${rejectionReason.trim()}". Suas cotas permanecem preservadas.`,
        type: 'error',
        link: '/investidor',
        metadata: {
          redemptionId: selectedRedemption.id,
          productTitle: productName,
          netValue: selectedRedemption.net_value,
          status: 'rejected',
          reason: rejectionReason.trim(),
        },
      })

      toast.success('Resgate rejeitado. Investidor notificado!')
      setRejectOpen(false)
      fetchRedemptions()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleOpenEditRedemption = (red: any) => {
    setSelectedRedemption(red)
    const dateStr = toISODate(red.updated_at || red.created_at)
    setEditRedemptionForm({ effective_date: dateStr })
    setEditRedemptionOpen(true)
  }

  const handleSaveRetroactiveEdit = async () => {
    if (!selectedRedemption || !recalcResult) return
    setProcessing(true)
    try {
      const oldNet = selectedRedemption.net_value
      const newNet = recalcResult.netValue
      const netDifference = newNet - oldNet

      const updatePayload = {
        gross_value: recalcResult.grossValue,
        net_value: recalcResult.netValue,
        penalty_applied: recalcResult.penalty,
        discount_applied: recalcResult.discount,
        tax_amount: recalcResult.taxAmount,
        tax_rate: recalcResult.taxRate,
        yield_amount: recalcResult.yieldAmount,
        updated_at: new Date(editRedemptionForm.effective_date + 'T12:00:00Z').toISOString(),
        updated_by: user?.id,
      }

      const { error: updErr } = await supabase
        .from('investment_redemptions')
        .update(updatePayload)
        .eq('id', selectedRedemption.id)

      if (updErr) throw updErr

      if (selectedRedemption.status === 'paid') {
        // Se for reinvestimento com troco, ajusta wallet_balance do investidor proporcionalmente
        if (selectedRedemption.is_reinvestment && netDifference !== 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', selectedRedemption.user_id)
            .single()

          if (profile && Number(profile.wallet_balance) > 0) {
            await supabase
              .from('profiles')
              .update({
                wallet_balance: Math.max(0, Number(profile.wallet_balance) + netDifference),
              })
              .eq('id', selectedRedemption.user_id)
          }
        }

        // Sincronizar tesouraria e livro caixa com o novo valor / data
        const extRef = `redemption-${selectedRedemption.id}`
        const effDate = editRedemptionForm.effective_date
        const effDateTs = new Date(editRedemptionForm.effective_date + 'T12:00:00Z').toISOString()
        const invName =
          selectedRedemption.profiles?.full_name ||
          selectedRedemption.profiles?.pj_company_name ||
          'Investidor'
        const desc = `Resgate de investimento — ${invName} — ${selectedRedemption.requested_quotas || 0} cotas`

        await supabase
          .from('treasury_transactions')
          .update({
            amount: newNet,
            date: effDate,
            description: desc,
          })
          .eq('external_ref', extRef)

        await supabase
          .from('movimentacoes_caixa')
          .update({
            valor: newNet,
            descricao: desc,
            created_at: effDateTs,
          })
          .eq('referencia_id', selectedRedemption.id)
          .eq('referencia_tipo', 'resgate_investimento')
      }

      await supabase.from('audit_logs').insert({
        entity_type: 'investment_redemptions',
        entity_id: selectedRedemption.id,
        action: 'admin_retroactive_edit',
        details: {
          admin_id: user?.id,
          old_date: selectedRedemption.updated_at,
          new_date: updatePayload.updated_at,
          old_net_value: oldNet,
          new_net_value: newNet,
          difference: netDifference,
        },
      })

      // Notificar investidor sobre ajuste retroativo se houver diferença
      if (netDifference !== 0) {
        const productName =
          selectedRedemption.investments?.investment_products?.title || 'Investimento'
        await sendNotification({
          userId: selectedRedemption.user_id,
          title: 'Ajuste no Valor de Resgate',
          message: `Houve um ajuste retroativo no resgate de ${productName}. Novo valor líquido: ${formatC(newNet)} (Diferença de ${netDifference > 0 ? '+' : ''}${formatC(netDifference)}).`,
          type: 'info',
          link: '/investidor',
          metadata: {
            redemptionId: selectedRedemption.id,
            productTitle: productName,
            netValue: newNet,
            difference: netDifference,
            status: selectedRedemption.status,
          },
        })
      }

      toast.success('Resgate editado retroativamente com sucesso.')
      setEditRedemptionOpen(false)
      fetchRedemptions()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const formatC = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aprovação de Aportes e Resgates</h1>
        <p className="text-muted-foreground">
          Gerencie as entradas e saídas de capital dos investidores.
        </p>
      </div>

      <Tabs defaultValue="aportes" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="aportes">Aportes Pendentes</TabsTrigger>
          <TabsTrigger value="resgates">Fila de Resgates</TabsTrigger>
        </TabsList>

        <TabsContent value="aportes" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtrar por status:</span>
              <div className="inline-flex rounded-md border p-1 bg-muted/40">
                <Button
                  variant={invStatusFilter === 'pending' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInvStatusFilter('pending')}
                >
                  Pendentes (
                  {
                    investments.filter(
                      (i) => i.status === 'awaiting_review' || i.status === 'pending_transfer',
                    ).length
                  }
                  )
                </Button>
                <Button
                  variant={invStatusFilter === 'approved' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInvStatusFilter('approved')}
                >
                  Aprovados ({investments.filter((i) => i.status === 'approved').length})
                </Button>
                <Button
                  variant={invStatusFilter === 'rejected' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInvStatusFilter('rejected')}
                >
                  Reprovados ({investments.filter((i) => i.status === 'rejected').length})
                </Button>
                <Button
                  variant={invStatusFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInvStatusFilter('all')}
                >
                  Todos ({investments.length})
                </Button>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Aportes</CardTitle>
              <CardDescription>
                Aportes organizados por data de liberação para saque (carência mínima). Visualize a
                previsão de resgates para melhor gestão do fluxo de caixa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investidor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor / Cotas</TableHead>
                    <TableHead>Data Transferência</TableHead>
                    <TableHead>Carência / Liberação Saque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvestments
                    .filter((item) => {
                      const inv = item.investment
                      if (invStatusFilter === 'pending') {
                        return inv.status === 'awaiting_review' || inv.status === 'pending_transfer'
                      }
                      if (invStatusFilter === 'approved') {
                        return inv.status === 'approved'
                      }
                      if (invStatusFilter === 'rejected') {
                        return inv.status === 'rejected'
                      }
                      if (invStatusFilter === 'resgatado') {
                        return inv.status === 'resgatado'
                      }
                      return true
                    })
                    .map((item) => {
                      const inv = item.investment
                      const isApproved = inv.status === 'approved'
                      const isAwaitingReview = inv.status === 'awaiting_review'
                      const isPendingTransfer = inv.status === 'pending_transfer'
                      const isRejected = inv.status === 'rejected'
                      const { graceEval, releaseDate, daysUntilRelease, isLiberado } = item

                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="font-medium">
                              {inv.profiles?.full_name || 'Investidor'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {inv.profiles?.document_number || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {inv.investment_products?.title || 'Debênture'}
                            </div>
                            {inv.investment_products?.rate && (
                              <div className="text-xs text-muted-foreground">
                                Taxa: {inv.investment_products.rate}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-medium">
                              R${' '}
                              {Number(inv.total_value).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {inv.status === 'resgatado' || Number(inv.total_value) === 0 ? (
                                <span className="text-muted-foreground italic">
                                  Resgatado ({Number(inv.redeemed_quotas || inv.quotas)} cotas)
                                </span>
                              ) : Number(inv.redeemed_quotas || 0) > 0 ? (
                                <span>
                                  {Math.max(
                                    0,
                                    Number(inv.quotas || 0) - Number(inv.redeemed_quotas || 0),
                                  )}{' '}
                                  cota(s) ativa(s) ({inv.redeemed_quotas} resgatada(s)) a R${' '}
                                  {Number(inv.unit_price || 0).toLocaleString('pt-BR')}
                                </span>
                              ) : (
                                <span>
                                  {inv.quotas} cota(s) a R${' '}
                                  {Number(inv.unit_price || 0).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>{' '}
                          </TableCell>
                          <TableCell>{formatDate(inv.transfer_date)}</TableCell>
                          <TableCell>
                            {releaseDate ? (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-foreground">
                                  {releaseDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </div>
                                <div>
                                  {isLiberado ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] font-medium inline-flex items-center gap-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      {daysUntilRelease === 0
                                        ? 'Libera hoje'
                                        : `Liberado há ${Math.abs(daysUntilRelease)}d`}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-medium inline-flex items-center gap-1"
                                    >
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      {daysUntilRelease === 1
                                        ? 'Libera em 1 dia'
                                        : `Libera em ${daysUntilRelease} dias`}
                                    </Badge>
                                  )}
                                </div>
                                {graceEval?.gracePeriodMonths > 0 && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Carência: {graceEval.gracePeriodMonths} meses
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
                              >
                                Sem carência
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isApproved && (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                Aprovado
                              </Badge>
                            )}
                            {isAwaitingReview && (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300"
                              >
                                Em Análise
                              </Badge>
                            )}
                            {isPendingTransfer && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Pendente Transferência
                              </Badge>
                            )}
                            {isRejected && (
                              <div className="space-y-1">
                                <Badge variant="destructive">Reprovado</Badge>
                                {inv.rejection_reason && (
                                  <p
                                    className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]"
                                    title={inv.rejection_reason}
                                  >
                                    Motivo: {inv.rejection_reason}
                                  </p>
                                )}
                              </div>
                            )}
                            {inv.status === 'resgatado' && (
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 text-slate-700 border-slate-300"
                              >
                                Resgatado
                              </Badge>
                            )}
                            {!isApproved &&
                              !isAwaitingReview &&
                              !isPendingTransfer &&
                              !isRejected &&
                              inv.status !== 'resgatado' && (
                                <Badge variant="outline">{inv.status}</Badge>
                              )}
                          </TableCell>
                          <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                            {/* Ver Comprovante (visível quando o aporte possui anexo) */}
                            {proofsMap[inv.id] && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                onClick={() => handleViewProof(inv)}
                                title={`Ver Comprovante (${proofsMap[inv.id].file_name})`}
                              >
                                <FileCheck className="w-4 h-4 mr-1.5" /> Comprovante
                              </Button>
                            )}

                            {/* 1. Botão Aprovar (mantido para pendentes) */}
                            {isAwaitingReview && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleApprove(inv.id)}
                                title="Aprovar Aporte"
                              >
                                <CheckCircle className="w-4 h-4 mr-1.5" /> Aprovar
                              </Button>
                            )}

                            {/* 2. Botão Reprovar (para aportes não aprovados) */}
                            {!isApproved && !isRejected && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleOpenRejectInvModal(inv)}
                                title="Reprovar Aporte"
                              >
                                <Ban className="w-4 h-4 mr-1.5" /> Reprovar
                              </Button>
                            )}

                            {/* Botão de Edição de Datas e Valores */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditDates(inv)}
                              title="Editar Dados / Data"
                            >
                              <CalendarDays className="w-4 h-4" />
                            </Button>

                            {/* 3. Botão Excluir (apenas para aportes NÃO aprovados) */}
                            {!isApproved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => handleOpenDeleteInvModal(inv)}
                                title="Excluir Permanentemente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  {investments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum aporte encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resgates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Resgate</CardTitle>
              <CardDescription>
                Aprove resgates pendentes ou realize edições retroativas para correção de
                competência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investidor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cotas</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Data Efetiva</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((red) => (
                    <TableRow key={red.id}>
                      <TableCell>
                        <div className="font-medium">
                          {red.profiles?.full_name || 'Desconhecido'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {red.profiles?.document_number}
                        </div>
                      </TableCell>
                      <TableCell>{red.investments?.investment_products?.title}</TableCell>
                      <TableCell>{red.requested_quotas}</TableCell>
                      <TableCell className="font-mono font-medium text-emerald-600">
                        {formatC(red.net_value)}
                      </TableCell>
                      <TableCell>{formatDate(red.updated_at || red.created_at)}</TableCell>
                      <TableCell className="space-y-1">
                        <div>
                          {red.status === 'paid' ? (
                            <Badge className="bg-emerald-500">Liquidado</Badge>
                          ) : red.status === 'approved' ? (
                            <Badge className="bg-primary">Aprovado</Badge>
                          ) : red.status === 'rejected' ? (
                            <Badge variant="destructive">Rejeitado</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-100 text-amber-800 border-amber-200"
                            >
                              Pendente
                            </Badge>
                          )}
                        </div>
                        {red.is_reinvestment && (
                          <div>
                            <Badge
                              variant="secondary"
                              className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]"
                            >
                              Reinvestimento
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {red.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleOpenApproveModal(red)}
                              disabled={processing}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                setSelectedRedemption(red)
                                setRejectionReason('')
                                setRejectOpen(true)
                              }}
                              disabled={processing}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditRedemption(red)}
                          title="Edição Retroativa"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {redemptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        Nenhuma solicitação de resgate encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Modal with Tax Details */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Liquidação de Resgate</DialogTitle>
            <DialogDescription>
              Revise os cálculos de rendimento e retenção de IR (Tabela Regressiva) antes de
              liquidar.
            </DialogDescription>
          </DialogHeader>
          {approveData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Valor Bruto</span>
                  <span className="font-mono font-medium">
                    {formatC(approveData.metrics.grossValue)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Rendimento Tributável</span>
                  <span className="font-mono font-medium">
                    {formatC(approveData.metrics.yieldAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Tempo Decorrido</span>
                  <span className="font-medium">
                    {Math.floor(approveData.metrics.daysElapsed)} dias
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Alíquota IR Aplicada</span>
                  <span className="font-medium">{approveData.metrics.taxRate}%</span>
                </div>
              </div>

              {approveData.red.is_reinvestment && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-md text-sm mb-4">
                  <strong>Reinvestimento Automático:</strong> Esta solicitação converterá o valor
                  líquido em novas cotas, gerando os lançamentos contábeis de Integralização. O
                  troco será depositado no caixa do investidor.
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <Label>Imposto Retido (IRRF) Ajustável</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualTax}
                  onChange={(e) => setManualTax(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O sistema calculou automaticamente R$ {approveData.metrics.taxAmount.toFixed(2)}.
                  Altere apenas para correções de migração.
                </p>
              </div>

              <div className="pt-4 border-t flex justify-between items-center text-lg font-bold text-emerald-600">
                <span>Valor Líquido a Pagar</span>
                <span className="font-mono">
                  {formatC(
                    approveData.metrics.grossValue -
                      approveData.metrics.penalty -
                      approveData.metrics.discount -
                      (parseFloat(manualTax.replace(',', '.')) || 0),
                  )}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveModalOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmApproval} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar e Liquidar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Dados do Aporte</DialogTitle>
            <DialogDescription>
              Altere a data de transferência, cotas ou valor. Esta ação atualizará imediatamente a
              Carteira de Investidores, o Dashboard do Investidor e a Tesouraria.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedInv && (
              <div className="text-xs bg-muted/40 p-3 rounded-md space-y-1">
                <div>
                  <span className="text-muted-foreground">Investidor: </span>
                  <span className="font-semibold">{selectedInv.profiles?.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Produto: </span>
                  <span className="font-medium">{selectedInv.investment_products?.title}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Data de Transferência (Competência / Início do Rendimento)</Label>
              <Input
                type="date"
                max={new Date().toLocaleDateString('en-CA')}
                value={editInvForm.transfer_date}
                onChange={(e) => setEditInvForm({ ...editInvForm, transfer_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Cotas</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={editInvForm.quotas}
                  onChange={(e) => {
                    const q = parseInt(e.target.value, 10) || 0
                    setEditInvForm({
                      ...editInvForm,
                      quotas: q,
                      total_value: q * editInvForm.unit_price,
                    })
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Preço Unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editInvForm.unit_price}
                  onChange={(e) => {
                    const up = parseFloat(e.target.value) || 0
                    setEditInvForm({
                      ...editInvForm,
                      unit_price: up,
                      total_value: editInvForm.quotas * up,
                    })
                  }}
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-md flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Valor Total do Aporte</span>
              <span className="font-mono font-bold text-base text-primary">
                {formatC(editInvForm.quotas * editInvForm.unit_price)}
              </span>
            </div>

            {editInvForm.transfer_date &&
              editInvForm.transfer_date !== selectedInv?.transfer_date && (
                <Alert className="bg-amber-50 border-amber-200 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Sincronização em Cascata</AlertTitle>
                  <AlertDescription className="text-amber-700 text-xs mt-1">
                    A nova data corrigida ({editInvForm.transfer_date}) será refletida na Carteira
                    de Investidores, recalculando o rendimento acumulado pro rata die imediatamente.
                  </AlertDescription>
                </Alert>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDates} disabled={!editInvForm.transfer_date}>
              <CheckCircle className="w-4 h-4 mr-2" /> Salvar e Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Resgate</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. Esta ação não pode ser desfeita e ficará registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Motivo da Rejeição</Label>
              <Textarea
                placeholder="Descreva o motivo..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectRedemption}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRedemptionOpen} onOpenChange={setEditRedemptionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> Edição Retroativa de Resgate
            </DialogTitle>
            <DialogDescription>
              Altere a data efetiva para recalcular a rentabilidade proporcional (migração ou ajuste
              contábil).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Data Efetiva (Competência)</Label>
              <Input
                type="date"
                value={editRedemptionForm.effective_date}
                onChange={(e) => setEditRedemptionForm({ effective_date: e.target.value })}
              />
            </div>

            {editRedemptionForm.effective_date &&
              editRedemptionForm.effective_date !==
                (selectedRedemption?.updated_at || selectedRedemption?.created_at)?.split(
                  'T',
                )[0] && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    Atenção à Competência Retroativa
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 text-xs mt-1">
                    Alterar a data para o passado modificará o saldo do investidor instantaneamente
                    e reescreverá a linha do tempo da Tesouraria.
                  </AlertDescription>
                </Alert>
              )}

            {recalcResult && selectedRedemption && (
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm border mt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Original (Líquido)</span>
                  <span className="font-mono line-through opacity-70">
                    {formatC(selectedRedemption.net_value)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Novo Valor Recalculado</span>
                  <span className="font-mono text-emerald-600">
                    {formatC(recalcResult.netValue)}
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-2 pt-2 border-t">
                  <span className="text-muted-foreground">Diferença a ser ajustada no caixa</span>
                  <span
                    className={`font-mono ${recalcResult.netValue - selectedRedemption.net_value >= 0 ? 'text-primary' : 'text-rose-600'}`}
                  >
                    {recalcResult.netValue - selectedRedemption.net_value >= 0 ? '+' : ''}
                    {formatC(recalcResult.netValue - selectedRedemption.net_value)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRedemptionOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveRetroactiveEdit} disabled={processing || !recalcResult}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Recálculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Reprovação de Aporte */}
      <Dialog open={rejectInvOpen} onOpenChange={setRejectInvOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" /> Reprovar Aporte de Investimento
            </DialogTitle>
            <DialogDescription>
              O aporte será marcado como <strong>Reprovado</strong>. Ele não será apagado do
              histórico, mas não aparecerá na fila de pendentes e não será contabilizado na carteira
              ou rendimentos do investidor.
            </DialogDescription>
          </DialogHeader>

          {invToReject && (
            <div className="py-2 space-y-3">
              <div className="text-xs bg-muted/50 p-3 rounded-md space-y-1 border">
                <div>
                  <span className="text-muted-foreground">Investidor: </span>
                  <span className="font-semibold">
                    {invToReject.profiles?.full_name || 'Desconhecido'}
                  </span>
                  {invToReject.profiles?.document_number && (
                    <span className="text-muted-foreground ml-1">
                      ({invToReject.profiles.document_number})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Produto: </span>
                  <span className="font-medium">{invToReject.investment_products?.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor: </span>
                  <span className="font-mono font-semibold text-rose-600">
                    R${' '}
                    {Number(invToReject.total_value).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-muted-foreground ml-2">({invToReject.quotas} cota(s))</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-rejection-reason">Motivo da Reprovação (opcional)</Label>
                <Textarea
                  id="inv-rejection-reason"
                  placeholder="Ex: Comprovante ilegível, valor divergente do TED, titularidade divergente..."
                  value={invRejectionReason}
                  onChange={(e) => setInvRejectionReason(e.target.value)}
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">
                  O motivo ficará visível na listagem de auditoria para referência da equipe.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectInvOpen(false)
                setInvToReject(null)
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmRejectInv} disabled={processing}>
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão Permanente de Aporte (Destrutivo) */}
      <Dialog open={deleteInvOpen} onOpenChange={setDeleteInvOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" /> Excluir Aporte Permanentemente
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os registros vinculados a este aporte
              não aprovado (subscrições, transações de tesouraria preliminares e comprovantes) serão
              removidos.
            </DialogDescription>
          </DialogHeader>

          {invToDelete && (
            <div className="py-2 space-y-3">
              <Alert className="bg-rose-50 border-rose-200 text-rose-900">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <AlertTitle className="text-rose-800 font-semibold">Atenção</AlertTitle>
                <AlertDescription className="text-rose-700 text-xs mt-1">
                  Aportes já aprovados não podem ser excluídos. Este registro tem status{' '}
                  <strong>{invToDelete.status}</strong> e será apagado permanentemente da base de
                  dados.
                </AlertDescription>
              </Alert>

              <div className="text-xs bg-muted/50 p-3 rounded-md space-y-1 border">
                <div>
                  <span className="text-muted-foreground">Investidor: </span>
                  <span className="font-semibold">
                    {invToDelete.profiles?.full_name || 'Desconhecido'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Produto: </span>
                  <span className="font-medium">{invToDelete.investment_products?.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor: </span>
                  <span className="font-mono font-semibold">
                    R${' '}
                    {Number(invToDelete.total_value).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data da Operação: </span>
                  <span>{formatDate(invToDelete.created_at)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteInvOpen(false)
                setInvToDelete(null)
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteInv} disabled={processing}>
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exibição de Comprovante de Depósito */}
      <InvestmentProofModal
        open={proofModalOpen}
        onOpenChange={setProofModalOpen}
        proof={selectedProof}
        investment={selectedProofInv}
      />
    </div>
  )
}
