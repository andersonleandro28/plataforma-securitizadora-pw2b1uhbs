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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  executeDeleteFinancialTransaction,
  type FinancialDeletionTarget,
} from '@/services/financial-deletion'

export interface FinancialRecordToDelete {
  id: string
  descricao: string
  valor: number
  date: string
  categoria?: string
  tipo?: string
  origem?: string
  deletionTarget: FinancialDeletionTarget
}

export function DeleteFinancialRecordModal({
  record,
  open,
  onClose,
  onSuccess,
}: {
  record: FinancialRecordToDelete | null
  open: boolean
  onClose: (v: boolean) => void
  onSuccess: () => void
}) {
  const [justification, setJustification] = useState('')
  const [loading, setLoading] = useState(false)

  if (!record) return null

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleDelete = async () => {
    if (!record.deletionTarget.canDelete) {
      toast.error(record.deletionTarget.reason)
      return
    }

    setLoading(true)
    const res = await executeDeleteFinancialTransaction({
      targetTable: record.deletionTarget.targetTable,
      recordId: record.deletionTarget.recordId,
      justification: justification.trim() || 'Lançamento incorreto excluído pelo administrador',
    })

    setLoading(false)

    if (res.success) {
      toast.success(res.message || 'Lançamento excluído com sucesso.')
      setJustification('')
      onClose(false)
      onSuccess()
    } else {
      toast.error(res.error || 'Erro ao excluir lançamento.')
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setJustification('')
    }
    onClose(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <Trash2 className="w-5 h-5" />
            <DialogTitle>Confirmar Exclusão de Lançamento</DialogTitle>
          </div>
          <DialogDescription>
            Esta ação removerá este lançamento de todas as visões (Livro Caixa, DRE e DFC) e
            recalculará os saldos em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border p-3 bg-muted/40 space-y-2">
            <div className="flex justify-between items-start text-sm">
              <span className="text-muted-foreground">Descrição:</span>
              <span className="font-medium text-right max-w-[280px] break-words">
                {record.descricao}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-semibold text-rose-600 font-mono">
                {formatCurrency(record.valor)}
              </span>
            </div>
            {record.categoria && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Categoria:</span>
                <span className="font-medium">{record.categoria}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data da Movimentação:</span>
              <span className="font-medium">
                {record.date.length === 10
                  ? record.date.split('-').reverse().join('/')
                  : new Date(record.date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          <Alert className="border-rose-200 bg-rose-50/50 text-rose-900 text-xs py-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <AlertDescription>
              Certifique-se de que o lançamento foi realizado por engano. A exclusão será registrada
              no histórico de auditoria.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="del-justification" className="text-xs">
              Motivo do cancelamento / errata (opcional)
            </Label>
            <Textarea
              id="del-justification"
              placeholder="Ex.: Lançamento duplicado ou valor digitado incorretamente..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="gap-2 bg-rose-600 hover:bg-rose-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Sim, Excluir Lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
