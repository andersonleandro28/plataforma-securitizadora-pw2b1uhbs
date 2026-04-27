import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function InvestmentsReview() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [investments, setInvestments] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])

  // Aportes States
  const [editOpen, setEditOpen] = useState(false)
  const [selectedInv, setSelectedInv] = useState<any>(null)
  const [datesForm, setDatesForm] = useState({ transfer_date: '' })

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
    const { data, error } = await supabase
      .from('investments')
      .select('*, profiles(full_name, document_number), investment_products(title, rate)')
      .order('created_at', { ascending: false })

    if (data) setInvestments(data)
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
      toast.success('Aporte aprovado.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleEditDates = (inv: any) => {
    setSelectedInv(inv)
    setDatesForm({
      transfer_date: inv.transfer_date || '',
    })
    setEditOpen(true)
  }

  const handleSaveDates = async () => {
    if (!selectedInv) return

    const selectedDate = new Date(datesForm.transfer_date + 'T12:00:00Z')
    const today = new Date()
    today.setUTCHours(23, 59, 59, 999)
    if (selectedDate > today) {
      return toast.error('A data do aporte não pode ser posterior à data atual.')
    }

    try {
      const { error } = await supabase
        .from('investments')
        .update({ transfer_date: datesForm.transfer_date || null })
        .eq('id', selectedInv.id)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        entity_type: 'investments',
        entity_id: selectedInv.id,
        action: 'admin_updated_dates',
        details: {
          admin_id: user?.id,
          message: `Data do Aporte ID ${selectedInv.id} alterada de ${selectedInv.transfer_date || 'N/A'} para ${datesForm.transfer_date} por ${user?.email}`,
          old_transfer_date: selectedInv.transfer_date,
          new_transfer_date: datesForm.transfer_date,
        },
      })

      toast.success('Data atualizada com sucesso. Sincronização em cascata concluída.')
      setEditOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao atualizar datas: ' + err.message)
    }
  }

  const handleOpenApproveModal = (red: any) => {
    const dateStr = (red.updated_at || red.created_at).split('T')[0]
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

      toast.success('Resgate aprovado e liquidado com sucesso.')
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

      toast.success('Resgate rejeitado.')
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
    const dateStr = (red.updated_at || red.created_at).split('T')[0]
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

      if (selectedRedemption.status === 'paid' && netDifference !== 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', selectedRedemption.user_id)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({ wallet_balance: Number(profile.wallet_balance) + netDifference })
            .eq('id', selectedRedemption.user_id)
        }
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

        <TabsContent value="aportes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Aportes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investidor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Transferência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium">{inv.profiles?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.profiles?.document_number}
                        </div>
                      </TableCell>
                      <TableCell>{inv.investment_products?.title}</TableCell>
                      <TableCell className="font-mono">
                        R$ {Number(inv.total_value).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {inv.transfer_date
                          ? new Date(inv.transfer_date).toLocaleDateString('pt-BR', {
                              timeZone: 'UTC',
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'approved' ? 'default' : 'outline'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {inv.status === 'awaiting_review' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleApprove(inv.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleEditDates(inv)}>
                          <CalendarDays className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {investments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                      <TableCell>
                        {red.updated_at || red.created_at
                          ? new Date(red.updated_at || red.created_at).toLocaleDateString('pt-BR', {
                              timeZone: 'UTC',
                            })
                          : '-'}
                      </TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Data do Aporte</DialogTitle>
            <DialogDescription>
              Altere a data de transferência para recálculo retroativo. Esta ação atualizará as
              subscrições, a tesouraria e o dashboard do investidor em cascata.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Data de Transferência (Competência)</Label>
              <Input
                type="date"
                max={new Date().toLocaleDateString('en-CA')}
                value={datesForm.transfer_date}
                onChange={(e) => setDatesForm({ transfer_date: e.target.value })}
              />
            </div>
            {datesForm.transfer_date && datesForm.transfer_date !== selectedInv?.transfer_date && (
              <Alert className="bg-amber-50 border-amber-200 mt-4">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Sincronização em Cascata</AlertTitle>
                <AlertDescription className="text-amber-700 text-xs mt-1">
                  O recálculo pro rata die será aplicado automaticamente desde a nova data até a
                  presente. A alteração refletirá na Tesouraria e no Dashboard do Investidor de
                  forma idêntica.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDates} disabled={!datesForm.transfer_date}>
              <CheckCircle className="w-4 h-4 mr-2" /> Salvar Sincronização
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
    </div>
  )
}
