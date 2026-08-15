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

  const resetForm = () => {
    setDescricao('')
    setValor('')
    setData(todayISO())
    setCategoria('')
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

    const amount = Number(valor.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setSaving(true)

    const payload: any = {
      description: descricao.trim(),
      amount,
      due_date: data,
      payment_date: data,
      category: categoria,
      type: 'despesa_administrativa',
      status: 'paid',
      created_by: user?.id ?? null,
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

    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar Despesa Administrativa</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Tarifa bancária mensal"
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
            <Select value={categoria || undefined} onValueChange={setCategoria}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Despesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
