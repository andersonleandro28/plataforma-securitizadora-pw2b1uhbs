import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2,
  ExternalLink,
  Download,
  FileText,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface InvestmentProof {
  id: string
  investment_id: string
  file_path: string
  file_name: string
  file_size?: number | null
  uploaded_at?: string | null
}

interface InvestmentProofModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proof: InvestmentProof | null
  investment: {
    id: string
    total_value?: number
    quotas?: number
    transfer_date?: string | null
    profiles?: {
      full_name?: string
      document_number?: string
    } | null
    investment_products?: {
      title?: string
    } | null
  } | null
}

export function InvestmentProofModal({
  open,
  onOpenChange,
  proof,
  investment,
}: InvestmentProofModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !proof) {
      setSignedUrl(null)
      setLoadError(null)
      return
    }

    let isMounted = true
    const fetchSignedUrl = async () => {
      setLoadingUrl(true)
      setLoadError(null)
      try {
        const { data, error } = await supabase.storage
          .from('investment-proofs')
          .createSignedUrl(proof.file_path, 3600) // 1 hora de validade

        if (error) throw error
        if (isMounted) {
          setSignedUrl(data?.signedUrl || null)
        }
      } catch (err: any) {
        console.error('Erro ao gerar URL assinada do comprovante:', err)
        if (isMounted) {
          setLoadError(err.message || 'Não foi possível carregar o arquivo do comprovante.')
        }
      } finally {
        if (isMounted) setLoadingUrl(false)
      }
    }

    fetchSignedUrl()

    return () => {
      isMounted = false
    }
  }, [open, proof])

  if (!proof && !open) return null

  const fileNameLower = (proof?.file_name || proof?.file_path || '').toLowerCase()
  const isPdf = fileNameLower.endsWith('.pdf')
  const isImage =
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.webp') ||
    fileNameLower.endsWith('.gif')

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const handleOpenExternal = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleDownload = () => {
    if (!signedUrl) return
    const a = document.createElement('a')
    a.href = signedUrl
    a.download = proof?.file_name || 'comprovante'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isPdf ? (
              <FileText className="w-5 h-5 text-rose-500 flex-shrink-0" />
            ) : (
              <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <DialogTitle className="truncate">
              Comprovante de Depósito: {proof?.file_name || 'Comprovante'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Verificação de aporte para conferência de dados bancários antes da aprovação.
          </DialogDescription>
        </DialogHeader>

        {investment && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg border text-xs">
            <div>
              <span className="text-muted-foreground block">Investidor:</span>
              <span className="font-semibold truncate block">
                {investment.profiles?.full_name || 'N/A'}
              </span>
              {investment.profiles?.document_number && (
                <span className="text-muted-foreground font-mono">
                  {investment.profiles.document_number}
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground block">Produto:</span>
              <span className="font-medium truncate block">
                {investment.investment_products?.title || 'Debênture'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Valor do Aporte:</span>
              <span className="font-mono font-semibold text-emerald-600">
                R${' '}
                {Number(investment.total_value || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Data Declarada:</span>
              <span className="font-medium">{formatDate(investment.transfer_date)}</span>
              {proof?.uploaded_at && (
                <span className="text-[10px] text-muted-foreground block">
                  Envio: {formatDate(proof.uploaded_at)}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[360px] max-h-[58vh] overflow-auto bg-muted/20 border rounded-lg p-2 flex flex-col items-center justify-center relative">
          {loadingUrl && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm">Carregando comprovante...</span>
            </div>
          )}

          {loadError && !loadingUrl && (
            <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-medium text-destructive">{loadError}</p>
              <p className="text-xs text-muted-foreground">
                Tente novamente ou verifique se o arquivo ainda reside no bucket de armazenamento.
              </p>
            </div>
          )}

          {!loadingUrl && !loadError && signedUrl && (
            <>
              {isImage && (
                <div className="w-full h-full flex items-center justify-center p-2">
                  <img
                    src={signedUrl}
                    alt={proof?.file_name || 'Comprovante de depósito'}
                    className="max-h-[52vh] max-w-full object-contain rounded shadow-sm border bg-white"
                  />
                </div>
              )}

              {isPdf && (
                <div className="w-full h-[52vh]">
                  <iframe
                    src={`${signedUrl}#toolbar=1`}
                    title={proof?.file_name || 'Comprovante PDF'}
                    className="w-full h-full rounded border bg-white"
                  />
                </div>
              )}

              {!isImage && !isPdf && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="w-12 h-12 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">{proof?.file_name}</p>
                    {proof?.file_size && (
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(proof.file_size)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenExternal}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir Documento
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-row justify-between items-center sm:justify-between pt-3 gap-2">
          <div className="text-xs text-muted-foreground truncate max-w-[260px]">
            {proof?.file_name} {proof?.file_size ? `(${formatFileSize(proof.file_size)})` : ''}
          </div>
          <div className="flex items-center gap-2">
            {signedUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDownload}
                  title="Baixar arquivo"
                >
                  <Download className="w-4 h-4" /> Baixar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleOpenExternal}
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="w-4 h-4" /> Nova Aba
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
