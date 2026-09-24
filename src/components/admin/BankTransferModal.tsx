import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRightLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { executeBankTransfer } from '@/services/bank-transfers'
import type { CompanyBankAccount } from '@/hooks/use-company-bank-accounts'

interface BankTransferModalProps {
  open: boolean
  onClose: (open: boolean) => void
  accounts: CompanyBankAccount[]
  balances: Record<string, number>
  onSuccess: () => void
}

export function BankTransferModal({
  open,
  onClose,
  accounts,
  balances,
  onSuccess,
}: BankTransferModalProps) {
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Inicializa conta de origem com a primeira disponível quando o modal abre
  useEffect(() => {
    if (open) {
      setValidationError(null)
      setNotes('')
      setAmountStr('')
      setDate(new Date().toISOString().split('T')[0])

      if (accounts.length > 0) {
        // Preferência para a conta ativa ou com saldo > 0
        const active = accounts.find((a) => a.is_active) || accounts[0]
        setSourceId(active.id)

        const other = accounts.find((a) => a.id !== active.id)
        if (other) {
          setDestId(other.id)
        } else {
          setDestId('')
        }
      }
    }
  }, [open, accounts])

  const sourceAccount = accounts.find((a) => a.id === sourceId)
  const destAccount = accounts.find((a) => a.id === destId)
  const sourceBalance = sourceId ? (balances[sourceId] ?? 0) : 0
  const destBalance = destId ? (balances[destId] ?? 0) : 0

  const parsedAmount = (() => {
    if (!amountStr) return 0
    // Aceita formato pt-BR ou número direto
    const clean = amountStr.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(clean)
    return isNaN(n) ? 0 : n
  })()

  // Atualiza validação instantânea
  useEffect(() => {
    if (!sourceId || !destId) {
      setValidationError(null)
      return
    }
    if (sourceId === destId) {
      setValidationError('A conta de origem e destino devem ser diferentes.')
      return
    }
    if (parsedAmount > 0 && parsedAmount > sourceBalance) {
      setValidationError(
        `Saldo insuficiente na conta de origem (${formatCurrency(sourceBalance)}).`,
      )
      return
    }
    setValidationError(null)
  }, [sourceId, destId, parsedAmount, sourceBalance])

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceId || !destId) {
      toast.error('Selecione as contas de origem e destino.')
      return
    }
    if (sourceId === destId) {
      toast.error('A conta de origem e destino não podem ser iguais.')
      return
    }
    if (parsedAmount <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    if (parsedAmount > sourceBalance) {
      toast.error('Saldo insuficiente na conta de origem.')
      return
    }
    if (!date) {
      toast.error('Selecione a data da transferência.')
      return
    }

    setSaving(true)
    try {
      const res = await executeBankTransfer({
        sourceAccountId: sourceId,
        destinationAccountId: destId,
        amount: parsedAmount,
        date,
        notes: notes.trim() || undefined,
      })

      if (!res.success) {
        toast.error(res.error || 'Erro ao realizar transferência.')
        return
      }

      toast.success(res.message || 'Transferência realizada com sucesso!')
      onSuccess()
      onClose(false)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao processar transferência.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Nova Transferência entre Contas
            </DialogTitle>
            <DialogDescription>
              Transfira saldo entre contas bancárias da Securitizadora. A operação gera um par de
              lançamentos espelhados no Livro Caixa (saída e entrada) com neutralidade no DRE e DFC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Conta de Origem */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label htmlFor="source-acc" className="font-semibold">
                  Conta de Origem (Débito / Saída)
                </Label>
                <span className="text-xs text-muted-foreground font-medium">
                  Saldo Atual:{' '}
                  <strong className={sourceBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(sourceBalance)}
                  </strong>
                </span>
              </div>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id="source-acc">
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bank_name} — Ag: {acc.branch || 'S/A'} | C/C: {acc.account_number}{' '}
                      {acc.is_active ? '(Principal)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conta de Destino */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label htmlFor="dest-acc" className="font-semibold">
                  Conta de Destino (Crédito / Entrada)
                </Label>
                <span className="text-xs text-muted-foreground font-medium">
                  Saldo Atual:{' '}
                  <strong className={destBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(destBalance)}
                  </strong>
                </span>
              </div>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger id="dest-acc">
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} disabled={acc.id === sourceId}>
                      {acc.bank_name} — Ag: {acc.branch || 'S/A'} | C/C: {acc.account_number}{' '}
                      {acc.is_active ? '(Principal)' : ''} {acc.id === sourceId ? '(Origem)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="font-semibold">
                  Valor da Transferência (R$)
                </Label>
                <Input
                  id="amount"
                  required
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-date" className="font-semibold">
                  Data da Transferência
                </Label>
                <Input
                  id="transfer-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observação / Finalidade (Opcional)</Label>
              <Input
                id="notes"
                placeholder="Ex: Aporte para liquidação de resgate ou provisão operacional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={160}
              />
            </div>

            {/* Feedback / Validações */}
            {validationError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{validationError}</AlertDescription>
              </Alert>
            )}

            {parsedAmount > 0 && !validationError && sourceAccount && destAccount && (
              <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 border">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Resumo da Operação:
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>Saída ({sourceAccount.bank_name}):</span>
                  <span className="font-mono text-rose-600 font-medium">
                    -{formatCurrency(parsedAmount)}
                  </span>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>Entrada ({destAccount.bank_name}):</span>
                  <span className="font-mono text-emerald-600 font-medium">
                    +{formatCurrency(parsedAmount)}
                  </span>
                </div>
                <div className="text-muted-foreground flex justify-between pt-1 border-t">
                  <span>Novo saldo previsto ({sourceAccount.bank_name}):</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(sourceBalance - parsedAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                Boolean(validationError) ||
                parsedAmount <= 0 ||
                !sourceId ||
                !destId ||
                sourceId === destId
              }
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" /> Confirmar Transferência
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
