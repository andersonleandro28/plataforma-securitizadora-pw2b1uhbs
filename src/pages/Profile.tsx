import { useState, useEffect, useRef } from 'react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, User, Mail, Camera } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AccessLogs } from '@/components/profile/AccessLogs'

function ProfileContent() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()
        if (data) {
          setFullName(data.full_name || '')
          setAvatarUrl(data.avatar_url || '')
        }
      }
      setLoadingInit(false)
    }
    loadProfile()
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/avatar_${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

      setAvatarUrl(publicUrl)
      toast.success('Foto de perfil atualizada.')
      window.dispatchEvent(new Event('profile-updated'))
    } catch (error) {
      toast.error('Erro ao atualizar foto de perfil.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoadingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) toast.error('Erro ao atualizar perfil.')
    else {
      toast.success('Perfil atualizado com sucesso.')
      window.dispatchEvent(new Event('profile-updated'))
    }
    setLoadingProfile(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return toast.error('As senhas não coincidem.')
    if (newPassword.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.')

    setLoadingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message || 'Erro ao atualizar senha.')
    else {
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
        <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Informações Pessoais
            </CardTitle>
            <CardDescription>Personalize sua conta com foto e nome.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="flex flex-col sm:flex-row gap-8">
              <div className="flex flex-col items-center gap-4 sm:border-r sm:pr-8">
                <Avatar className="h-28 w-28 border-2 shadow-sm">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-3xl bg-muted">
                    {fullName.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Alterar Foto
                </Button>
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" /> Email de Acesso
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
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-6 bg-muted/20">
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
              <Lock className="h-5 w-5 text-accent" /> Credenciais
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

        <div className="md:col-span-1">
          <AccessLogs />
        </div>
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
