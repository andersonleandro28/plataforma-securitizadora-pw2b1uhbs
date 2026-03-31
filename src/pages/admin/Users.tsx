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
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Shield,
  UserPlus,
  Mail,
  Loader2,
  Trash2,
  Settings2,
  Landmark,
  Edit,
  Download,
  MoreHorizontal,
  Key,
  Ban,
  Unlock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { ManageRolesDialog } from '@/components/admin/ManageRolesDialog'
import { UserBankAccountsAdminDialog } from '@/components/admin/UserBankAccountsAdminDialog'
import { AdminUserFormDialog } from '@/components/admin/AdminUserFormDialog'
import { AdminChangePasswordDialog } from '@/components/admin/AdminChangePasswordDialog'
import { getKycCompletion, exportCsv } from '@/lib/kyc-utils'

export default function Users() {
  const { session } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')

  const [processingId, setProcessingId] = useState<string | null>(null)

  // Dialog States
  const [manageRolesUser, setManageRolesUser] = useState<any>(null)
  const [manageBanksUser, setManageBanksUser] = useState<any>(null)
  const [passwordUser, setPasswordUser] = useState<any>(null)
  const [deletingUser, setDeletingUser] = useState<any>(null)
  const [blockUser, setBlockUser] = useState<any>(null)

  // Full CRUD Form Dialog State
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

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

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setProcessingId(deletingUser.id)
    const promise = supabase.functions
      .invoke('delete-user', {
        body: { targetUserId: deletingUser.id },
      })
      .then(({ data, error }) => {
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      })
      .finally(() => {
        setProcessingId(null)
        setDeletingUser(null)
      })

    toast.promise(promise, {
      loading: 'Excluindo usuário...',
      success: 'Usuário excluído permanentemente.',
      error: (err) => err.message || 'Erro ao excluir.',
    })
  }

  const handleToggleBlock = async () => {
    if (!blockUser) return
    setProcessingId(blockUser.id)
    const isBlocking = !blockUser.is_blocked

    const promise = supabase.functions
      .invoke('admin-update-user', {
        body: {
          targetUserId: blockUser.id,
          action: 'toggle_block',
          payload: { is_blocked: isBlocking },
        },
      })
      .then(({ data, error }) => {
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        setUsers((prev) =>
          prev.map((u) => (u.id === blockUser.id ? { ...u, is_blocked: isBlocking } : u)),
        )
      })
      .finally(() => {
        setProcessingId(null)
        setBlockUser(null)
      })

    toast.promise(promise, {
      loading: isBlocking ? 'Bloqueando acesso...' : 'Restaurando acesso...',
      success: isBlocking ? 'Usuário bloqueado com sucesso.' : 'Acesso do usuário restaurado.',
      error: (err) => err.message || 'Erro ao alterar status.',
    })
  }

  const handleExport = () => {
    const exportData = users.map((u) => ({
      ID: u.id,
      Nome: u.full_name || u.pj_company_name || '',
      Email: u.email,
      Documento: u.document_number,
      Tipo: u.entity_type?.toUpperCase(),
      Papel: u.role,
      Status_Acesso: u.is_blocked ? 'Bloqueado' : 'Ativo',
      Status_KYC: u.kyc_status,
      Completude_KYC: `${getKycCompletion(u).percentage}%`,
      Data_Cadastro: u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '',
    }))
    exportCsv('usuarios_plataforma.csv', exportData)
  }

  const filteredUsers = users.filter(
    (u) =>
      (entityFilter === 'all' || u.entity_type === entityFilter) &&
      (u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.pj_company_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.document_number?.includes(search)),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">
            Administre perfis, acessos de segurança e valide dados de KYC.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingUser(null)
              setFormOpen(true)
            }}
          >
            <UserPlus className="h-4 w-4" /> Novo Cadastro
          </Button>
        </div>
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

      <AdminUserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSaved={loadUsers}
      />

      <AdminChangePasswordDialog
        user={passwordUser}
        open={!!passwordUser}
        onOpenChange={(v: boolean) => !v && setPasswordUser(null)}
      />

      <AlertDialog open={!!deletingUser} onOpenChange={(v) => !v && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados, carteiras e documentos atrelados a
              este usuário serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingUser(null)}
              disabled={!!processingId}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={!!processingId}>
              {processingId === deletingUser?.id && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Sim, excluir usuário
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!blockUser} onOpenChange={(v) => !v && setBlockUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockUser?.is_blocked
                ? 'Restaurar acesso do usuário?'
                : 'Bloquear acesso do usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockUser?.is_blocked
                ? 'O usuário voltará a ter acesso imediato à plataforma com suas credenciais atuais.'
                : 'O usuário será desconectado imediatamente e não poderá acessar a plataforma até ser desbloqueado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBlockUser(null)} disabled={!!processingId}>
              Cancelar
            </Button>
            <Button
              variant={blockUser?.is_blocked ? 'default' : 'destructive'}
              onClick={handleToggleBlock}
              disabled={!!processingId}
            >
              {processingId === blockUser?.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {blockUser?.is_blocked ? 'Sim, desbloquear' : 'Sim, bloquear acesso'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" /> Usuários da Plataforma
            </CardTitle>
            <CardDescription>
              Acompanhe e controle o status e papéis de todos os participantes.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md w-full">
            <select
              className="flex h-10 w-full sm:w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="all">Todos (PF/PJ)</option>
              <option value="pf">Pessoa Física</option>
              <option value="pj">Pessoa Jurídica</option>
            </select>
            <Input
              placeholder="Buscar nome, email ou documento..."
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>{' '}
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Status / Acesso</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const comp = getKycCompletion(u)
                  return (
                    <TableRow
                      key={u.id}
                      className={
                        processingId === u.id
                          ? 'opacity-50 pointer-events-none transition-opacity'
                          : ''
                      }
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={u.is_blocked ? 'text-muted-foreground line-through' : ''}
                          >
                            {u.full_name || u.pj_company_name || 'Usuário Pendente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-normal mt-1">
                          <Mail className="h-3 w-3" /> {u.email || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {u.document_number || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex gap-1.5 flex-wrap">
                            {u.is_blocked ? (
                              <Badge variant="destructive" className="text-[10px] uppercase">
                                Acesso Bloqueado
                              </Badge>
                            ) : (
                              <>
                                {u.is_admin && (
                                  <Badge className="text-[10px] bg-primary/10 text-primary uppercase">
                                    Admin
                                  </Badge>
                                )}
                                {u.is_staff && (
                                  <Badge className="text-[10px] bg-secondary/10 text-secondary uppercase">
                                    Staff
                                  </Badge>
                                )}
                                {u.is_investor && (
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    Investidor
                                  </Badge>
                                )}
                                {u.is_borrower && (
                                  <Badge className="text-[10px] bg-emerald-600 text-white uppercase">
                                    Tomador
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          {!u.is_blocked &&
                            (comp.percentage < 100 ? (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                                KYC {comp.percentage}%
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                KYC 100%
                              </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar Dados Cadastrais"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            onClick={() => {
                              setEditingUser(u)
                              setFormOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Contas Bancárias"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setManageBanksUser(u)}
                          >
                            <Landmark className="h-4 w-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Segurança e Mais"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                                Acesso e Segurança
                              </DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setManageRolesUser(u)}>
                                <Settings2 className="mr-2 h-4 w-4" /> Papéis de Acesso
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPasswordUser(u)}>
                                <Key className="mr-2 h-4 w-4" /> Redefinir Senha
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setBlockUser(u)}
                                disabled={session?.user?.id === u.id}
                              >
                                {u.is_blocked ? (
                                  <Unlock className="mr-2 h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Ban className="mr-2 h-4 w-4 text-amber-600" />
                                )}
                                {u.is_blocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => setDeletingUser(u)}
                                disabled={session?.user?.id === u.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Permanentemente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
