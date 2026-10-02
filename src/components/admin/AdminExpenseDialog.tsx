import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Repeat, Calendar, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { generateRecurringInstallments } from '@/lib/recurring-expenses'
import { formatDate } from '@/lib/utils'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'

const CATEGORIAS = [
  'Tarifa Bancária',
  'Imposto',
  'Taxa',
  'Manutenção de Conta',
  'Despesa Administrativa',
  'Outros',
]

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Modal para lançamento de despesas administrativas (impostos, tarifas
 * bancárias, taxas, etc.) — despesas já incorridas que não emitem nota fiscal
 * e não são pagamento de fornecedor. Insere na tabela `public.expenses` com
 * `type = 'despesa_administrativa'` e `status = 'paid'`.
 */
export function AdminExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [categoria, setCategoria] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  // Suporte a despesa administrativa recorrente
  const [isRecurring, setIsRecurring] = useState(false)
  const [installmentsCount, setInstallmentsCount] = useState('12')
  const [amountMode, setAmountMode] = useState<'per_installment' | 'total'>('per_installment')

  const resetForm = () => {
    setDescricao('')
    setValor('')
    setData(todayISO())
    setCategoria('')
    setBankAccountId('')
    setIsRecurring(false)
    setInstallmentsCount('12')
    setAmountMode('per_installment')
  }

  const handleClose = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
  }

  const handleSave = async () => {
    if (!descricao.trim() || !valor || !data || !categoria) {
      toast.error('Preencha todos os campos.')
      return
    }

    if (!bankAccountId) {
      toast.error('Selecione a conta bancária da movimentação.')
      return
    }

    const amount = Number(valor.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setSaving(true)

    if (isRecurring) {
      const numInstallments = parseInt(installmentsCount, 10)
      if (isNaN(numInstallments) || numInstallments < 2 || numInstallments > 60) {
        toast.error('Informe uma quantidade de parcelas válida (entre 2 e 60).')
        setSaving(false)
        return
      }

      const recurrenceGroupId = crypto.randomUUID()
      const schedule = generateRecurringInstallments({
        baseDescription: descricao.trim(),
        startDate: data,
        installmentsCount: numInstallments,
        amountMode,
        amount,
      })

      const rowsToInsert = schedule.map((item) => {
        const isFirst = item.installmentNumber === 1
        return {
          description: item.fullDescription,
          amount: item.amount,
          due_date: item.dueDate,
          // A 1ª parcela da despesa administrativa já foi incorrida/paga; parcelas subsequentes ficam pendentes
          status: isFirst ? 'paid' : 'pending',
          payment_date: isFirst ? data : null,
          category: categoria,
          type: 'despesa_administrativa',
          created_by: user?.id ?? null,
          bank_account_id: bankAccountId,
          recurrence_group_id: recurrenceGroupId,
          installment_number: item.installmentNumber,
          total_installments: item.totalInstallments,
        }
      })

      const { error } = await supabase.from('expenses').insert(rowsToInsert)

      if (error) {
        toast.error(error.message)
      } else {
        // Registrar auditoria
        try {
          const totalCalculated = schedule.reduce((sum, s) => sum + s.amount, 0)
          await (supabase.from('audit_logs') as any).insert({
            user_id: user?.id || null,
            action: 'CREATE_RECURRING_EXPENSE_GROUP',
            entity_type: 'expenses',
            entity_id: recurrenceGroupId,
            details: {
              type: 'despesa_administrativa',
              recurrence_group_id: recurrenceGroupId,
              description: descricao.trim(),
              category: categoria,
              installments_count: numInstallments,
              amount_mode: amountMode,
              input_amount: amount,
              total_group_amount: Number(totalCalculated.toFixed(2)),
              first_due_date: data,
              last_due_date: schedule[schedule.length - 1]?.dueDate,
            },
          })
        } catch (auditErr) {
          console.warn('Falha ao gravar audit_log de despesa administrativa recorrente:', auditErr)
        }

        toast.success(`Despesa recorrente lançada com sucesso (${numInstallments} parcelas).`)
        resetForm()
        onOpenChange(false)
        onSuccess()
      }
    } else {
      const payload: any = {
        description: descricao.trim(),
        amount,
        due_date: data,
        payment_date: data,
        category: categoria,
        type: 'despesa_administrativa',
        status: 'paid',
        created_by: user?.id ?? null,
        bank_account_id: bankAccountId,
      }

      const { error } = await supabase.from('expenses').insert(payload)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Despesa lançada com sucesso')
        resetForm()
        onOpenChange(false)
        onSuccess()
      }
    }

    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRecurring
              ? 'Lançar Despesa Administrativa Recorrente'
              : 'Lançar Despesa Administrativa'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Alternador de despesa recorrente */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <Label
                  htmlFor="admin-expense-recurring"
                  className="text-sm font-semibold cursor-pointer"
                >
                  Despesa recorrente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Parcelas mensais repetindo no mesmo dia dos meses subsequentes.
                </p>
              </div>
            </div>
            <Switch
              id="admin-expense-recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Tarifa bancária mensal / Assessoria contábil"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {isRecurring && amountMode === 'total'
                  ? 'Valor Total (R$) *'
                  : 'Valor da Parcela (R$) *'}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRecurring ? 'Data da 1ª Parcela *' : 'Data *'}</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {/* Configurações extras de recorrência */}
          {isRecurring && (
            <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-3">
              <div className="flex items-center gap-2 text-indigo-950 font-medium text-xs">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Configuração das Parcelas
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade de Parcelas *</Label>
                  <Input
                    type="number"
                    min="2"
                    max="60"
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(e.target.value)}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Critério do Valor</Label>
                  <Select
                    value={amountMode}
                    onValueChange={(v: 'per_installment' | 'total') => setAmountMode(v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="per_installment">Valor por Parcela</SelectItem>
                      <SelectItem value="total">Valor Total (Dividir)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Demonstrativo em tempo real */}
              {(() => {
                const count = parseInt(installmentsCount, 10)
                const amt = Number(valor.replace(',', '.'))
                if (!count || count <= 0 || !amt || amt <= 0 || !data) return null
                const preview = generateRecurringInstallments({
                  baseDescription: descricao || 'Despesa Administrativa',
                  startDate: data,
                  installmentsCount: count,
                  amountMode,
                  amount: amt,
                })
                const total = preview.reduce((sum, p) => sum + p.amount, 0)

                return (
                  <div className="pt-2 border-t border-indigo-200/60 text-xs space-y-1">
                    <div className="flex justify-between font-medium text-indigo-950">
                      <span>Valor de cada parcela:</span>
                      <span>
                        R${' '}
                        {preview[0]?.amount.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total acumulado ({count}x):</span>
                      <span>
                        R${' '}
                        {total.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      Vencimentos de {formatDate(preview[0]?.dueDate)} até{' '}
                      {formatDate(preview[preview.length - 1]?.dueDate)}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent className="z-[9999] relative" side="bottom">
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CompanyBankAccountSelect
            value={bankAccountId}
            onChange={setBankAccountId}
            label="Conta Bancária de Saída"
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isRecurring ? `Lançar ${installmentsCount || ''} Parcelas` : 'Salvar Despesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
