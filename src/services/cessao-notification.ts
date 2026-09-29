import { supabase } from '@/lib/supabase/client'
import { triggerFileDownload, safeOpenOrDownload } from './subscription-contract'
import { printWithReportTitle } from '@/lib/print-with-title'

export interface NotificacaoCessaoRecord {
  id: string
  operation_id: string
  sacado_nome: string
  sacado_documento?: string | null
  sacado_email?: string | null
  sacado_telefone?: string | null
  pdf_file_path?: string | null
  pdf_url?: string | null
  token: string
  status_envio: 'pendente' | 'enviado' | 'falha_envio' | 'sem_email'
  email_enviado_em?: string | null
  email_erro?: string | null
  status_aceite: 'aguardando' | 'aceito' | 'expirado'
  aceito_em?: string | null
  aceito_ip?: string | null
  aceito_user_agent?: string | null
  aceito_hash?: string | null
  expira_em: string
  created_at: string
  updated_at: string
}

export interface GenerateNotificacaoCessaoOptions {
  operationId: string
  forceRegenerate?: boolean
  sendEmail?: boolean
}

export interface GenerateNotificacaoCessaoResult {
  success: boolean
  token?: string
  filePath?: string
  url?: string
  signedUrl?: string
  publicUrl?: string
  emailStatus?: string
  emailErro?: string
  error?: string
}

/**
 * Invoca a edge function generate-cessao-notification
 */
export async function generateOrGetCessaoNotification(
  options: GenerateNotificacaoCessaoOptions,
): Promise<GenerateNotificacaoCessaoResult> {
  const originUrl = typeof window !== 'undefined' ? window.location.origin : undefined

  try {
    const { data, error } = await supabase.functions.invoke('generate-cessao-notification', {
      body: {
        operationId: options.operationId,
        forceRegenerate: options.forceRegenerate ?? false,
        sendEmail: options.sendEmail ?? true,
        originUrl,
      },
    })

    if (error) {
      console.warn('Erro ao invocar generate-cessao-notification:', error)
      return { success: false, error: error.message }
    }

    return data as GenerateNotificacaoCessaoResult
  } catch (err: any) {
    console.warn('Exceção ao chamar generate-cessao-notification:', err)
    return { success: false, error: err?.message || 'Erro de comunicação' }
  }
}

/**
 * Busca o registro de notificação de uma operação no banco
 */
export async function fetchNotificacaoCessao(
  operationId: string,
): Promise<NotificacaoCessaoRecord | null> {
  const { data, error } = await supabase
    .from('notificacoes_cessao' as any)
    .select('*')
    .eq('operation_id', operationId)
    .maybeSingle()

  if (error) {
    console.warn('Erro ao buscar notificacao_cessao:', error)
    return null
  }

  return data as unknown as NotificacaoCessaoRecord | null
}

/**
 * Abre ou faz download do PDF da Notificação de Cessão com visualizador blob
 * imune a bloqueador de popups
 */
export async function openOrDownloadCessaoNotification(params: {
  operationId: string
  sacadoNome?: string
  numeroOperacao?: string
}): Promise<void> {
  const opLabel = params.numeroOperacao || params.operationId.substring(0, 8).toUpperCase()
  const sacadoLabel = params.sacadoNome ? ` - ${params.sacadoNome}` : ''
  const docTitle = `Notificação de Cessão de Crédito - Op #${opLabel}${sacadoLabel}`

  // 1. Gera ou recupera URL
  const res = await generateOrGetCessaoNotification({
    operationId: params.operationId,
    forceRegenerate: false,
    sendEmail: false,
  })

  if (!res.success || (!res.signedUrl && !res.url && !res.filePath)) {
    throw new Error(res.error || 'Não foi possível gerar a notificação de cessão.')
  }

  const rawUrl = res.signedUrl || res.url || ''

  const filename = `Notificacao_Cessao_${opLabel}.pdf`

  try {
    const targetPath =
      res.filePath ||
      (rawUrl.includes('operation-docs/') ? rawUrl.split('operation-docs/')[1]?.split('?')[0] : '')
    let blobData: Blob | null = null

    if (targetPath) {
      const { data: storageBlob, error: storageErr } = await supabase.storage
        .from('operation-docs')
        .download(targetPath)

      if (!storageErr && storageBlob) {
        blobData = storageBlob
      }
    }

    if (!blobData && rawUrl) {
      const fetchRes = await fetch(rawUrl)
      if (fetchRes.ok) {
        blobData = await fetchRes.blob()
      }
    }

    if (blobData) {
      triggerFileDownload(blobData, filename)
      return
    }

    if (rawUrl) {
      safeOpenOrDownload(rawUrl, filename)
    } else {
      throw new Error('Não foi possível obter o arquivo para download.')
    }
  } catch (downloadErr) {
    console.warn('Falha ao obter blob do PDF, fallback seguro:', downloadErr)
    if (rawUrl) {
      safeOpenOrDownload(rawUrl, filename)
    } else {
      throw downloadErr
    }
  }
}
