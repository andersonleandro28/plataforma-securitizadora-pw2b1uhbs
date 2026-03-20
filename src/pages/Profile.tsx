import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, User, Mail } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'

function ProfileContent() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (data && data.full_name) {
          setFullName(data.full_name)
        }
      }
      setLoadingInit(false)
    }
    loadProfile()
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoadingProfile(true)
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      toast.error('Erro ao atualizar perfil.')
    } else {
      toast.success('Perfil atualizado com sucesso.')
    }
    setLoadingProfile(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      return toast.error('As senhas não coincidem.')
    }
    if (newPassword.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres.')
    }
    setLoadingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error(error.message || 'Erro ao atualizar senha.')
    } else {
      toast.success('Senha atualizada com sucesso.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoadingPassword(false)
  }

  if (loadingInit) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e credenciais.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Informações Pessoais
            </CardTitle>
            <CardDescription>Atualize seu nome de exibição.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email
                </label>
                <Input value={user?.email || ''} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Completo</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loadingProfile}>
                {loadingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" /> Segurança
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nova Senha</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="******"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmar Nova Senha</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="******"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="secondary" disabled={loadingPassword}>
                {loadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Senha
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function Profile() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  )
}
