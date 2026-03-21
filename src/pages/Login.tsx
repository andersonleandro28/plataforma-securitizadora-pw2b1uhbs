import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const from = location.state?.from || '/'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setAuthLoading(true)

    try {
      const result = await signIn(email, password)

      if (result?.error) {
        toast.error(result.error.message || 'Erro ao fazer login. Verifique suas credenciais.')
      } else {
        toast.success('Login realizado com sucesso!')
        navigate(from, { replace: true })
      }
    } catch (error: any) {
      toast.error('Ocorreu um erro inesperado ao tentar fazer login. Tente novamente.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10 animate-fade-in-up">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto text-primary-foreground shadow-sm">
            <LogIn className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Entrar</CardTitle>
            <CardDescription className="mt-1">
              Acesse sua conta na Plataforma Securitizadora.
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full" size="lg" disabled={authLoading}>
              {authLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
              Entrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/signup">Ainda não tem conta? Cadastre-se</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
