import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { activeRole, loading } = useAuth()
  const [isSafeToRender, setIsSafeToRender] = useState(false)

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

  if (loading || !isSafeToRender) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
