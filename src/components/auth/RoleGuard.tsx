import { ReactNode, useEffect, useState, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { activeRole, loading, user, signOut } = useAuth()
  const [isSafeToRender, setIsSafeToRender] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const lastValidatedPath = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    const initializeSafeEnvironment = async () => {
      try {
        // Hard-Isolation for Web3 Providers to prevent runtime crashes (MetaMask fix)
        // This encapsulates any extension errors from crashing the React runtime.
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const provider = (window as any).ethereum

          // Force-Sync approach: adaptative timeout before letting the component render
          await Promise.race([
            provider.request({ method: 'eth_accounts' }).catch(() => {}), // Ignore internal provider errors
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Provider timeout')), 800),
            ),
          ])
        }
      } catch (error) {
        // Swallow low-level extension errors silently
        console.debug('Web3 Provider check safely ignored:', error)
      } finally {
        if (mounted) {
          setIsSafeToRender(true)
        }
      }
    }

    initializeSafeEnvironment()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const validatePermissions = async () => {
      if (!user) return

      // Skip if we already validated this exact path and we are not forcing it
      if (lastValidatedPath.current === location.pathname) {
        return
      }

      setIsValidating(true)

      try {
        const isSuperAdmin = user.email === 'andersonleandro28@gmail.com'

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, is_admin, is_staff, is_accountant, is_investor, is_borrower, is_blocked')
          .eq('id', user.id)
          .maybeSingle()

        if ((error || !profile) && !isSuperAdmin) {
          if (mounted) {
            toast.error('Suas permissões foram alteradas. Faça login novamente.')
            await signOut()
            navigate('/login', { replace: true })
          }
          return
        }

        if (profile?.is_blocked && !isSuperAdmin) {
          if (mounted) {
            toast.error('Seu acesso à plataforma foi temporariamente suspenso.')
            await signOut()
            navigate('/login', { replace: true })
          }
          return
        }

        const roles: AppRole[] = []

        const isAdmin = profile?.is_admin || profile?.role === 'admin' || isSuperAdmin
        const isStaff = profile?.is_staff || profile?.role === 'staff'
        const isAccountant =
          profile?.is_accountant || profile?.role === 'accountant' || isSuperAdmin

        if (isAdmin) roles.push('admin')
        if (isStaff) roles.push('staff')
        if (isAccountant) roles.push('accountant')
        if (profile?.is_investor || profile?.role === 'investor' || isAdmin || isStaff)
          roles.push('investor')
        if (profile?.is_borrower || profile?.role === 'borrower' || isAdmin || isStaff)
          roles.push('borrower')

        // If the current active role is no longer in the user's valid roles
        if (activeRole && !roles.includes(activeRole) && !isSuperAdmin) {
          if (mounted) {
            toast.error(
              'Você não tem permissão para acessar esta área. Redirecionando para seu dashboard...',
            )

            if (roles.length > 0) {
              const fallbackRole = roles.includes('admin')
                ? 'admin'
                : roles.includes('staff')
                  ? 'staff'
                  : roles[0]
              sessionStorage.setItem('activeRole', fallbackRole)
              window.location.href = '/'
            } else {
              await signOut()
              navigate('/login', { replace: true })
            }
          }
          return
        }

        if (mounted) {
          lastValidatedPath.current = location.pathname
        }
      } catch (err) {
        console.error('Validation error:', err)
      } finally {
        if (mounted) {
          setIsValidating(false)
        }
      }
    }

    if (isSafeToRender && !loading && user) {
      validatePermissions()
    }

    return () => {
      mounted = false
    }
  }, [location.pathname, user, isSafeToRender, loading, activeRole, signOut, navigate])

  if (loading || !isSafeToRender || isValidating) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isSuperAdmin = user?.email === 'andersonleandro28@gmail.com'

  if (!activeRole && !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  if (activeRole && !allowedRoles.includes(activeRole) && !isSuperAdmin) {
    return <RedirectWithToast />
  }

  return <>{children}</>
}

function RedirectWithToast() {
  useEffect(() => {
    toast.error(
      'Você não tem permissão para acessar esta área. Redirecionando para seu dashboard...',
    )
  }, [])
  return <Navigate to="/" replace />
}
