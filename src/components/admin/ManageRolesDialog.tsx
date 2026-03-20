import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ManageRolesDialog({ user, open, onOpenChange, onRoleChange, currentUserId }: any) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar Papéis de Acesso</DialogTitle>
          <DialogDescription>
            Defina as áreas da plataforma que {user.full_name || 'o usuário'} pode acessar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <Label className="flex flex-col gap-1 cursor-pointer">
              <span className="font-semibold text-primary">Administrador Geral</span>
              <span className="font-normal text-xs text-muted-foreground">
                Controle total sobre a plataforma, usuários e configurações globais.
              </span>
            </Label>
            <Switch
              checked={user.is_admin}
              onCheckedChange={(c) => onRoleChange(user.id, 'is_admin', c)}
              disabled={currentUserId === user.id}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <Label className="flex flex-col gap-1 cursor-pointer">
              <span className="font-semibold text-secondary">Equipe Interna (Staff)</span>
              <span className="font-normal text-xs text-muted-foreground">
                Acesso ao backoffice, tesouraria e operações do dia a dia.
              </span>
            </Label>
            <Switch
              checked={user.is_staff}
              onCheckedChange={(c) => onRoleChange(user.id, 'is_staff', c)}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <Label className="flex flex-col gap-1 cursor-pointer">
              <span className="font-semibold">Investidor / Debenturista</span>
              <span className="font-normal text-xs text-muted-foreground">
                Acesso ao dashboard de rentabilidade e painel de passivos.
              </span>
            </Label>
            <Switch
              checked={user.is_investor}
              onCheckedChange={(c) => onRoleChange(user.id, 'is_investor', c)}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <Label className="flex flex-col gap-1 cursor-pointer">
              <span className="font-semibold text-emerald-600">Tomador de Crédito</span>
              <span className="font-normal text-xs text-muted-foreground">
                Acesso ao portal de obrigações, acompanhamento de limites e remessas.
              </span>
            </Label>
            <Switch
              checked={user.is_borrower}
              onCheckedChange={(c) => onRoleChange(user.id, 'is_borrower', c)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
