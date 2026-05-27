import { ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, loading, isLoadingProfile } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/admin/products' && user) {
      console.log('Iniciando verificação de autenticação para /admin/products', user)
    }
  }, [location.pathname, user])

  if (loading || isLoadingProfile) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = profile.role === 'admin' || profile.is_admin === true

  if (location.pathname === '/admin/products' && isAdmin) {
    return <>{children}</>
  }

  const hasAllowedRole = allowedRoles.some((role) => {
    if (role === 'admin' && isAdmin) return true
    if (role === 'staff' && (profile.role === 'staff' || profile.is_staff)) return true
    if (role === 'investor' && (profile.role === 'investor' || profile.is_investor)) return true
    if (role === 'borrower' && (profile.role === 'borrower' || profile.is_borrower)) return true
    if (role === 'accountant' && (profile.role === 'accountant' || profile.is_accountant))
      return true
    return false
  })

  // Safe fallback for admins across all admin routes
  if (isAdmin && location.pathname.startsWith('/admin')) {
    return <>{children}</>
  }

  if (!hasAllowedRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
