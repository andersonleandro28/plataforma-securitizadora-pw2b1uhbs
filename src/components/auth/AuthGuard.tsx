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
import { Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  if (user) return <>{children}</>

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    const result = isLogin ? await signIn(email, password) : await signUp(email, password)

    if (result?.error) {
      toast.error(result.error.message || 'Erro na autenticação')
    } else if (!isLogin) {
      toast.success('Conta criada com sucesso.')
    }
    setAuthLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10 animate-fade-in-up">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto text-primary-foreground shadow-sm">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Plataforma Securitizadora
            </CardTitle>
            <CardDescription className="mt-1">
              {isLogin
                ? 'Acesse o sistema restrito com suas credenciais.'
                : 'Cadastre-se para acessar a plataforma.'}
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
              {isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
            </Button>
            {isLogin && (
              <div className="text-xs text-center text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                <p className="font-medium mb-1 text-foreground/80">
                  Credenciais de Acesso (Admin):
                </p>
                <p className="font-mono">andersonleandro28@gmail.com</p>
                <p className="font-mono">1941Pai@#$130598</p>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
