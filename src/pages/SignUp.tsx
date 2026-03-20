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
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Link, useNavigate, Navigate } from 'react-router-dom'

export default function SignUp() {
  const { user, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      return toast.error('As senhas não coincidem.')
    }
    if (password.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres.')
    }

    setAuthLoading(true)

    try {
      const result = await signUp(email, password, name)

      if (result?.error) {
        const errorMessage = result.error.message?.toLowerCase() || ''
        const isRateLimit =
          errorMessage.includes('rate limit') ||
          (result.error as any).status === 429 ||
          (result.error as any).code === 'over_email_send_rate_limit'

        if (isRateLimit) {
          toast.error(
            'Muitas tentativas de cadastro em curto período. Por favor, aguarde alguns instantes e tente novamente.',
          )
        } else {
          toast.error(result.error.message || 'Erro ao criar conta')
        }
      } else {
        toast.success('Conta criada com sucesso! Você já pode acessar a plataforma.')
        navigate('/')
      }
    } catch (error: any) {
      // Evitando console.error para não acionar overlays de erro de ambiente
      const errorMessage = error?.message?.toLowerCase() || ''
      const isRateLimit =
        errorMessage.includes('rate limit') || errorMessage.includes('429') || error?.status === 429

      if (isRateLimit) {
        toast.error(
          'Muitas tentativas de cadastro em curto período. Por favor, aguarde alguns instantes e tente novamente.',
        )
      } else {
        toast.error(
          'Ocorreu um erro inesperado ao tentar criar a conta. Tente novamente mais tarde.',
        )
      }
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10 animate-fade-in-up">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto text-primary-foreground shadow-sm">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Criar Conta</CardTitle>
            <CardDescription className="mt-1">
              Cadastre-se para acessar a Plataforma Securitizadora.
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo</label>
              <Input
                type="text"
                placeholder="João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
              />
            </div>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full" size="lg" disabled={authLoading}>
              {authLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
              Cadastrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/">Já tem conta? Entre no sistema</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
