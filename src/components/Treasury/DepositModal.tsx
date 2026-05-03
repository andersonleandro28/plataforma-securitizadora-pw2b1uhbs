import { useState } from 'react'
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
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function DepositModal({ open, onClose, onSuccess }: any) {
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!valor || !descricao) return toast.error('Preencha os campos obrigatórios')
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const valNum = Number(valor)
      if (valNum <= 0) throw new Error('Valor deve ser maior que zero')

      const origemId = crypto.randomUUID()

      const { data: mov, error: movErr } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          tipo: 'entrada',
          categoria: 'depósito',
          descricao,
          valor: valNum,
          saldo_anterior: 0,
          saldo_novo: 0,
          referencia_tipo: 'depósito',
          referencia_numero: referencia || null,
          user_id: user.id,
        })
        .select()
        .single()

      if (movErr) throw movErr

      const { error: mapErr } = await supabase.from('mapeamento_movimentacoes').insert({
        movimentacao_caixa_id: mov.id,
        origem_tabela: 'depósitos',
        origem_id: origemId,
        sincronizado: true,
        user_id: user.id,
      })

      if (mapErr) {
        await supabase.from('movimentacoes_caixa').delete().eq('id', mov.id)
        throw mapErr
      }

      toast.success('Depósito registrado no caixa')
      if (onSuccess) onSuccess()
      onClose(false)
      setValor('')
      setDescricao('')
      setReferencia('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Depósito Manual</DialogTitle>
          <DialogDescription>Adicione uma entrada de recursos avulsa ao caixa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Aporte de capital"
            />
          </div>
          <div className="space-y-2">
            <Label>Referência (Opcional)</Label>
            <Input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex: DEP-001"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar Depósito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
