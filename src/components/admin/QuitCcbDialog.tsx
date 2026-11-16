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

/**
 * Modo de cobrança das taxas na quitação.
 *
 * 'cobrar' (padrão, mantém o que já acontece hoje): soma emissão, análise e
 * abertura ao total da quitação.
 *
 * 'nao_cobrar': não soma. O simulador (calculate-operation) já desconta essas
 * mesmas taxas na liberação do crédito — cobrá-las de novo na quitação é
 * duplicidade. A decisão é do gestor, por isso é explícita na tela.
 *
 * Ver o comentário completo na migration 20261118100000_ccb_quitacao_banco.sql.
 */
type TaxasModo = 'cobrar' | 'nao_cobrar'

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
  const [taxasModo, setTaxasModo] = useState<TaxasModo>('cobrar')

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
      taxasModo,
    )
  }, [
    ccbComBoletos,
    paymentDate,
    discountInput,
    today,
    semTaxaContrato,
    loadingParcelas,
    taxasModo,
  ])

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
        taxasModo,
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
            <Label className="text-xs">Taxas de emissão, análise e abertura na quitação</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={taxasModo}
              onChange={(e) => setTaxasModo(e.target.value as TaxasModo)}
              disabled={saving || todasPagas}
            >
              <option value="cobrar">Cobrar no total da quitação (padrão)</option>
              <option value="nao_cobrar">Não cobrar — já foram descontadas na liberação</option>
            </select>
            <p className="text-[10px] leading-tight text-muted-foreground">
              O simulador desconta essas taxas na liberação do crédito. Cobrá-las de novo aqui é
              duplicidade — confira o contrato antes de mudar.
            </p>
          </div>

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
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Demonstrativo parcela a parcela
              </div>
              <div className="max-h-40 overflow-y-auto rounded border bg-background/60">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Vencimento</th>
                      <th className="px-2 py-1 text-right font-medium">Face</th>
                      <th className="px-2 py-1 text-right font-medium">Dias</th>
                      <th className="px-2 py-1 text-right font-medium">Valor presente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.linhas.map((l, i) => (
                      <tr key={i} className={l.vencida ? 'text-rose-700' : ''}>
                        <td className="px-2 py-0.5">
                          {l.vencimento}
                          {l.vencida && <span className="ml-1 font-semibold">(vencida)</span>}
                        </td>
                        <td className="px-2 py-0.5 text-right">{brl(l.valor_face)}</td>
                        <td className="px-2 py-0.5 text-right">{l.dias_ate_vencimento}</td>
                        <td className="px-2 py-0.5 text-right font-medium">
                          {brl(l.valor_presente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] leading-tight text-muted-foreground">
                Cada parcela é trazida a valor presente pela taxa do contrato (
                {pct(calc.taxa_mensal_aplicada * 100)} a.m.) até a data do pagamento — critério da
                Resolução BCB 3.919/2010, art. 8º.
              </p>

              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">
                  Saldo de face em aberto ({calc.parcelas.abertas} parcela
                  {calc.parcelas.abertas === 1 ? '' : 's'} de {calc.parcelas.total})
                </span>
                <span className="font-medium">{brl(calc.principal)}</span>
              </div>

              {calc.mora > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Mora de parcelas vencidas ({calc.parcelas.vencidas})
                  </span>
                  <span className="font-medium text-amber-700">+ {brl(calc.mora)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor presente total</span>
                <span className="font-medium">{brl(calc.valor_presente)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {discountInput.trim() === ''
                    ? 'Deságio (juros futuros não devidos)'
                    : `Desconto comercial (${pct(calc.desconto_pct)})`}
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
