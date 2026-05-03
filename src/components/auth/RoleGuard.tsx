import { ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, AppRole } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, activeRole, loading, isLoadingProfile, signOut } = useAuth()

  // Prioridade Absoluta: Bypass imediato para o Super Administrador
  const isSuperAdmin = user?.email === 'andersonleandro28@gmail.com'

  // Aguarda a resolução do estado de autenticação e do perfil globalmente
  // Isso evita travamentos locais e múltiplas chamadas ao banco de dados
  if (loading || isLoadingProfile) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // 1. Liberação de Fluxo: Acesso direto e sem bloqueios para super admin
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // 2. Proteção básica: usuário não autenticado
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 3. Proteção de perfil: usuário bloqueado
  if (profile?.is_blocked) {
    return (
      <RedirectWithAction
        message="Seu acesso à plataforma foi temporariamente suspenso."
        to="/login"
        action={signOut}
      />
    )
  }

  // 4. O usuário deve ter um papel ativo definido pelo contexto global
  if (!activeRole) {
    return <Navigate to="/" replace />
  }

  // 5. Validação final: o papel ativo atual possui acesso à rota?
  if (!allowedRoles.includes(activeRole)) {
    return (
      <RedirectWithAction
        message="Você não tem permissão para acessar esta área. Redirecionando para seu dashboard..."
        to="/"
      />
    )
  }

  return <>{children}</>
}

// Utilitário para exibir Toast de erro e redirecionar, opcionalmente executando uma ação extra (ex: signOut)
function RedirectWithAction({
  message,
  to,
  action,
}: {
  message: string
  to: string
  action?: () => void
}) {
  useEffect(() => {
    toast.error(message)
    if (action) {
      action()
    }
  }, [message, action])

  return <Navigate to={to} replace />
}
