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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)

  if (loading) {
    return (
      <div className="flex justify-center p-12">
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
    <div className="max-w-md mx-auto mt-20 animate-fade-in-up">
      <Card>
        <CardHeader>
          <CardTitle>{isLogin ? 'Acesso Restrito' : 'Criar Conta'}</CardTitle>
          <CardDescription>
            {isLogin
              ? 'Faça login para acessar o painel do Trustee.'
              : 'Cadastre-se para acessar a plataforma.'}
          </CardDescription>
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={authLoading}>
              {authLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLogin ? 'Entrar' : 'Cadastrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
            </Button>
            {isLogin && (
              <div className="text-xs text-center text-muted-foreground mt-4">
                Dica para testes: <b>test@example.com</b> / <b>password123</b>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
