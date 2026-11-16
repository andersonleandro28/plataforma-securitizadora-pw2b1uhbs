import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, Calculator, Info, Landmark, ShieldCheck, FileWarning } from 'lucide-react'
import { toast } from 'sonner'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'
import { supabase } from '@/lib/supabase/client'
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
 * Diálogo "Quitar CCB": decomposição item a item sobre o SALDO EM ABERTO
 * (parcelas com status diferente de "Pago"/"Liquidado" no array `boletos` de
 * recebiveis_ccb). Parcelas pagas — no vencimento ou antecipadas — NÃO entram no
 * total a pagar. Resumo "N parcelas — X já pagas (R$ …) — Y em aberto (R$ …)" para
 * conferência. Se TODAS estiverem pagas, avisa e bloqueia a quitação.
 */
export function QuitCcbDialog({ ccb, open, onOpenChange, onSuccess }: QuitCcbDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [paymentDate, setPaymentDate] = useState(today)
  const [discountInput, setDiscountInput] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [recebivel, setRecebivel] = useState<any | null>(null)
  const [loadingParcelas, setLoadingParcelas] = useState(false)

  // Busca o recebível vinculado (fonte da verdade dos boletos/parcelas)
  useEffect(() => {
    let cancel = false
    setRecebivel(null)
    if (!open || !ccb?.id) return
    setLoadingParcelas(true)
    supabase
      .from('recebiveis_ccb')
      .select('id, boletos')
      .eq('ccb_id', ccb.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) {
          setRecebivel(data || null)
          setLoadingParcelas(false)
        }
      })
    return () => {
      cancel = true
    }
  }, [open, ccb?.id])

  const taxaMensal = ccb ? extrairTaxaMensalContrato(ccb) : null
  const taxas = ccb ? extrairTaxasIntegrais(ccb) : null
  const semTaxaContrato = !!ccb && (taxaMensal == null || taxaMensal <= 0)

  const ccbComBoletos = useMemo(
    () => (ccb ? { ...ccb, _recebivel: recebivel } : null),
    [ccb, recebivel],
  )

  const calc = useMemo(() => {
    if (!ccbComBoletos || semTaxaContrato || loadingParcelas) return null
    const custom = discountInput.trim() === '' ? undefined : Number(discountInput.replace(',', '.'))
    return calcularQuitacaoCcb(
      ccbComBoletos,
      paymentDate || today,
      custom != null && !isNaN(custom) ? custom : undefined,
    )
  }, [ccbComBoletos, paymentDate, discountInput, today, semTaxaContrato, loadingParcelas])

  // Caso limite: todas as parcelas pagas → nada a quitar (bloqueia)
  const todasPagas = !!calc && calc.parcelas.total > 0 && calc.parcelas.abertas === 0

  const handleConfirm = async () => {
    if (!ccb || !calc || todasPagas) return
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

  const resetForm = () => {
    setDiscountInput('')
    setNotes('')
    setConfirmed(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
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

          {loadingParcelas && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando parcelas da CCB…
            </div>
          )}

          {/* Resumo de parcelas: pagas × em aberto */}
          {calc && calc.parcelas.total > 0 && (
            <div
              className={`rounded-lg border p-3 text-xs space-y-1 ${
                todasPagas ? 'border-rose-200 bg-rose-50' : 'border-blue-200 bg-blue-50/60'
              }`}
            >
              <div className="font-semibold text-muted-foreground uppercase tracking-wide">
                Situação das parcelas
              </div>
              <div className={todasPagas ? 'text-rose-800' : 'text-blue-900'}>
                {calc.parcelas.total} parcela{calc.parcelas.total > 1 ? 's' : ''} —{' '}
                {calc.parcelas.pagas} já paga{calc.parcelas.pagas === 1 ? '' : 's'} (
                {brl(calc.parcelas.valor_pago)}) — {calc.parcelas.abertas} em aberto (
                {brl(calc.parcelas.valor_aberto)})
              </div>
              <div className="text-muted-foreground">
                A quitação considera apenas as parcelas em aberto; as pagas (inclusive antecipadas)
                não entram no total a pagar.
              </div>
            </div>
          )}

          {todasPagas && (
            <Alert className="border-rose-200 bg-rose-50">
              <FileWarning className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-800 text-xs font-medium">
                Todas as {calc?.parcelas.total} parcelas desta CCB já estão pagas — não há nada a
                quitar. Use "Gerir" para baixar a operação, se necessário.
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
                disabled={saving || todasPagas}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Desconto (%) sobre saldo em aberto + juros — opcional
              </Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                max="100"
                placeholder="Automático pela taxa do contrato"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                disabled={saving || todasPagas}
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
              disabled={saving || todasPagas}
            />
          </div>

          {calc && !todasPagas && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Saldo em aberto ({calc.parcelas.abertas} parcela
                  {calc.parcelas.abertas === 1 ? '' : 's'} de {calc.parcelas.total})
                </span>
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
                <span className="text-muted-foreground">Base (saldo + juros)</span>
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
            disabled={saving || !calc || todasPagas || confirmed}
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
