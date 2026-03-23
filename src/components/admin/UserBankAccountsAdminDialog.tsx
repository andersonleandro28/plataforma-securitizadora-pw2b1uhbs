import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { UserBankAccounts } from '@/components/profile/UserBankAccounts'

export function UserBankAccountsAdminDialog({
  user,
  open,
  onOpenChange,
}: {
  user: any
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão Bancária: {user.full_name || user.email}</DialogTitle>
          <DialogDescription>
            Administre as contas bancárias deste usuário para depósitos e pagamentos de liquidação.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <UserBankAccounts userId={user.id} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
