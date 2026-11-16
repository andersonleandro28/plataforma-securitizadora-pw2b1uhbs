import { useMemo, useState } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calculator, Info, Landmark, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'
import {
  calcularQuitacaoCcb,
  confirmarQuitacaoCcb,
  extrairTaxaMensalContrato,
  extrairTaxasIntegrais,
} from '@/services/ccb-quitacao'

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number) =>
  `${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}%`

interface QuitCcbDialogProps {
  ccb: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Diálogo "Quitar CCB": decomposição item a item (principal, juros do período pela
 * taxa do contrato, desconto proporcional, taxas integrais) e confirmação dos efeitos.
 */
export function QuitCcbDialog({ ccb, open, onOpenChange, onSuccess }: QuitCcbDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [paymentDate, setPaymentDate] = useState(today)
  const [discountInput, setDiscountInput] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const taxaMensal = ccb ? extrairTaxaMensalContrato(ccb) : null
  const taxas = ccb ? extrairTaxasIntegrais(ccb) : null
  const semTaxaContrato = !!ccb && (taxaMensal == null || taxaMensal <= 0)

  const calc = useMemo(() => {
    if (!ccb || semTaxaContrato) return null
    const custom = discountInput.trim() === '' ? undefined : Number(discountInput.replace(',', '.'))
    return calcularQuitacaoCcb(
      ccb,
      paymentDate || today,
      custom != null && !isNaN(custom) ? custom : undefined,
    )
  }, [ccb, paymentDate, discountInput, today, semTaxaContrato])

  const handleConfirm = async () => {
    if (!ccb || !calc) return
    setSaving(true)
    try {
      const custom =
        discountInput.trim() === '' ? undefined : Number(discountInput.replace(',', '.'))
      const res = await confirmarQuitacaoCcb({
        ccbId: ccb.id,
        paymentDate: paymentDate || today,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim() || undefined,
        discountPct: custom != null && !isNaN(custom) ? custom : undefined,
      })
      toast.success(`CCB quitada com sucesso! Total recebido: ${brl(res.total_quitacao)}`)
      setConfirmed(true)
      onOpenChange(false)
      onSuccess?.()
    } catch (e: any) {
      toast.error('Erro ao quitar CCB: ' + (e?.message || 'falha desconhecida'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setDiscountInput('')
          setNotes('')
          setConfirmed(false)
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Quitar CCB
          </DialogTitle>
          <DialogDescription>
            {ccb?.borrower_data?.name || ccb?.profiles?.full_name || 'Tomador'} — CCB{' '}
            {ccb?.id ? String(ccb.id).slice(0, 8).toUpperCase() : ''} · Prazo{' '}
            {ccb?.term_months || '-'}x
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
          {semTaxaContrato && (
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                A taxa do contrato não foi encontrada na simulação desta CCB. Ajuste a taxa em
                "Ajustar" antes de quitar.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data do pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                max={today}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (%) sobre principal + juros — opcional</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                max="100"
                placeholder="Automático pela taxa do contrato"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <CompanyBankAccountSelect
            value={bankAccountId}
            onChange={setBankAccountId}
            label="Conta bancária de recebimento"
          />

          <div className="space-y-1.5">
            <Label className="text-xs">Observações (auditoria) — opcional</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: acordo de quitação antecipada"
              disabled={saving}
            />
          </div>

          {calc && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal (valor da CCB)</span>
                <span className="font-medium">{brl(calc.principal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Juros do período ({pct(calc.taxa_mensal_aplicada * 100)} a.m. ×{' '}
                  {calc.dias_decorridos} dias)
                </span>
                <span className="font-medium text-emerald-700">+ {brl(calc.juros_periodo)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Base (principal + juros)</span>
                <span className="font-medium">{brl(calc.principal + calc.juros_periodo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Desconto{' '}
                  {discountInput.trim() === ''
                    ? '(automático, proporcional à taxa do contrato)'
                    : `(manual: ${pct(calc.desconto_pct)})`}
                </span>
                <span className="font-medium text-rose-600">− {brl(calc.desconto)}</span>
              </div>
              <div className="border-t pt-2 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Taxas integrais (sem desconto)
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground pl-3">Taxa de emissão de CCB</span>
                  <span className="font-medium">{brl(taxas?.taxa_emissao_ccb || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground pl-3">Taxa de análise de crédito</span>
                  <span className="font-medium">{brl(taxas?.taxa_analise || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground pl-3">Taxa de abertura de crédito</span>
                  <span className="font-medium">{brl(taxas?.taxa_abertura_credito || 0)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground pl-3">Subtotal sem desconto</span>
                  <span>{brl(calc.taxas_integrais)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t-2 pt-3 text-base font-bold">
                <span>Total a pagar (entrada no caixa)</span>
                <span className="text-primary">{brl(calc.total_quitacao)}</span>
              </div>
            </div>
          )}

          <Alert className="border-emerald-200 bg-emerald-50/50">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 text-xs">
              Ao confirmar: a operação é baixada para <b>liquidado</b> (libera o limite do tomador —
              regra: pago consome, liquidado libera), o caixa registra a entrada, a tarifa PIX é
              lançada automaticamente e tudo fica registrado na auditoria.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !calc}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Landmark className="h-4 w-4" />
            )}
            Confirmar quitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
