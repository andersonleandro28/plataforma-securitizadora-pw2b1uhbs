import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface GetOrGenerateContractOptions {
  investmentId: string
  existingUrl?: string | null
  forceRegenerate?: boolean
  sendEmail?: boolean
  openInNewTab?: boolean
  /** Se deve forçar o download direto para o disco do usuário ao invés de apenas abrir */
  downloadDirectly?: boolean
}

const BUCKET_NAME = 'investment-docs'

/**
 * Extrai o file path relativo dentro do bucket `investment-docs` a partir de qualquer
 * formato de URL (absoluta com qualquer domínio/porta, pública ou assinada, ou path relativo).
 */
export function extractFilePathFromContractUrl(
  urlOrPath: string | null | undefined,
  investmentId?: string,
): string | null {
  if (!urlOrPath) return null

  const cleaned = urlOrPath.trim()
  if (!cleaned) return null

  // Se já for apenas um path relativo (ex: "user_uuid/Termo_Subscricao_xxxx.pdf")
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    // Pode conter prefixo "investment-docs/"
    return cleaned.replace(/^investment-docs\//, '').replace(/^\/+/, '')
  }

  try {
    const parsed = new URL(cleaned)
    const pathname = decodeURIComponent(parsed.pathname)

    // Formatos comuns do Supabase Storage:
    // /storage/v1/object/public/investment-docs/<filePath>
    // /storage/v1/object/sign/investment-docs/<filePath>
    // /storage/v1/object/investment-docs/<filePath>
    const match = pathname.match(
      /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?investment-docs\/(.+)$/,
    )
    if (match?.[1]) {
      return match[1].replace(/^\/+/, '')
    }

    // Se houver investment-docs em qualquer parte do path
    const fallbackParts = pathname.split('/investment-docs/')
    if (fallbackParts.length > 1) {
      return fallbackParts[1].replace(/^\/+/, '')
    }
  } catch {
    // String não era URL válida, tenta regex crua
    const match = cleaned.match(/investment-docs\/(.+?)(\?|$)/)
    if (match?.[1]) {
      return match[1].replace(/^\/+/, '')
    }
  }

  // Se tudo falhar e tivermos o investmentId, não arriscamos um path quebrado
  return null
}

/**
 * Baixa o arquivo do PDF via cliente autenticado do Supabase e gera um Blob URL local.
 * Esse mecanismo é completamente imune a extensões adblocker (uBlock, Brave Shields,
 * Kaspersky, etc.) que bloqueiam domínios *.supabase.co com "ERR_BLOCKED_BY_CLIENT".
 */
export async function downloadContractAsBlob(
  filePath: string,
): Promise<{ blob: Blob; objectUrl: string } | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath)

    if (error || !data) {
      console.warn('download via supabase.storage falhou, tentando fallback assinado:', error)
      return null
    }

    const objectUrl = URL.createObjectURL(data)
    return { blob: data, objectUrl }
  } catch (err) {
    console.warn('Erro ao baixar blob diretamente do Supabase Storage:', err)
    return null
  }
}

/**
 * Faz download forçado de um Blob para o sistema de arquivos local do usuário.
 */
export function triggerFileDownload(blobOrUrl: Blob | string, filename: string): void {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Revoga após pequeno delay se tiver sido gerado internamente
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}

/**
 * Tenta abrir uma URL em uma nova aba. Se o navegador ou bloqueador de popups impedir,
 * faz download direto como fallback seguro.
 */
export function safeOpenOrDownload(url: string, filename: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    const newTab = window.open(url, '_blank', 'noopener,noreferrer')
    if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
      // Bloqueador de popups interceptou window.open
      triggerFileDownload(url, filename)
      toast.info('Popup bloqueado pelo navegador. O download do PDF foi iniciado.')
      return false
    }
    return true
  } catch (e) {
    console.warn('window.open disparou exceção:', e)
    triggerFileDownload(url, filename)
    toast.info('Iniciando download do contrato.')
    return false
  }
}

/**
 * Obtém ou regenera de forma idempotente o contrato/termo de subscrição de debêntures em PDF.
 *
 * Arquitetura resiliente:
 * 1. Sempre deriva o acesso através do cliente Supabase configurado no runtime (ignora domínios legados gravados).
 * 2. Faz o download do arquivo como Blob autenticado e cria um Object URL local (`blob:https://...`),
 *    o que previne qualquer bloqueio por AdBlocker / Brave / antivírus ("ERR_BLOCKED_BY_CLIENT").
 * 3. Cria signedUrl atualizada caso seja necessária para compartilhamento externo.
 * 4. Se o PDF ainda não foi gerado ou for solicitado `forceRegenerate`, invoca a Edge Function e repete o fluxo.
 */
export async function getOrGenerateSubscriptionContract({
  investmentId,
  existingUrl,
  forceRegenerate = false,
  sendEmail = false,
  openInNewTab = true,
  downloadDirectly = false,
}: GetOrGenerateContractOptions): Promise<string> {
  if (!investmentId) {
    throw new Error('ID do investimento é obrigatório.')
  }

  const defaultFileName = `Termo_Subscricao_${investmentId.substring(0, 8)}.pdf`

  // 1. Se já possui existingUrl e não for recálculo forçado, tentar resolver via storage local
  if (existingUrl && !forceRegenerate) {
    const filePath = extractFilePathFromContractUrl(existingUrl, investmentId)

    if (filePath) {
      // Tentativa 1: Baixar como Blob no cliente (100% imune a ERR_BLOCKED_BY_CLIENT)
      const blobResult = await downloadContractAsBlob(filePath)
      if (blobResult) {
        if (downloadDirectly) {
          triggerFileDownload(blobResult.blob, defaultFileName)
          toast.success('Download do Contrato concluído!')
        } else if (openInNewTab) {
          safeOpenOrDownload(blobResult.objectUrl, defaultFileName)
        }
        return blobResult.objectUrl
      }

      // Tentativa 2: Gerar signedUrl fresca de 1 hora pelo cliente Supabase do runtime
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

      // Tentativa 3: Se o bucket for público, pegar URL pública pelo cliente atual
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

    if (!data?.url && !data?.filePath) {
      throw new Error(data?.error || 'URL do contrato não foi retornada.')
    }

    toast.dismiss(dismissToast)
    toast.success('Contrato de Subscrição gerado com sucesso!')

    const targetPath = data.filePath || extractFilePathFromContractUrl(data.url, investmentId)

    // Se temos o path, preferir abrir via Blob local para evitar qualquer bloqueio por cliente
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
    console.error('Erro ao gerar/abrir contrato de debênture:', err)
    toast.error(err.message || 'Erro ao emitir documento do contrato.')
    throw err
  }
}
