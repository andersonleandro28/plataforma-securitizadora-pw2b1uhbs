import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import useSecurityStore from '@/stores/useSecurityStore'
import { toast } from 'sonner'

export function GlobalSecurityModal() {
  const { user } = useAuth()
  const { isOpen, actionDescription, onSuccess, onCancel, close } = useSecurityStore()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!password) {
      toast.error('Por favor, digite sua senha.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: password,
      })

      if (error || !data.user) {
        toast.error('Acesso Negado: Senha Master inválida')
        setLoading(false)
        return
      }

      const logMessage = `O Administrador Master autorizou a ação: ${actionDescription} em ${new Date().toLocaleString('pt-BR')}`

      await supabase.from('audit_logs').insert({
        entity_type: 'security_validation',
        entity_id: user?.id,
        action: 'master_password_validated',
        details: { message: logMessage },
      })

      setPassword('')
      setLoading(false)
      close()

      if (onSuccess) onSuccess()
    } catch (err) {
      toast.error('Erro ao validar senha.')
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setPassword('')
    close()
    if (onCancel) onCancel()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
    >
      <DialogContent
        className="sm:max-w-[425px] border-destructive/20 shadow-lg shadow-destructive/10 z-[3000]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" /> Confirmação de Segurança Requerida
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm">
            Você está prestes a realizar uma ação restrita no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md flex items-start gap-3 text-sm">
            <Lock className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
            <p className="text-destructive-foreground font-medium leading-tight">
              Ação: <span className="font-bold text-destructive">{actionDescription}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="master-password">Senha Master</Label>
            <Input
              id="master-password"
              type="password"
              placeholder="Digite a senha master para autorizar..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm()
              }}
              autoFocus
              className="border-destructive/30 focus-visible:ring-destructive"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Autorizar Ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
