import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface GetOrGenerateContractOptions {
  investmentId: string
  existingUrl?: string | null
  forceRegenerate?: boolean
  sendEmail?: boolean
  openInNewTab?: boolean
}

/**
 * Obtém ou regenera de forma idempotente o contrato/termo de subscrição de debêntures em PDF.
 * Se já existir `contract_url` e `forceRegenerate` não for verdadeiro, abre/retorna imediatamente.
 * Caso contrário, invoca a Edge Function `generate-subscription-term` para emitir o PDF oficial.
 */
export async function getOrGenerateSubscriptionContract({
  investmentId,
  existingUrl,
  forceRegenerate = false,
  sendEmail = false,
  openInNewTab = true,
}: GetOrGenerateContractOptions): Promise<string> {
  if (!investmentId) {
    throw new Error('ID do investimento é obrigatório.')
  }

  // Se já possui URL e não foi solicitado recálculo forçado, abre diretamente
  if (existingUrl && !forceRegenerate) {
    if (openInNewTab && typeof window !== 'undefined') {
      window.open(existingUrl, '_blank', 'noopener,noreferrer')
    }
    return existingUrl
  }

  const dismissToast = toast.loading('Gerando Contrato de Subscrição de Debêntures em PDF...')

  try {
    const { data, error } = await supabase.functions.invoke('generate-subscription-term', {
      body: {
        investmentId,
        forceRegenerate,
        sendEmail,
        ipAddress: 'Acesso autenticado via plataforma',
      },
    })

    if (error) {
      throw new Error(error.message || 'Falha ao gerar contrato.')
    }

    if (!data?.url) {
      throw new Error(data?.error || 'URL do contrato não foi retornada.')
    }

    toast.dismiss(dismissToast)
    toast.success('Contrato de Subscrição gerado com sucesso!')

    if (openInNewTab && typeof window !== 'undefined') {
      window.open(data.url, '_blank', 'noopener,noreferrer')
    }

    return data.url
  } catch (err: any) {
    toast.dismiss(dismissToast)
    console.error('Erro ao gerar contrato de debênture:', err)
    toast.error(err.message || 'Erro ao emitir documento do contrato.')
    throw err
  }
}
