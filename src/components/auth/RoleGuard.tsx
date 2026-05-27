import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { ReactNode } from 'react'

interface RoleGuardProps {
  allowedRoles: AppRole[]
  children: ReactNode
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, activeRole, isLoadingProfile } = useAuth()
  const location = useLocation()

  // Hard Bypass for Super Admin
  const isSuperAdmin = user?.email === 'andersonleandro28@gmail.com'

  if (isLoadingProfile && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando permissões...</p>
      </div>
    )
  }

  if (isSuperAdmin) {
    return <>{children}</>
  }

  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <>{children}</>
}
