import { supabase } from '@/lib/supabase/client'
import {
  downloadContractAsBlob,
  extractFilePathFromContractUrl,
  safeOpenOrDownload,
  triggerFileDownload,
} from './subscription-contract'
import { toast } from 'sonner'

export interface GetOrGenerateCautelaOptions {
  investmentId: string
  existingUrl?: string | null
  forceRegenerate?: boolean
  openInNewTab?: boolean
  downloadDirectly?: boolean
  ipAddress?: string
}

const BUCKET_NAME = 'investment-docs'

/**
 * Obtém ou regenera de forma idempotente a Cautela de Debêntures em PDF.
 *
 * Utiliza o mesmo padrão resiliente do Termo de Subscrição:
 * - Download em Blob autenticado para imunidade contra bloqueadores de anúncios (ERR_BLOCKED_BY_CLIENT)
 * - Safe opening / direct download
 * - Chamada à Edge Function 'generate-debenture-cautela' sob demanda
 */
export async function getOrGenerateDebentureCautela({
  investmentId,
  existingUrl,
  forceRegenerate = false,
  openInNewTab = true,
  downloadDirectly = false,
  ipAddress,
}: GetOrGenerateCautelaOptions): Promise<string> {
  if (!investmentId) {
    throw new Error('ID do investimento é obrigatório.')
  }

  const defaultFileName = `Cautela_Debentures_${investmentId.substring(0, 8)}.pdf`

  // 1. Se já possui existingUrl e não for regeneração forçada, tentar baixar do bucket diretamente
  if (existingUrl && !forceRegenerate) {
    const filePath = extractFilePathFromContractUrl(existingUrl, investmentId)

    if (filePath) {
      // Tentativa 1: Baixar como Blob no cliente (100% imune a adblockers)
      const blobResult = await downloadContractAsBlob(filePath)
      if (blobResult) {
        if (downloadDirectly) {
          triggerFileDownload(blobResult.blob, defaultFileName)
          toast.success('Download da Cautela de Debêntures concluído!')
        } else if (openInNewTab) {
          safeOpenOrDownload(blobResult.objectUrl, defaultFileName)
        }
        return blobResult.objectUrl
      }

      // Tentativa 2: Gerar signedUrl pelo cliente Supabase do runtime
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 3600)

      if (!signedErr && signedData?.signedUrl) {
        if (downloadDirectly) {
          triggerFileDownload(signedData.signedUrl, defaultFileName)
        } else if (openInNewTab) {
          safeOpenOrDownload(signedData.signedUrl, defaultFileName)
        }
        return signedData.signedUrl
      }

      // Tentativa 3: Se o bucket for público
      const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
      if (publicData?.publicUrl) {
        if (downloadDirectly) {
          triggerFileDownload(publicData.publicUrl, defaultFileName)
        } else if (openInNewTab) {
          safeOpenOrDownload(publicData.publicUrl, defaultFileName)
        }
        return publicData.publicUrl
      }
    }
  }

  // 2. Se não existir URL ou o download prévio falhou, invoca a Edge Function geradora
  const dismissToast = toast.loading('Gerando Cautela de Debêntures em PDF...')

  try {
    const { data, error } = await supabase.functions.invoke('generate-debenture-cautela', {
      body: {
        investmentId,
        forceRegenerate,
        ipAddress: ipAddress || 'Acesso autenticado via plataforma',
      },
    })

    if (error) {
      throw new Error(error.message || 'Falha ao gerar cautela de debêntures.')
    }

    if (!data?.url && !data?.filePath) {
      throw new Error(data?.error || 'URL da cautela não foi retornada.')
    }

    toast.dismiss(dismissToast)
    toast.success('Cautela de Debêntures emitida com sucesso!')

    const targetPath = data.filePath || extractFilePathFromContractUrl(data.url, investmentId)

    // Se temos o path, preferir abrir via Blob local
    if (targetPath) {
      const blobResult = await downloadContractAsBlob(targetPath)
      if (blobResult) {
        if (downloadDirectly) {
          triggerFileDownload(blobResult.blob, defaultFileName)
        } else if (openInNewTab) {
          safeOpenOrDownload(blobResult.objectUrl, defaultFileName)
        }
        return blobResult.objectUrl
      }
    }

    // Fallback: usar a URL retornada (seja signed ou pública)
    const finalUrl = data.signedUrl || data.url
    if (downloadDirectly) {
      triggerFileDownload(finalUrl, defaultFileName)
    } else if (openInNewTab) {
      safeOpenOrDownload(finalUrl, defaultFileName)
    }

    return finalUrl
  } catch (err: any) {
    toast.dismiss(dismissToast)
    console.error('Erro ao gerar/abrir cautela de debêntures:', err)
    toast.error(err.message || 'Erro ao emitir documento da cautela.')
    throw err
  }
}
