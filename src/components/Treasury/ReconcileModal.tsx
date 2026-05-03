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
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export function ReconcileModal({
  open,
  onClose,
  currentBalance,
  onSuccess,
}: {
  open: boolean
  onClose: (v: boolean) => void
  currentBalance: number
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [newBalance, setNewBalance] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!newBalance || !reason) return toast.error('Preencha todos os campos')

    const nb = parseFloat(newBalance.replace(',', '.'))
    if (isNaN(nb)) return toast.error('Valor numérico inválido')

    const diff = nb - currentBalance
    if (diff === 0) return toast.error('O saldo informado é igual ao contabilizado')

    setLoading(true)
    const tipo = diff > 0 ? 'entrada' : 'saída'
    const valor = Math.abs(diff)

    const { error } = await supabase.from('movimentacoes_caixa').insert({
      tipo,
      categoria: tipo === 'entrada' ? 'depósito' : 'despesa',
      descricao: `Reconciliação Manual: ${reason}`,
      valor,
      user_id: user?.id,
      referencia_tipo: 'outro',
    })

    setLoading(false)

    if (error) {
      toast.error('Erro ao reconciliar: ' + error.message)
    } else {
      toast.success('Saldo reconciliado com sucesso')
      setNewBalance('')
      setReason('')
      onSuccess()
      onClose(false)
    }
  }

  const formatC = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconciliar Saldo (Ajuste Manual)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Saldo Atual Contabilizado</Label>
            <Input disabled value={formatC(currentBalance)} className="bg-muted font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Novo Saldo Real</Label>
            <Input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="Ex: 5000.00"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Informe o valor real da conta para gerar o lançamento de ajuste.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Justificativa da Reconciliação</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Ajuste de juros bancários não contabilizados..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Confirmar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
