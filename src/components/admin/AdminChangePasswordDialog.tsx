import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export function AdminChangePasswordDialog({ user, open, onOpenChange }: any) {
  const { session } = useAuth()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (password.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.')
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: { targetUserId: user.id, action: 'change_password', payload: { password } },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (error || data?.error) throw new Error(data?.error || 'Erro ao redefinir senha')

      toast.success('Senha redefinida com sucesso. O usuário precisará alterá-la no próximo login.')
      onOpenChange(false)
      setPassword('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir Senha de Acesso</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para <strong>{user?.full_name || user?.email}</strong>. O usuário
            será forçado a atualizá-la no próximo acesso por segurança.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nova Senha Temporária</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar e Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
