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
              <span className="text-muted-foreground block text-xs mb-1">Data da Transação</span>
              <span className="font-medium">
                {tx.date
                  ? tx.date.length === 10
                    ? tx.date.split('-').reverse().join('/')
                    : new Date(tx.date).toLocaleString('pt-BR')
                  : '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Tipo</span>
              <span
                className={`font-medium ${tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {tx.type === 'in' ? 'ENTRADA' : 'SAÍDA'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Categoria</span>
              <span className="font-medium capitalize">{tx.category}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">
                Valor da Movimentação
              </span>
              <span
                className={`font-medium ${tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {tx.type === 'in' ? '+' : '-'}
                {formatC(tx.value)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Saldo Acumulado Após</span>
              <span className="font-medium">{formatC(tx.accumulated_balance)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs mb-1">ID do Registro Base</span>
              <span className="font-medium text-xs truncate max-w-[200px] block" title={tx.id}>
                {tx.id}
              </span>
            </div>
            <div className="col-span-2 bg-muted/40 p-2.5 rounded-md border border-border/50">
              <span className="text-muted-foreground block text-xs mb-1">Conta Bancária</span>
              {tx.bank_account_info ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {tx.bank_account_info.bank_name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {tx.bank_account_info.branch ? `Ag. ${tx.bank_account_info.branch} • ` : ''}
                    CC {tx.bank_account_info.account_number}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Não vinculada</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Descrição Completa</span>
            <div className="bg-muted p-3 rounded-md text-foreground">{tx.description}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
