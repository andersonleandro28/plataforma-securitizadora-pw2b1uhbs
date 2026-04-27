import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'

export function ForceChangePassword() {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // If user is authenticated and force_password_change is true, force the modal open
    if (user && profile?.force_password_change) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [user, profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      // 1. Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      // 2. Clear the flag in the profiles table
      if (profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('id', profile.id)

        if (profileError) throw profileError
      }

      setOpen(false)
      setPassword('')
      setConfirmPassword('')
      // We manually dispatch an event to refresh the profile in use-auth
      window.dispatchEvent(new CustomEvent('profile-updated'))
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  // Use a custom event to prevent closing by clicking outside or pressing Escape
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        // Force it to remain open if still required
        if (profile?.force_password_change) setOpen(true)
      }}
    >
      <DialogContent
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            Alteração de Senha Obrigatória
          </DialogTitle>
          <DialogDescription>
            Sua senha foi redefinida pelo administrador. Por motivos de segurança, você precisa
            definir uma nova senha para continuar acessando a plataforma.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input
              id="new-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar e Acessar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
