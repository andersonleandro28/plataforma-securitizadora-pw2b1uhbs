import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: Array<'admin' | 'investor' | 'borrower' | 'staff'>
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Redirecionamento Inteligente: Tratamento de erro quando perfil falha ao carregar
    // Pode indicar sessão ou refresh token inválido que não disparou o evento de logout principal.
    // Garante que a sessão corrompida seja encerrada e o usuário não fique preso em uma tela de erro em branco.
    if (!loading && user && !profile) {
      signOut().then(() => {
        navigate('/signup', { replace: true })
      })
    }
  }, [loading, user, profile, signOut, navigate])

  if (loading) return null

  // Impede renderização da tela de erro de acesso enquanto o componente estiver redirecionando devido a sessão corrompida
  if (user && !profile) return null

  if (!profile || !allowedRoles.includes(profile.role)) {
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
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
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
