import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ShieldAlert, Loader2 } from 'lucide-react'

export function ForceChangePassword() {
  const { profile, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile?.requires_password_change) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [profile])

  const handleSubmit = async () => {
    if (password.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error('Erro ao atualizar senha.')
    } else {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ requires_password_change: false })
        .eq('id', user!.id)
      if (!profileError) {
        toast.success('Senha atualizada com sucesso!')
        setOpen(false)
        window.dispatchEvent(new Event('profile-updated'))
      }
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[400px] [&>button]:hidden pointer-events-none"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" />
            Atualização de Segurança Obrigatória
          </DialogTitle>
          <DialogDescription>
            Como este é seu primeiro acesso com a senha padrão (gerada automaticamente pelo seu
            CPF), você precisa definir uma nova senha segura para continuar utilizando a plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 pointer-events-auto">
          <Input
            type="password"
            placeholder="Digite sua nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={loading || password.length < 6}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Nova Senha e Acessar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
