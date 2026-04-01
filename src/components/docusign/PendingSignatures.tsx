import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileSignature, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

export function PendingSignatures() {
  const { user, profile } = useAuth()
  const [pendingOps, setPendingOps] = useState<any[]>([])
  const [kycUrl, setKycUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // Handler para simulação do DocuSign na ausência de chaves de Sandbox
  useEffect(() => {
    const mockDocuSign = searchParams.get('docusign_mock')
    const envId = searchParams.get('envelopeId')

    if (mockDocuSign === 'true' && envId) {
      toast.loading('Processando assinatura embutida (Sandbox)...', { id: 'docusign-mock' })

      // Simula a chegada do webhook do DocuSign de que o documento foi assinado
      supabase.functions
        .invoke('docusign-callback', {
          body: { envelope_id: envId, status: 'assinado' },
        })
        .then(({ error }) => {
          if (!error) {
            toast.success('Documento assinado com sucesso!', { id: 'docusign-mock' })

            // Limpa a URL
            searchParams.delete('docusign_mock')
            searchParams.delete('envelopeId')
            setSearchParams(searchParams, { replace: true })

            // Força refresh local
            window.dispatchEvent(new Event('profile-updated'))
          } else {
            toast.error('Erro ao simular assinatura.', { id: 'docusign-mock' })
          }
        })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!user || !profile) return

    let needsSigning = false

    if (profile.kyc_signature_status === 'enviado' && profile.kyc_signature_url) {
      setKycUrl(profile.kyc_signature_url)
      needsSigning = true
    } else {
      setKycUrl(null)
    }

    const fetchOps = async () => {
      const { data } = await supabase
        .from('credit_operations')
        .select('id, signature_url')
        .eq('borrower_id', user.id)
        .eq('signature_status', 'enviado')
        .not('signature_url', 'is', null)

      if (data && data.length > 0) {
        setPendingOps(data)
        needsSigning = true
      } else {
        setPendingOps([])
      }
      setOpen(needsSigning)
    }

    fetchOps()

    const listener = () => fetchOps()
    window.addEventListener('profile-updated', listener)
    return () => window.removeEventListener('profile-updated', listener)
  }, [user, profile])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Assinatura Eletrônica Pendente
          </DialogTitle>
          <DialogDescription>
            Você possui documentos aguardando sua assinatura eletrônica via DocuSign.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {kycUrl && (
            <div className="p-4 border rounded-lg bg-muted/30 flex flex-col gap-3">
              <div>
                <h4 className="font-medium text-sm">Dossiê de Conformidade (KYC)</h4>
                <p className="text-xs text-muted-foreground">
                  Assine seu dossiê de cadastro para liberar todas as funcionalidades.
                </p>
              </div>
              <Button className="w-full gap-2" onClick={() => (window.location.href = kycUrl)}>
                <ExternalLink className="w-4 h-4" /> Assinar Documento
              </Button>
            </div>
          )}
          {pendingOps.map((op) => (
            <div key={op.id} className="p-4 border rounded-lg bg-muted/30 flex flex-col gap-3">
              <div>
                <h4 className="font-medium text-sm">Aditivo de Cessão de Crédito</h4>
                <p className="text-xs text-muted-foreground">
                  Operação #{op.id.split('-')[0].toUpperCase()}
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => (window.location.href = op.signature_url)}
              >
                <ExternalLink className="w-4 h-4" /> Assinar Aditivo
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Lembrar depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
