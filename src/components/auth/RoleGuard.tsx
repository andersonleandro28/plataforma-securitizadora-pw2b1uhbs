import { ReactNode } from 'react'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2, ShieldAlert } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, availableRoles, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando permissões...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in duration-300">
        <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Perfil Incompleto</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Não foi possível carregar as informações do seu perfil. Verifique sua conexão ou contate o
          suporte.
        </p>
      </div>
    )
  }

  const roleToCheck =
    activeRole || (availableRoles && availableRoles.length > 0 ? availableRoles[0] : null)
  const hasAccess = roleToCheck && allowedRoles.includes(roleToCheck)

  const hasFallbackAccess = allowedRoles.some(
    (role) =>
      (role === 'admin' && (profile.is_admin || profile.role === 'admin')) ||
      (role === 'staff' && (profile.is_staff || profile.role === 'staff')) ||
      (role === 'investor' && (profile.is_investor || profile.role === 'investor')) ||
      (role === 'borrower' && (profile.is_borrower || profile.role === 'borrower')),
  )

  if (!hasAccess && !hasFallbackAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in duration-300">
        <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você não tem as permissões necessárias para visualizar esta página. Seu perfil atual não
          permite acesso a este recurso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
