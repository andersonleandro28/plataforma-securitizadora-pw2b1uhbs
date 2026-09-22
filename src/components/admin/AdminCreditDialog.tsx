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
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { CompanyBankAccountSelect } from '@/components/admin/CompanyBankAccountSelect'

export const CATEGORIAS_CREDITO = [
  'Receita Avulsa',
  'Crédito em Conta',
  'Receitas Diversas',
  'Aporte de Capital',
  'Rendimento Financeiro',
  'Reembolso',
  'Outros',
]

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Modal para lançamento avulso de créditos (entradas/receitas) na conta bancária.
 * Insere em `public.treasury_transactions` com `type = 'in'` e `status = 'Confirmado'`,
 * registrando imediatamente a entrada no Livro Caixa (Contabilidade) e no DRE
 * sem gerar duplicações.
 */
export function AdminCreditDialog({
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

  const resetForm = () => {
    setDescricao('')
    setValor('')
    setData(todayISO())
    setCategoria('')
    setBankAccountId('')
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

    try {
      const payload = {
        type: 'in' as const,
        amount,
        date: data,
        description: descricao.trim(),
        category: categoria,
        status: 'Confirmado',
        created_by: user?.id ?? null,
        is_escrow: false,
        external_ref: `manual-credit-${crypto.randomUUID()}`,
        bank_account_id: bankAccountId,
      }

      const { error } = await supabase.from('treasury_transactions').insert(payload)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Crédito lançado na conta com sucesso')
        resetForm()
        onOpenChange(false)
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao lançar crédito')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar Crédito na Conta</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Receita avulsa de consultoria"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
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
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent className="z-[9999] relative" side="bottom">
                {CATEGORIAS_CREDITO.map((c) => (
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
            label="Conta Bancária de Destino"
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Crédito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
