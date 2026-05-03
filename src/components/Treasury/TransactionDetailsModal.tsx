import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function TransactionDetailsModal({
  tx,
  open,
  onClose,
}: {
  tx: any
  open: boolean
  onClose: (v: boolean) => void
}) {
  if (!tx) return null

  const formatC = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Movimentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Data e Hora Exata</span>
              <span className="font-medium">{new Date(tx.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Tipo</span>
              <span
                className={`font-medium ${tx.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {tx.tipo.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Categoria</span>
              <span className="font-medium capitalize">{tx.categoria.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">
                Valor da Movimentação
              </span>
              <span className="font-medium">{formatC(tx.valor)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Saldo Anterior</span>
              <span className="font-medium">{formatC(tx.saldo_anterior)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Saldo Novo</span>
              <span className="font-medium">{formatC(tx.saldo_novo)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Referência</span>
              <span className="font-medium">
                {tx.referencia_tipo || 'N/A'} -{' '}
                {tx.referencia_numero || tx.referencia_id?.split('-')[0] || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Usuário (ID)</span>
              <span className="font-medium text-xs truncate max-w-[200px] block" title={tx.user_id}>
                {tx.user_id}
              </span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Descrição Completa</span>
            <div className="bg-muted p-3 rounded-md text-foreground">{tx.descricao}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
