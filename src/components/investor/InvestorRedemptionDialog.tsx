import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase/client'
import {
  evaluateGracePeriod,
  calculateRedemptionMetrics,
  type InvestmentForRedemption,
} from '@/lib/redemption-utils'
import type { ManualYieldEntry } from '@/services/manual-yield'

interface InvestorRedemptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment: InvestmentForRedemption | null
  manualYieldEntries?: ManualYieldEntry[]
  pendingRequestedQuotas?: number
  onSuccess?: () => void
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

/**
 * Faz parsing flexível e robusto de valores numéricos em moeda/reais ou inteiros.
 * Suporta formatos: "4000", "4000.00", "4.000,00", "4.000.00", "4000,50", etc.
 */
function parseFlexibleNumber(raw: string): number {
  if (!raw) return 0
  let clean = raw.trim().replace(/[^\d.,]/g, '')
  if (!clean) return 0

  const hasComma = clean.includes(',')
  const hasDot = clean.includes('.')

  if (hasComma && hasDot) {
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Ex: "4.000,00" ou "1.234.567,89" -> pontos são milhar, vírgula é decimal
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      // Ex: "4,000.00" -> vírgulas são milhar, ponto é decimal
      clean = clean.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Ex: "4000,00" -> substitui vírgula por ponto
    clean = clean.replace(',', '.')
  } else if (hasDot) {
    // Ex: "4.000.00" ou "4.000" ou "4000.00"
    const dotCount = (clean.match(/\./g) || []).length
    if (dotCount > 1) {
      // Múltiplos pontos ex: "4.000.00" -> tudo menos o último pode ser milhar ou separador
      const parts = clean.split('.')
      const lastPart = parts[parts.length - 1]
      if (lastPart.length === 2) {
        // Provável decimal no fim: junta os anteriores e coloca . antes do último
        const intPart = parts.slice(0, -1).join('')
        clean = `${intPart}.${lastPart}`
      } else {
        clean = parts.join('')
      }
    }
  }

  const num = parseFloat(clean)
  return isNaN(num) || num < 0 ? 0 : num
}

