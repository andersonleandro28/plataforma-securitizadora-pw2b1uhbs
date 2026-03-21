import { ReactNode } from 'react'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2, ShieldAlert } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, availableRoles, loading } = useAuth()

  // 1. Eliminação total de esperas artificiais (removido setTimeout e estados intermediários)
  if (loading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando autorização...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // 2. Passe Livre / Bypass Absoluto para o Super Admin
  // Garante acesso imediato ignorando qualquer falha de cache ou atraso no banco
  const isSuperAdmin = user.email === 'andersonleandro28@gmail.com'
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // 3. Avaliação síncrona e direta das permissões reais vs em cache
  const roleToCheck =
    activeRole || (availableRoles && availableRoles.length > 0 ? availableRoles[0] : null)
  const hasAccess = roleToCheck && allowedRoles.includes(roleToCheck)

  // Fallback seguro caso o sessionStorage (cache) esteja corrompido mas o perfil real no banco tenha o acesso
  let hasFallbackAccess = false
  if (profile) {
    hasFallbackAccess = allowedRoles.some(
      (role) =>
        (role === 'admin' && (profile.is_admin || profile.role === 'admin')) ||
        (role === 'staff' && (profile.is_staff || profile.role === 'staff')) ||
        (role === 'investor' && (profile.is_investor || profile.role === 'investor')) ||
        (role === 'borrower' && (profile.is_borrower || profile.role === 'borrower')),
    )
  }

  if (!hasAccess && !hasFallbackAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Sua conta atual não possui as permissões necessárias para visualizar este recurso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
