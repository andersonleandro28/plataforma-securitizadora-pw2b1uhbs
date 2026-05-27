import React, { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { AppRole, useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, loading, isLoadingProfile } = useAuth()

  console.log('[DEBUG] Iniciando autenticação/verificação de RoleGuard', {
    user: user?.id,
    activeRole,
    allowedRoles,
    isAdmin: profile?.is_admin || profile?.role === 'admin',
  })

  if (loading || isLoadingProfile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Admin users have immediate and unblocked access to any protected route
  if (profile?.is_admin || profile?.role === 'admin' || activeRole === 'admin') {
    return <>{children}</>
  }

  if (activeRole && allowedRoles.includes(activeRole)) {
    return <>{children}</>
  }

  return <Navigate to="/" replace />
}
