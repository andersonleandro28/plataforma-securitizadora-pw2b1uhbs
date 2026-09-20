import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import {
  Loader2,
  Calculator,
  Percent,
  CheckCircle2,
  TrendingDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

interface AdminEditRatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operation: any
  currentCalc: any
  onSuccess?: () => void
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export function AdminEditRatesDialog({
  open,
  onOpenChange,
  operation,
  currentCalc,
  onSuccess,
}: AdminEditRatesDialogProps) {
  const { user } = useAuth()
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [simulation, setSimulation] = useState<any>(null)
  const [justification, setJustification] = useState('')

  // Rates and fees
  const [rates, setRates] = useState({
    discount_rate_monthly: '0',
    interest_rate_monthly: '0',
    ad_valorem_rate: '0',
    structuring_fee: '0',
    analysis_fee: '0',
    iof_fixed_rate: '0.38',
    iof_daily_rate: '0.0041',
  })

  // Track original standard values for comparison / reset
  const [standardParams, setStandardParams] = useState<any>(null)

  // Initialize form when opened
  useEffect(() => {
    if (!open || !operation) return

    const loadInitialRates = async () => {
      setLoadingDefaults(true)
      try {
        // Fetch default category parameter
        const { data: paramsData } = await supabase.from('financial_parameters').select('*')
        const defParam: any =
          paramsData?.find((p: any) => p.receivable_type === operation.receivable_type) ||
          paramsData?.find((p: any) => p.receivable_type === 'global') ||
          {}
        setStandardParams(defParam)

        // Check if this operation already has custom rates applied
        const existingApplied: any = currentCalc?.calculation_memory?.applied_params

        const activeParams: any = existingApplied || defParam

        setRates({
          discount_rate_monthly: String(
            activeParams?.discount_rate_monthly ?? defParam?.discount_rate_monthly ?? 0,
          ),
          interest_rate_monthly: String(
            activeParams?.interest_rate_monthly ?? defParam?.interest_rate_monthly ?? 0,
          ),
          ad_valorem_rate: String(activeParams?.ad_valorem_rate ?? defParam?.ad_valorem_rate ?? 0),
          structuring_fee: String(activeParams?.structuring_fee ?? defParam?.structuring_fee ?? 0),
          analysis_fee: String(activeParams?.analysis_fee ?? defParam?.analysis_fee ?? 0),
          iof_fixed_rate: String(activeParams?.iof_fixed_rate ?? defParam?.iof_fixed_rate ?? 0.38),
          iof_daily_rate: String(
            activeParams?.iof_daily_rate ?? defParam?.iof_daily_rate ?? 0.0041,
          ),
        })

        setJustification('')
      } catch (err) {
        console.error('Error loading default parameters:', err)
      } finally {
        setLoadingDefaults(false)
      }
    }

    loadInitialRates()
  }, [open, operation, currentCalc])

  // Real-time recalculation preview
  useEffect(() => {
    if (!open || !operation) return

    const timer = setTimeout(() => {
      runSimulation()
    }, 400)

    return () => clearTimeout(timer)
  }, [rates, open, operation])

  const runSimulation = async () => {
    if (!operation) return
    setSimulating(true)
    try {
      const overrideParams = {
        discount_rate_monthly: Number(rates.discount_rate_monthly || 0),
        interest_rate_monthly: Number(rates.interest_rate_monthly || 0),
        ad_valorem_rate: Number(rates.ad_valorem_rate || 0),
        structuring_fee: Number(rates.structuring_fee || 0),
        analysis_fee: Number(rates.analysis_fee || 0),
        iof_fixed_rate: Number(rates.iof_fixed_rate || 0),
        iof_daily_rate: Number(rates.iof_daily_rate || 0),
      }

      const { data, error } = await supabase.functions.invoke('calculate-operation', {
        body: {
          simulate_data: {
            receivable_type: operation.receivable_type,
            face_value: operation.face_value,
            requested_value: operation.requested_value,
            issue_date: operation.issue_date,
            due_date: operation.due_date,
            installments_data: operation.installments_data,
          },
          override_params: overrideParams,
        },
      })

      if (error) throw error
      if (data?.data) {
        setSimulation(data.data)
      }
    } catch (err: any) {
      console.error('Simulation error:', err)
    } finally {
      setSimulating(false)
    }
  }

  const handleResetToStandard = () => {
    if (!standardParams) return
    setRates({
      discount_rate_monthly: String(standardParams.discount_rate_monthly ?? 0),
      interest_rate_monthly: String(standardParams.interest_rate_monthly ?? 0),
      ad_valorem_rate: String(standardParams.ad_valorem_rate ?? 0),
      structuring_fee: String(standardParams.structuring_fee ?? 0),
      analysis_fee: String(standardParams.analysis_fee ?? 0),
      iof_fixed_rate: String(standardParams.iof_fixed_rate ?? 0.38),
      iof_daily_rate: String(standardParams.iof_daily_rate ?? 0.0041),
    })
    toast.info('Taxas restauradas para a tabela padrão do ativo.')
  }

  const handleSave = async () => {
    if (!operation?.id) return
    if (operation.status === 'liquidado' || operation.status === 'pago') {
      toast.error('Operações já liquidadas não permitem alteração de taxas.')
      return
    }

    setSaving(true)
    try {
      const overrideParams = {
        discount_rate_monthly: Number(rates.discount_rate_monthly || 0),
        interest_rate_monthly: Number(rates.interest_rate_monthly || 0),
        ad_valorem_rate: Number(rates.ad_valorem_rate || 0),
        structuring_fee: Number(rates.structuring_fee || 0),
        analysis_fee: Number(rates.analysis_fee || 0),
        iof_fixed_rate: Number(rates.iof_fixed_rate || 0),
        iof_daily_rate: Number(rates.iof_daily_rate || 0),
        is_custom_admin_rate: true,
        rates_updated_at: new Date().toISOString(),
        rates_updated_by: user?.id,
        rates_justification: justification.trim() || undefined,
      }

      // 1. Invoca a edge function passando override_params + operation_id
      // Isso atualiza a tabela operation_calculations com todos os valores recalculados
      // e armazena os applied_params no calculation_memory.
      const { data: calcResponse, error: calcErr } = await supabase.functions.invoke(
        'calculate-operation',
        {
          body: {
            operation_id: operation.id,
            override_params: overrideParams,
          },
        },
      )

      if (calcErr) throw calcErr
      if (calcResponse?.error) throw new Error(calcResponse.error)

      // 2. Notifica tomador pelo app
      if (operation.borrower_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: operation.borrower_id,
            title: 'Proposta de Antecipação Atualizada',
            message: `As condições da sua antecipação (${operation.sacado} - ${formatCurrency(
              operation.face_value,
            )}) foram revisadas pela mesa de operações. Valor líquido liberado: ${formatCurrency(
              calcResponse?.data?.net_value || simulation?.net_value || 0,
            )}.`,
            type: 'info',
            link: '/dashboard',
          })
        } catch (notifErr) {
          console.warn('Could not dispatch in-app notification:', notifErr)
        }
      }

      // 3. Registrar no audit_logs
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        entity_type: 'credit_operations',
        entity_id: operation.id,
        action: 'ADMIN_UPDATE_OPERATION_RATES',
        details: {
          previous_rates: currentCalc?.calculation_memory?.applied_params || null,
          new_rates: overrideParams,
          previous_net_value: currentCalc?.net_value,
          new_net_value: calcResponse?.data?.net_value || simulation?.net_value,
          justification: justification.trim() || 'Sem justificativa preenchida',
          recalculated_at: new Date().toISOString(),
        },
      })

      toast.success('Taxas e juros alterados e cálculos atualizados com sucesso!')
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Save rates error:', err)
      toast.error(err.message || 'Erro ao salvar alterações de taxas.')
    } finally {
      setSaving(false)
    }
  }

  const prevNetValue = Number(currentCalc?.net_value ?? operation?.requested_value ?? 0)
  const newNetValue = Number(simulation?.net_value ?? prevNetValue)
  const netDiff = newNetValue - prevNetValue

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" /> Alterar Taxas e Juros da Proposta
            </DialogTitle>
            <span className="font-mono text-xs text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">
              #{operation?.id?.split('-')[0]}
            </span>
          </div>
          <DialogDescription>
            Ajuste as taxas negociadas na mesa de operações para este borderô enviado pelo cliente.
            Os cálculos (deságio, juros, CET e valor líquido) serão recalculados e salvos
            imediatamente.
          </DialogDescription>
        </DialogHeader>

        {loadingDefaults ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-6 py-2">
            {/* Formulário de Taxas */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Condições Comerciais &amp; Tarifas
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Ativo:{' '}
                    <strong className="text-foreground uppercase">
                      {operation?.receivable_type?.replace('_', ' ')}
                    </strong>{' '}
                    | Sacado: <strong className="text-foreground">{operation?.sacado}</strong>
                  </p>
                </div>
                {standardParams && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                    onClick={handleResetToStandard}
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar Padrão
                  </Button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="discountRate" className="text-xs font-medium">
                    Taxa de Deságio Mensal (%)
                  </Label>
                  <Input
                    id="discountRate"
                    type="number"
                    step="0.01"
                    value={rates.discount_rate_monthly}
                    onChange={(e) => setRates({ ...rates, discount_rate_monthly: e.target.value })}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Aplicada sobre o Valor de Face proporcionalmente aos dias.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="interestRate" className="text-xs font-medium">
                    Taxa de Juros Mensal (%)
                  </Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    value={rates.interest_rate_monthly}
                    onChange={(e) => setRates({ ...rates, interest_rate_monthly: e.target.value })}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Aplicada sobre o Valor Solicitado proporcionalmente aos dias.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adValorem" className="text-xs font-medium">
                    Taxa Ad Valorem (%)
                  </Label>
                  <Input
                    id="adValorem"
                    type="number"
                    step="0.01"
                    value={rates.ad_valorem_rate}
                    onChange={(e) => setRates({ ...rates, ad_valorem_rate: e.target.value })}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tarifa de risco/custódia sobre o Valor de Face.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="structuringFee" className="text-xs font-medium">
                    Custo de Estruturação (R$ ou %)
                  </Label>
                  <Input
                    id="structuringFee"
                    type="number"
                    step="0.01"
                    value={rates.structuring_fee}
                    onChange={(e) => setRates({ ...rates, structuring_fee: e.target.value })}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Taxa operacional de estruturação da cessão.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="analysisFee" className="text-xs font-medium">
                    Taxa de Análise / Cadastro (R$)
                  </Label>
                  <Input
                    id="analysisFee"
                    type="number"
                    step="0.01"
                    value={rates.analysis_fee}
                    onChange={(e) => setRates({ ...rates, analysis_fee: e.target.value })}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Custo fixo de análise de crédito e birô.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="iofFixed" className="text-xs font-medium">
                    IOF Fixo / Adicional (%)
                  </Label>
                  <Input
                    id="iofFixed"
                    type="number"
                    step="0.0001"
                    value={rates.iof_fixed_rate}
                    onChange={(e) => setRates({ ...rates, iof_fixed_rate: e.target.value })}
                    className="font-mono"
                    placeholder="0.38"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Padrão: 0,38% sobre o valor liberado.
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="iofDaily" className="text-xs font-medium">
                    IOF Diário (%)
                  </Label>
                  <Input
                    id="iofDaily"
                    type="number"
                    step="0.00001"
                    value={rates.iof_daily_rate}
                    onChange={(e) => setRates({ ...rates, iof_daily_rate: e.target.value })}
                    className="font-mono"
                    placeholder="0.0041"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Padrão PJ: 0,0041% ao dia (máx. 365 dias).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="justification" className="text-xs font-medium">
                  Motivo / Justificativa da Alteração (Auditoria)
                </Label>
                <Textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Ex: Negociação especial da mesa de operações para o cliente, contraproposta aceita..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Preview do Recálculo em Tempo Real */}
            <div className="lg:col-span-2 space-y-3">
              <Card className="shadow-none border-primary/20 bg-muted/10">
                <CardHeader className="p-3 pb-2 bg-primary/5 border-b">
                  <CardTitle className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-primary" /> Recálculo em Tempo Real
                    </span>
                    {simulating && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valor de Face (VF):</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(Number(operation?.face_value || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valor Solicitado (VS):</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(Number(operation?.requested_value || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Prazo Calculado:</span>
                    <span className="font-medium text-foreground">
                      {simulation?.termDays ?? currentCalc?.term_days ?? 0} dias
                      {simulation?.isInstallmentCalculation ? ' (médio)' : ''}
                    </span>
                  </div>

                  <div className="border-t my-1.5" />

                  {simulation ? (
                    <>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between text-destructive">
                          <span>Deságio ({rates.discount_rate_monthly}%/mês):</span>
                          <span className="font-mono">
                            -{formatCurrency(simulation.discount_val)}
                          </span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Juros ({rates.interest_rate_monthly}%/mês):</span>
                          <span className="font-mono">
                            -{formatCurrency(simulation.interest_val)}
                          </span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Ad Valorem ({rates.ad_valorem_rate}%):</span>
                          <span className="font-mono">
                            -{formatCurrency(simulation.ad_valorem_val)}
                          </span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Estruturação:</span>
                          <span className="font-mono">
                            -{formatCurrency(simulation.structuring_val)}
                          </span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Taxa Análise:</span>
                          <span className="font-mono">
                            -{formatCurrency(simulation.analysis_val)}
                          </span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>IOF Total (Fixo + Diário):</span>
                          <span className="font-mono">
                            -
                            {formatCurrency(
                              (simulation.iof_fixed_val || 0) + (simulation.iof_daily_val || 0),
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="border-t my-1.5" />

                      <div className="flex justify-between text-xs font-semibold text-destructive">
                        <span>Total de Descontos:</span>
                        <span className="font-mono">
                          -{formatCurrency(simulation.total_discounts)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                          Novo Valor Líquido Liberado
                        </span>
                        <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(simulation.net_value)}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-emerald-200/50">
                          <span>Custo Efetivo (CET):</span>
                          <strong className="text-foreground">
                            {simulation.effective_cost?.toFixed(2)}%
                          </strong>
                        </div>
                      </div>

                      {/* Comparativo de diferença */}
                      {Math.abs(netDiff) > 0.01 && (
                        <div className="text-[11px] p-2 rounded bg-background border flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5 text-primary" /> Variação vs.
                            anterior:
                          </span>
                          <span
                            className={`font-mono font-medium ${
                              netDiff > 0 ? 'text-emerald-600' : 'text-destructive'
                            }`}
                          >
                            {netDiff > 0 ? '+' : ''}
                            {formatCurrency(netDiff)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      Aguardando recálculo...
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded border space-y-1">
                <p className="flex items-center gap-1 text-foreground font-medium">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Transparência ao tomador:
                </p>
                <p>
                  Ao confirmar, os novos valores serão salvos na memória de cálculo e um registro de
                  edição administrativa será exibido ao tomador com os novos totais.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || simulating || loadingDefaults}
            className="gap-2 bg-primary text-primary-foreground"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Salvar e Recalcular Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
