import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Landmark, AlertTriangle, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { sendNotification } from '@/services/notifications'
import { onlyDigits, maskDocument, validateDocument } from '@/lib/cpf-cnpj'

interface UserBankAccountOption {
  id: string
  bank_code: string
  bank_name: string
  branch: string | null
  account_number: string | null
  account_type: string
  owner_name: string
  owner_document: string
  is_active: boolean | null
}

interface AdminRequestRedemptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment: any | null
  /** Cotas disponíveis (total - resgatadas - comprometidas em pedidos pendentes) */
  availableQuotas?: number
  onSuccess?: () => void
}

type PaymentMethod = 'ted' | 'pix'

const parseFlexibleNumber = (raw: string): number => {
  if (!raw) return 0
  const normalized = raw.replace(/\s/g, '').replace(/R\$/gi, '')
  // Formato brasileiro: 1.234,56 — formato simples: 1234.56
  if (/,\d{1,2}$/.test(normalized)) {
    return parseFloat(normalized.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (normalized.includes(',')) {
    return parseFloat(normalized.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(normalized) || 0
}

export function AdminRequestRedemptionDialog({
  open,
  onOpenChange,
  investment,
  availableQuotas: availableQuotasProp,
  onSuccess,
}: AdminRequestRedemptionDialogProps) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [bankOptions, setBankOptions] = useState<UserBankAccountOption[]>([])
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ted')
  const [form, setForm] = useState({
    bank_code: '',
    bank_name: '',
    bank_agency: '',
    bank_account: '',
    bank_account_type: '',
    bank_holder_name: '',
    bank_holder_document: '',
    pix_key: '',
    admin_notes: '',
  })

  const unitPrice = Number(
    investment?.unit_price || investment?.investment_products?.quota_value || 1000,
  )
  const availableQuotas = useMemo(() => {
    if (availableQuotasProp !== undefined) return Math.max(0, Number(availableQuotasProp) || 0)
    const total = Number(investment?.quotas) || 0
    const redeemed = Number(investment?.redeemed_quotas) || 0
    return Math.max(0, total - redeemed)
  }, [availableQuotasProp, investment])
  const availableValue = availableQuotas * unitPrice

  const parsedAmount = parseFlexibleNumber(amountInput)
  const requestedQuotas = unitPrice > 0 ? Math.floor(parsedAmount / unitPrice) : 0
  const effectiveAmount = requestedQuotas * unitPrice

  // Carrega contas bancárias cadastradas do cliente para pré-preenchimento
  useEffect(() => {
    if (!open || !investment?.user_id) return
    let isMounted = true
    setLoadingBanks(true)
    supabase
      .from('user_bank_accounts')
      .select(
        'id, bank_code, bank_name, branch, account_number, account_type, owner_name, owner_document, is_active',
      )
      .eq('user_id', investment.user_id)
      .order('is_active', { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          console.warn('Erro ao carregar contas do cliente:', error)
        }
        setBankOptions((data as UserBankAccountOption[]) || [])
        setLoadingBanks(false)
      })
    return () => {
      isMounted = false
    }
  }, [open, investment?.user_id])

  // Reset do formulário ao abrir
  useEffect(() => {
    if (open) {
      setAmountInput(availableValue > 0 ? String(availableValue) : '')
      setPaymentMethod('ted')
      setForm({
        bank_code: '',
        bank_name: '',
        bank_agency: '',
        bank_account: '',
        bank_account_type: '',
        bank_holder_name: '',
        bank_holder_document: '',
        pix_key: '',
        admin_notes: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment?.id])

  const applyBankOption = (id: string) => {
    const opt = bankOptions.find((b) => b.id === id)
    if (!opt) return
    setForm((prev) => ({
      ...prev,
      bank_code: opt.bank_code || '',
      bank_name: opt.bank_name || '',
      bank_agency: opt.branch || '',
      bank_account: opt.account_number || '',
      bank_account_type:
        opt.account_type === 'poupanca' || opt.account_type === 'poupança'
          ? 'poupanca'
          : 'corrente',
      bank_holder_name: opt.owner_name || '',
      bank_holder_document: opt.owner_document || '',
    }))
  }

  const holderDocEntity = onlyDigits(form.bank_holder_document).length > 11 ? 'pj' : 'pf'

  const handleSubmit = async () => {
    if (!investment) return

    if (parsedAmount <= 0) {
      toast.error('Informe um valor de resgate válido.')
      return
    }
    if (requestedQuotas <= 0) {
      toast.error(
        `O valor informado é menor que o preço de 1 cota (${unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
      )
      return
    }
    if (requestedQuotas > availableQuotas) {
      toast.error(
        `O valor solicitado excede o saldo disponível do investimento (máximo de ${availableQuotas} cota(s)).`,
      )
      return
    }

    if (paymentMethod === 'ted') {
      if (!form.bank_name && !form.bank_code) {
        toast.error('Informe o banco para depósito do resgate.')
        return
      }
      if (!form.bank_agency.trim()) {
        toast.error('Informe a agência para depósito do resgate.')
        return
      }
      if (!form.bank_account.trim()) {
        toast.error('Informe a conta (com dígito) para depósito do resgate.')
        return
      }
      if (!form.bank_account_type) {
        toast.error('Informe o tipo de conta (corrente ou poupança).')
        return
      }
    } else if (!form.pix_key.trim()) {
      toast.error('Informe a chave PIX para o saque do resgate.')
      return
    }

    if (!form.bank_holder_name.trim()) {
      toast.error(
        paymentMethod === 'ted'
          ? 'Informe o nome do titular da conta.'
          : 'Informe o nome do titular da chave PIX.',
      )
      return
    }
    if (!validateDocument(form.bank_holder_document, holderDocEntity)) {
      toast.error('Informe um CPF/CNPJ válido do titular.')
      return
    }

    setSubmitting(true)
    try {
      const isPix = paymentMethod === 'pix'
      const payload = {
        investment_id: investment.id,
        user_id: investment.user_id,
        redemption_type: requestedQuotas === availableQuotas ? 'total' : 'partial',
        requested_quotas: requestedQuotas,
        gross_value: Number(effectiveAmount.toFixed(2)),
        net_value: Number(effectiveAmount.toFixed(2)),
        penalty_applied: 0,
        discount_applied: 0,
        tax_amount: 0,
        tax_rate: 0,
        yield_amount: 0,
        status: 'pending',
        is_reinvestment: false,
        requested_by_admin: user?.id || null,
        admin_notes: form.admin_notes.trim() || null,
        payment_method: paymentMethod,
        pix_key: isPix ? form.pix_key.trim() : null,
        // Pedido PIX não tem dados bancários completos: banco/agência/conta/tipo ficam nulos.
        bank_code: isPix ? null : form.bank_code.trim() || null,
        bank_name: isPix ? null : form.bank_name.trim(),
        bank_agency: isPix ? null : form.bank_agency.trim(),
        bank_account: isPix ? null : form.bank_account.trim(),
        bank_account_type: isPix ? null : form.bank_account_type,
        bank_holder_name: form.bank_holder_name.trim(),
        bank_holder_document: onlyDigits(form.bank_holder_document),
      }

      const { error } = await supabase.from('investment_redemptions').insert(payload)
      if (error) throw error

      const productName = investment.investment_products?.title || 'Investimento'
      const investorName = investment.profiles?.full_name || 'Investidor'
      const amountFormatted = effectiveAmount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      await sendNotification({
        userId: investment.user_id,
        title: 'Resgate Solicitado pela Administração',
        message: `A administração solicitou um resgate de ${amountFormatted} (${requestedQuotas} cota(s)) em ${productName} em seu nome. Após aprovação, o valor será ${isPix ? 'sacado via PIX' : 'depositado na conta informada'}.`,
        type: 'info',
        link: '/investidor',
        metadata: {
          investmentId: investment.id,
          investorName,
          netValue: effectiveAmount,
          status: 'pending',
          requestedByAdmin: true,
          paymentMethod,
        },
      })

      toast.success(
        `Pedido de resgate de ${amountFormatted} criado para ${investorName}. Ele está na Fila de Resgates aguardando aprovação.`,
      )
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error('Erro ao criar pedido de resgate:', err)
      toast.error(err.message || 'Erro ao registrar pedido de resgate.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'h-9'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Pedir Resgate para Cliente
          </DialogTitle>
          <DialogDescription>
            Solicite um resgate em nome do investidor e informe os dados de pagamento. O pedido
            entra na Fila de Resgates para aprovação e liquidação no fluxo normal.
          </DialogDescription>
        </DialogHeader>

        {investment && (
          <div className="space-y-5 py-1">
            {/* Resumo do investimento */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{investment.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {investment.investment_products?.title || 'Produto'} •{' '}
                    {investment.profiles?.document_number}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1 shrink-0">
                  <Wallet className="w-3 h-3" /> Saldo: {availableQuotas} cota(s)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Preço da cota:{' '}
                {unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Saldo
                disponível:{' '}
                <span className="font-semibold text-foreground">
                  {availableValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </p>
            </div>

            {/* Valor do resgate */}
            <div className="space-y-2">
              <Label htmlFor="admin-redemption-amount">Valor do resgate (R$)</Label>
              <Input
                id="admin-redemption-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              {parsedAmount > 0 && (
                <p
                  className={`text-xs ${
                    requestedQuotas > availableQuotas ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  Equivale a <strong>{requestedQuotas}</strong> cota(s) • Valor considerado:{' '}
                  {effectiveAmount.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                  {requestedQuotas > availableQuotas &&
                    ' — excede o saldo disponível do investimento.'}
                </p>
              )}
            </div>

            {/* Modalidade de pagamento */}
            <div className="space-y-2">
              <Label>Modalidade de pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ted">TED — Transferência bancária</SelectItem>
                  <SelectItem value="pix">PIX — Saque por PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'ted' ? (
              /* Dados bancários (TED) */
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">Dados bancários para depósito</Label>
                  {loadingBanks ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Carregando contas...
                    </span>
                  ) : bankOptions.length > 0 ? (
                    <Select onValueChange={applyBankOption}>
                      <SelectTrigger className="h-8 w-[220px] text-xs">
                        <SelectValue placeholder="Usar conta cadastrada" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} • Ag {b.branch || '—'} • Cta {b.account_number || '—'}
                            {b.is_active ? ' (ativa)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-bank">Banco</Label>
                    <Input
                      id="ar-bank"
                      className={inputCls}
                      placeholder="Ex.: 001 — Banco do Brasil"
                      value={
                        form.bank_code ? `${form.bank_code} — ${form.bank_name}` : form.bank_name
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                        const m = raw.match(/^(\S+)\s+—\s+(.*)$/)
                        if (m) {
                          setForm((p) => ({ ...p, bank_code: m[1], bank_name: m[2] }))
                        } else {
                          setForm((p) => ({ ...p, bank_name: raw, bank_code: '' }))
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-agency">Agência</Label>
                    <Input
                      id="ar-agency"
                      className={inputCls}
                      placeholder="Ex.: 1234-5"
                      value={form.bank_agency}
                      onChange={(e) => setForm((p) => ({ ...p, bank_agency: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-account">Conta (com dígito)</Label>
                    <Input
                      id="ar-account"
                      className={inputCls}
                      placeholder="Ex.: 98765-4"
                      value={form.bank_account}
                      onChange={(e) => setForm((p) => ({ ...p, bank_account: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de conta</Label>
                    <Select
                      value={form.bank_account_type || undefined}
                      onValueChange={(v) => setForm((p) => ({ ...p, bank_account_type: v }))}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-holder">Titular da conta</Label>
                    <Input
                      id="ar-holder"
                      className={inputCls}
                      placeholder="Nome completo / Razão social"
                      value={form.bank_holder_name}
                      onChange={(e) => setForm((p) => ({ ...p, bank_holder_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-doc">CPF/CNPJ do titular</Label>
                    <Input
                      id="ar-doc"
                      className={inputCls}
                      placeholder="000.000.000-00"
                      value={form.bank_holder_document}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          bank_holder_document: maskDocument(e.target.value, holderDocEntity),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Dados do saque por PIX: chave, nome e CPF/CNPJ do titular */
              <div className="space-y-3 rounded-lg border p-3">
                <Label className="text-sm font-semibold">Dados do saque por PIX</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ar-pix-key">Chave PIX</Label>
                    <Input
                      id="ar-pix-key"
                      className={inputCls}
                      placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                      value={form.pix_key}
                      onChange={(e) => setForm((p) => ({ ...p, pix_key: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-pix-holder">Nome do titular da chave</Label>
                    <Input
                      id="ar-pix-holder"
                      className={inputCls}
                      placeholder="Nome completo / Razão social"
                      value={form.bank_holder_name}
                      onChange={(e) => setForm((p) => ({ ...p, bank_holder_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-pix-doc">CPF/CNPJ do titular</Label>
                    <Input
                      id="ar-pix-doc"
                      className={inputCls}
                      placeholder="000.000.000-00"
                      value={form.bank_holder_document}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          bank_holder_document: maskDocument(e.target.value, holderDocEntity),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ar-notes">Observações (opcional)</Label>
              <Input
                id="ar-notes"
                className={inputCls}
                placeholder="Ex.: solicitado por telefone pelo cliente"
                value={form.admin_notes}
                onChange={(e) => setForm((p) => ({ ...p, admin_notes: e.target.value }))}
              />
            </div>

            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs leading-relaxed">
                O valor do resgate é limitado ao saldo disponível em cotas. Impostos, carência e
                rendimentos serão recalculados no momento da aprovação, exatamente como nos pedidos
                feitos pelo próprio investidor.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingBanks}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
              </>
            ) : (
              'Solicitar Resgate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AdminRequestRedemptionDialog
