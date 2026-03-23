import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, UserPlus, Mail, Loader2, Trash2, Settings2, Landmark } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { ManageRolesDialog } from '@/components/admin/ManageRolesDialog'
import { UserBankAccountsAdminDialog } from '@/components/admin/UserBankAccountsAdminDialog'

export default function Users() {
  const { session } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('investor')
  const [inviting, setInviting] = useState(false)
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [manageRolesUser, setManageRolesUser] = useState<any>(null)
  const [manageBanksUser, setManageBanksUser] = useState<any>(null)

  const loadUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleRoleChange = async (userId: string, roleKey: string, checked: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ [roleKey]: checked })
      .eq('id', userId)
    if (error) {
      toast.error('Erro ao atualizar permissões do usuário.')
    } else {
      toast.success('Permissões atualizadas com sucesso.')
      setUsers(users.map((u) => (u.id === userId ? { ...u, [roleKey]: checked } : u)))
      if (manageRolesUser?.id === userId) {
        setManageRolesUser({ ...manageRolesUser, [roleKey]: checked })
      }
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return toast.error('Sessão expirada')
    setInviting(true)
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail, fullName: inviteName, role: inviteRole },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao convidar usuário.')
    } else {
      toast.success('Convite enviado com sucesso')
      setOpen(false)
      setInviteEmail('')
      setInviteName('')
      loadUsers()
    }
    setInviting(false)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!session?.access_token) return toast.error('Sessão expirada')
    setDeletingId(userId)
    const promise = supabase.functions
      .invoke('delete-user', {
        body: { targetUserId: userId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .then(({ data, error }) => {
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      })
      .finally(() => setDeletingId(null))

    toast.promise(promise, {
      loading: 'Excluindo usuário...',
      success: 'Usuário excluído.',
      error: (err) => err.message || 'Erro ao excluir.',
    })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">
            Administre perfis, níveis de acesso e convites da plataforma.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Enviaremos um link seguro para o usuário definir sua senha e acessar a plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="joao@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nível de Acesso Inicial</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investidor / Debenturista</SelectItem>
                      <SelectItem value="borrower">Tomador de Crédito</SelectItem>
                      <SelectItem value="staff">Equipe Interna (Staff)</SelectItem>
                      <SelectItem value="admin">Administrador Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={inviting}>
                  {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar Convite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ManageRolesDialog
        user={manageRolesUser}
        open={!!manageRolesUser}
        onOpenChange={(v: boolean) => !v && setManageRolesUser(null)}
        onRoleChange={handleRoleChange}
        currentUserId={session?.user?.id}
      />

      <UserBankAccountsAdminDialog
        user={manageBanksUser}
        open={!!manageBanksUser}
        onOpenChange={(v: boolean) => !v && setManageBanksUser(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Usuários Cadastrados
          </CardTitle>
          <CardDescription>
            Gerencie o papel e o acesso de cada participante do fundo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papéis (Roles)</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow
                    key={u.id}
                    className={deletingId === u.id ? 'opacity-50 pointer-events-none' : ''}
                  >
                    <TableCell className="font-medium">
                      <div>{u.full_name || 'Usuário Pendente'}</div>
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-normal mt-1">
                        <Mail className="h-3 w-3" /> {u.email || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap max-w-[250px]">
                        {u.is_admin && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            Admin
                          </Badge>
                        )}
                        {u.is_staff && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-secondary/10 text-secondary hover:bg-secondary/20"
                          >
                            Staff
                          </Badge>
                        )}
                        {u.is_investor && (
                          <Badge variant="outline" className="text-xs border-muted-foreground/30">
                            Investidor
                          </Badge>
                        )}
                        {u.is_borrower && (
                          <Badge
                            variant="default"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Tomador
                          </Badge>
                        )}
                        {!(u.is_admin || u.is_staff || u.is_investor || u.is_borrower) && (
                          <span className="text-xs text-muted-foreground">
                            Sem papéis definidos
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setManageBanksUser(u)}
                        >
                          <Landmark className="h-3.5 w-3.5" /> Contas
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setManageRolesUser(u)}
                        >
                          <Settings2 className="h-3.5 w-3.5" /> Papéis
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={session?.user?.id === u.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita e os dados serão removidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                Sim, excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