export function InvestorRedemptionDialog({
  open,
  onOpenChange,
  investment,
  manualYieldEntries = [],
  pendingRequestedQuotas = 0,
  onSuccess,
}: InvestorRedemptionDialogProps) {
  const [quotasInput, setQuotasInput] = useState<string>('')
  const [amountInput, setAmountInput] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const unitPrice = useMemo(() => {
    if (!investment) return 1000
    return Number(investment.unit_price || investment.investment_products?.quota_value || 1000)
  }, [investment])

  // Cotas disponíveis: quotas totais - cotas já resgatadas - cotas já em solicitação pendente
  const availableQuotas = useMemo(() => {
    if (!investment) return 0
    const total = investment.quotas || 0
    const redeemed = investment.redeemed_quotas || 0
    return Math.max(0, total - redeemed - pendingRequestedQuotas)
  }, [investment, pendingRequestedQuotas])

  const availableAmount = useMemo(() => {
    return availableQuotas * unitPrice
  }, [availableQuotas, unitPrice])

  const graceEval = useMemo(() => {
    if (!investment) return null
    return evaluateGracePeriod(investment)
  }, [investment])

  const parsedQuotas = useMemo(() => {
    const q = parseInt(quotasInput, 10)
    if (isNaN(q) || q <= 0) return 0
    return q
  }, [quotasInput])

  const metrics = useMemo(() => {
    if (!investment || parsedQuotas <= 0) return null
    return calculateRedemptionMetrics(investment, parsedQuotas, manualYieldEntries)
  }, [investment, parsedQuotas, manualYieldEntries])

  // Inicializa os campos com o SALDO TOTAL DISPONÍVEL do investimento
  const resetToTotalAvailable = useCallback(() => {
    if (!investment) {
      setQuotasInput('')
      setAmountInput('')
      return
    }
    const total = investment.quotas || 0
    const redeemed = investment.redeemed_quotas || 0
    const avail = Math.max(0, total - redeemed - pendingRequestedQuotas)
    const uPrice = Number(
      investment.unit_price || investment.investment_products?.quota_value || 1000,
    )

    setQuotasInput(String(avail))
    setAmountInput(avail > 0 ? String(avail * uPrice) : '0')
  }, [investment, pendingRequestedQuotas])

  // Sincronização obrigatória quando o dialog abre ou quando o investimento selecionado / cotas pendentes mudam
  useEffect(() => {
    if (open && investment) {
      resetToTotalAvailable()
    }
  }, [open, investment?.id, resetToTotalAvailable])

  // Reset input quando abre/fecha
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && investment) {
      resetToTotalAvailable()
    }
    onOpenChange(nextOpen)
  }

  // Mudança pela quantidade de cotas
  const handleQuotasChange = (val: string) => {
    setQuotasInput(val)
    const cleanDigits = val.replace(/\D/g, '')
    if (cleanDigits !== '') {
      const q = parseInt(cleanDigits, 10)
      if (!isNaN(q) && q > 0) {
        setAmountInput(String(q * unitPrice))
        return
      }
    }
    setAmountInput('')
  }

  // Mudança pelo valor em reais (bidirecional com parsing robusto)
  const handleAmountChange = (val: string) => {
    setAmountInput(val)
    const num = parseFlexibleNumber(val)
    if (num > 0 && unitPrice > 0) {
      const calculatedQuotas = Math.floor(num / unitPrice)
      setQuotasInput(calculatedQuotas > 0 ? String(calculatedQuotas) : '0')
    } else {
      setQuotasInput('0')
    }
  }

  // Resgatar valor total disponível
  const handleSetMax = () => {
    setQuotasInput(String(availableQuotas))
    setAmountInput(String(availableQuotas * unitPrice))
  }

  const handleConfirmSubmit = async () => {
    if (!investment || !metrics || !graceEval) return

    if (graceEval.isBlocked) {
      toast.error('Este investimento não permite saque no momento devido à carência mínima.')
      return
    }

    if (parsedQuotas <= 0) {
      toast.error('Informe uma quantidade válida de cotas para resgatar.')
      return
    }

    if (parsedQuotas > availableQuotas) {
      toast.error(
        `Quantidade informada (${parsedQuotas}) excede o saldo disponível de cotas (${availableQuotas}).`,
      )
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const payload = {
        investment_id: investment.id,
        user_id: user.id,
        requested_quotas: metrics.requestedQuotas,
        gross_value: Number(metrics.grossValue.toFixed(2)),
        net_value: Number(metrics.netValue.toFixed(2)),
        penalty_applied: Number(metrics.penaltyAmount.toFixed(2)),
        discount_applied: Number(metrics.discountAmount.toFixed(2)),
        tax_amount: Number(metrics.taxAmount.toFixed(2)),
        tax_rate: Number(metrics.taxRatePct.toFixed(2)),
        yield_amount: Number(metrics.yieldAmount.toFixed(2)),
        status: 'pending',
        is_reinvestment: false,
      }

      const { error } = await supabase.from('investment_redemptions').insert(payload)

      if (error) throw error

      toast.success(
        'Solicitação de saque enviada com sucesso! Ela entrará na fila de aprovação da equipe de gestão.',
      )
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      console.error('Erro ao solicitar saque:', err)
      toast.error(err.message || 'Erro ao registrar solicitação de saque.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!investment || !graceEval) return null

  const isBlockedByGrace = graceEval.isBlocked
  const hasPendingOrders = pendingRequestedQuotas > 0
  const isOutOfQuotas = availableQuotas <= 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-md">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Solicitação de Saque (Resgate)</DialogTitle>
              <DialogDescription>
                {investment.investment_products?.title || 'Investimento'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Alerta de Carência / Bloqueio */}
          {isBlockedByGrace ? (
            <Alert variant="destructive" className="border-rose-300 bg-rose-50 dark:bg-rose-950/30">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <AlertTitle className="text-rose-900 dark:text-rose-200 font-semibold">
                Saque Indisponível no Momento (Carência Ativa)
              </AlertTitle>
              <AlertDescription className="text-rose-800 dark:text-rose-300 text-sm mt-1 leading-relaxed">
                {graceEval.explanationMessage}
              </AlertDescription>
            </Alert>
          ) : graceEval.isWithinGracePeriod && graceEval.allowEarlyRedemption ? (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
                Resgate Antecipado sob Condições
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs mt-1 leading-relaxed">
                {graceEval.explanationMessage}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="text-emerald-900 dark:text-emerald-200 font-semibold">
                Carência Mínima Cumprida
              </AlertTitle>
              <AlertDescription className="text-emerald-800 dark:text-emerald-300 text-xs mt-1 leading-relaxed">
                {graceEval.explanationMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta de Solicitação Pendente Existente */}
          {hasPendingOrders && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 text-xs">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                Você já possui <strong>{pendingRequestedQuotas} cota(s)</strong> em solicitação de
                saque pendente para este investimento. O saldo disponível abaixo já deduz essa
                quantidade.
              </AlertDescription>
            </Alert>
          )}

          {/* Dados do Investimento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg text-xs">
            <div>
              <span className="text-muted-foreground block">Cotas Totais</span>
              <span className="font-semibold text-foreground">{investment.quotas} cota(s)</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Cotas Disponíveis</span>
              <span
                className={`font-semibold ${availableQuotas > 0 ? 'text-foreground' : 'text-rose-600'}`}
              >
                {availableQuotas} cota(s)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Valor Unitário</span>
              <span className="font-semibold font-mono text-foreground">
                {formatCurrency(investment.unit_price || 1000)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Início da Aplicação</span>
              <span className="font-semibold text-foreground">
                {graceEval.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </span>
            </div>
          </div>

          {/* Entradas Bidirecionais: Valor em Reais e Quantidade de Cotas */}
          {!isBlockedByGrace && (
            <div className="space-y-3 pt-2 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Definir Resgate
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                  onClick={handleSetMax}
                  disabled={availableQuotas <= 0 || submitting}
                >
                  Resgatar Valor Total (R${' '}
                  {availableAmount.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  )
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="amount"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Valor em Reais (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      R$
                    </span>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amountInput}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      disabled={submitting || availableQuotas <= 0}
                      className="pl-9 font-mono font-semibold"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Disponível: R${' '}
                    {availableAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="quotas"
                      className="text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Quantidade de Cotas
                    </Label>
                    <span className="text-[11px] text-slate-500">Máx: {availableQuotas}</span>
                  </div>
                  <Input
                    id="quotas"
                    type="number"
                    min="1"
                    max={availableQuotas}
                    step="1"
                    value={quotasInput}
                    onChange={(e) => handleQuotasChange(e.target.value)}
                    disabled={submitting || availableQuotas <= 0}
                    className="font-mono font-semibold"
                  />
                  <p className="text-[11px] text-slate-500">
                    1 cota = R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {parsedQuotas > availableQuotas && (
                <p className="text-xs text-rose-600 font-medium">
                  A quantidade solicitada ({parsedQuotas} cotas / R${' '}
                  {(parsedQuotas * unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  ) é maior que o saldo de cotas disponível ({availableQuotas} cota
                  {availableQuotas > 1 ? 's' : ''}).
                </p>
              )}
            </div>
          )}

          {/* Resumo Financeiro do Resgate */}
          {!isBlockedByGrace && metrics && parsedQuotas > 0 && parsedQuotas <= availableQuotas && (
            <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Simulação do Resgate ({parsedQuotas} cota{parsedQuotas > 1 ? 's' : ''})
                </span>
                <Badge variant="outline" className="text-xs">
                  {metrics.daysElapsed} dias decorridos
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capital Resgatado (Principal)</span>
                  <span className="font-mono font-medium">{formatCurrency(metrics.principal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rendimento Acumulado Bruto</span>
                  <span className="font-mono font-medium text-emerald-600">
                    + {formatCurrency(metrics.yieldAmount)}
                  </span>
                </div>

                <div className="flex justify-between font-medium pt-1 border-t">
                  <span className="text-foreground">Valor Bruto Total</span>
                  <span className="font-mono">{formatCurrency(metrics.grossValue)}</span>
                </div>

                {metrics.penaltyAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Penalidade Resgate Antecipado ({metrics.penaltyPct}%)</span>
                    <span className="font-mono">- {formatCurrency(metrics.penaltyAmount)}</span>
                  </div>
                )}

                {metrics.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Deságio s/ Rendimentos ({metrics.discountPct}%)</span>
                    <span className="font-mono">- {formatCurrency(metrics.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Imposto de Renda Retido (IRRF {metrics.taxRatePct}%)</span>
                  <span className="font-mono">- {formatCurrency(metrics.taxAmount)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center text-base sm:text-lg font-bold text-emerald-600">
                <span>Valor Líquido a Receber</span>
                <span className="font-mono text-xl">{formatCurrency(metrics.netValue)}</span>
              </div>

              <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  O valor final líquido será creditado no seu saldo em conta após a aprovação da
                  solicitação pela gestão da carteira.
                </span>
              </div>
            </div>
          )}

          {/* Regras de Liquidação / Informações Adicionais do Produto */}
          {investment.investment_products?.redemption_rules && (
            <div className="text-xs bg-muted/20 p-3 rounded-md border text-muted-foreground">
              <strong className="text-foreground block mb-1">Regras de Resgate do Produto:</strong>
              <p className="whitespace-pre-line leading-relaxed">
                {investment.investment_products.redemption_rules}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {isBlockedByGrace ? 'Fechar' : 'Cancelar'}
          </Button>

          {!isBlockedByGrace && (
            <Button
              onClick={handleConfirmSubmit}
              disabled={
                submitting || isOutOfQuotas || parsedQuotas <= 0 || parsedQuotas > availableQuotas
              }
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                </>
              ) : (
                'Confirmar Solicitação de Saque'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
