import { ReactNode, useEffect, useState } from 'react'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2, ShieldAlert } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, availableRoles, loading } = useAuth()
  const [isVerifying, setIsVerifying] = useState(true)

  // Ensure we have a small buffer to let the auth context settle completely
  // Eliminating premature loading states that could block navigation
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsVerifying(false), 400)
      return () => clearTimeout(timer)
    } else {
      setIsVerifying(true)
    }
  }, [loading])

  if (loading || isVerifying) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Verificando permissões de acesso...
        </p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isSuperAdmin = user.email === 'andersonleandro28@gmail.com'

  if (!profile && !isSuperAdmin) {
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

  if (!hasAccess && !hasFallbackAccess && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in duration-300">
        <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Seu perfil atual ({roleToCheck || profile?.role || 'não definido'}) não possui as
          permissões necessárias para visualizar este recurso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
