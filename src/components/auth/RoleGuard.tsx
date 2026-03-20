import { useAuth, AppRole } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: AppRole[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, loading, activeRole } = useAuth()
  const navigate = useNavigate()

  if (loading) return null

  if (user && !profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-sm animate-fade-in-up border-warning/20">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
            </div>
            <CardTitle>Configurando seu acesso</CardTitle>
            <CardDescription>
              Seu perfil está sendo preparado pelo nosso sistema. Isso pode levar alguns instantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <Button onClick={() => window.location.reload()} variant="outline">
              Atualizar Página
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) return null

  const hasAccess = activeRole && allowedRoles.includes(activeRole)

  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/20 shadow-sm animate-fade-in-up">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página com o perfil selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
