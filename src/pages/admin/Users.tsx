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
  Shield,
  UserPlus,
  Mail,
  Loader2,
  Trash2,
  Settings2,
  Landmark,
  Edit,
  Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { ManageRolesDialog } from '@/components/admin/ManageRolesDialog'
import { UserBankAccountsAdminDialog } from '@/components/admin/UserBankAccountsAdminDialog'
import { AdminUserFormDialog } from '@/components/admin/AdminUserFormDialog'
import { getKycCompletion, exportCsv } from '@/lib/kyc-utils'

export default function Users() {
  const { session } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [manageRolesUser, setManageRolesUser] = useState<any>(null)
  const [manageBanksUser, setManageBanksUser] = useState<any>(null)

  // Full CRUD Dialog State
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

  const handleExport = () => {
    const exportData = users.map((u) => ({
      ID: u.id,
      Nome: u.full_name || u.pj_company_name || '',
      Email: u.email,
      Documento: u.document_number,
      Tipo: u.entity_type?.toUpperCase(),
      Papel: u.role,
      Status_KYC: u.kyc_status,
      Completude_KYC: `${getKycCompletion(u).percentage}%`,
      Data_Cadastro: u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '',
    }))
    exportCsv('usuarios_plataforma.csv', exportData)
  }

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.document_number?.includes(search),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">
            Administre perfis, cadastre clientes e valide dados de KYC.
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

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" /> Usuários Cadastrados
            </CardTitle>
            <CardDescription>
              Gerencie o papel e os dados de cada participante da plataforma.
            </CardDescription>
          </div>
          <Input
            placeholder="Buscar por nome, email ou documento..."
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Status / KYC</TableHead>
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
                      className={deletingId === u.id ? 'opacity-50 pointer-events-none' : ''}
                    >
                      <TableCell className="font-medium">
                        <div>{u.full_name || u.pj_company_name || 'Usuário Pendente'}</div>
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
                            {u.is_admin && (
                              <Badge className="text-xs bg-primary/10 text-primary">Admin</Badge>
                            )}
                            {u.is_staff && (
                              <Badge className="text-xs bg-secondary/10 text-secondary">
                                Staff
                              </Badge>
                            )}
                            {u.is_investor && (
                              <Badge variant="outline" className="text-xs">
                                Investidor
                              </Badge>
                            )}
                            {u.is_borrower && (
                              <Badge className="text-xs bg-emerald-600 text-white">Tomador</Badge>
                            )}
                          </div>
                          {comp.percentage < 100 ? (
                            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                              KYC {comp.percentage}%
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                              KYC 100%
                            </span>
                          )}
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
                            title="Editar Cadastro"
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerenciar Papéis"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setManageRolesUser(u)}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir Usuário"
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
