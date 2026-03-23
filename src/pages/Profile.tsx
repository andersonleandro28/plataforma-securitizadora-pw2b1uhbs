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
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, User, Mail, Camera, Shield } from 'lucide-react'
import { AccessLogs } from '@/components/profile/AccessLogs'
import { UserBankAccounts } from '@/components/profile/UserBankAccounts'

export default function Profile() {
  const { user, profile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loadingProfileUpdate, setLoadingProfileUpdate] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

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
    } catch {
      toast.error('Erro ao atualizar foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoadingProfileUpdate(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) toast.error('Erro ao atualizar perfil.')
    else {
      toast.success('Perfil atualizado.')
      window.dispatchEvent(new Event('profile-updated'))
    }
    setLoadingProfileUpdate(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return toast.error('As senhas não coincidem.')
    setLoadingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else {
      toast.success('Senha atualizada.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoadingPassword(false)
  }

  const renderRoles = () => {
    if (!profile) return null
    const roles = []
    if (profile.is_admin) roles.push('Administrador')
    if (profile.is_staff) roles.push('Equipe Interna')
    if (profile.is_investor) roles.push('Investidor')
    if (profile.is_borrower) roles.push('Tomador')
    if (roles.length === 0) roles.push('Usuário')

    return roles.map((r) => (
      <Badge
        key={r}
        variant="outline"
        className="px-3 py-1 flex items-center gap-1.5 bg-muted/50 text-sm"
      >
        <Shield className="h-3.5 w-3.5 text-primary" /> {r}
      </Badge>
    ))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações e segurança.</p>
        </div>
        <div className="flex flex-wrap gap-2">{renderRoles()}</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Informações Pessoais
              </CardTitle>
              <CardDescription>Personalize sua conta.</CardDescription>
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
                    )}{' '}
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
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-6 bg-muted/20">
                <Button type="submit" disabled={loadingProfileUpdate}>
                  {loadingProfileUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                  Alterações
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardContent className="p-6">
              <UserBankAccounts />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-accent" /> Credenciais
              </CardTitle>
              <CardDescription>Atualize sua senha.</CardDescription>
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
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmar Nova Senha</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={loadingPassword}
                >
                  {loadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Atualizar
                  Senha
                </Button>
              </CardFooter>
            </form>
          </Card>

          <AccessLogs />
        </div>
      </div>
    </div>
  )
}
