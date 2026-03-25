import { ReactNode, useEffect } from 'react'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2, ShieldAlert } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, loading } = useAuth()

  // Intervenção cirúrgica para isolar erros de runtime da MetaMask (conforme histórico de suporte)
  useEffect(() => {
    // 1. Protocolo de Blindagem Externa / Segregação de Erros
    const suppressMetaMaskErrors = (event: any) => {
      try {
        const err = event.reason || event.error || event
        const errStr = String(err?.message || err || '').toLowerCase()
        const stackStr = String(err?.stack || '').toLowerCase()

        if (
          errStr.includes('metamask') ||
          stackStr.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
          errStr.includes('failed to connect') ||
          stackStr.includes('inpage.js') ||
          errStr.includes('eth_requestaccounts')
        ) {
          event.preventDefault()
          event.stopPropagation()
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation()
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Adiciona os listeners na fase de captura (true) para interceptar antes de crashar o React
    window.addEventListener('unhandledrejection', suppressMetaMaskErrors, true)
    window.addEventListener('error', suppressMetaMaskErrors, true)

    // 2. Abordagem de "Safe-Wrapper" / "Force-Sync"
    const initWeb3Safe = async () => {
      try {
        const eth = (window as any).ethereum
        // Validação de Estado de Provedor (Pre-flight check)
        if (eth && typeof eth.request === 'function') {
          // Captura de forma silenciosa ("Silent Fallback") qualquer erro de inicialização.
          // Dispara apenas um comando passivo para garantir a sincronia sem forçar pop-up.
          await eth.request({ method: 'eth_chainId' }).catch(() => {
            /* silent fallback */
          })
        }
      } catch (e) {
        // Erro completamente isolado
      }
    }

    // Timeout adaptativo para lidar com a injeção atrasada da extensão (Race Condition)
    const timer = setTimeout(() => {
      initWeb3Safe()
    }, 300)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('unhandledrejection', suppressMetaMaskErrors, true)
      window.removeEventListener('error', suppressMetaMaskErrors, true)
    }
  }, [])

  // 1. PASSE LIVRE ABSOLUTO E IMEDIATO PARA SUPER ADMIN
  // Ignora completamente qualquer estado de "loading" ou banco de dados se o usuário já estiver identificado
  if (user?.email === 'andersonleandro28@gmail.com') {
    return <>{children}</>
  }

  // 2. Avaliação de carregamento para usuários normais (admins já passaram direto acima)
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

  // 3. Avaliação síncrona e direta das permissões baseada apenas no papel ativamente selecionado
  const roleToCheck = activeRole
  const hasAccess = roleToCheck && allowedRoles.includes(roleToCheck)

  // Fallback seguro caso o sessionStorage (cache) esteja corrompido mas o perfil real no banco tenha o acesso
  let hasFallbackAccess = false
  if (profile && !roleToCheck) {
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
