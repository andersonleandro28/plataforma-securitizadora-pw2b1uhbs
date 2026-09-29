import { supabase } from '@/lib/supabase/client'

export type InvestorAuthorizationStatus = 'pending' | 'accepted' | 'revision_requested'

export interface RespondAuthorizationParams {
  investmentId: string
  action: 'accept' | 'request_revision'
  clientIp?: string
  note?: string
}

export interface RespondAuthorizationResult {
  success: boolean
  status: InvestorAuthorizationStatus
  message: string
}

/**
 * Tenta capturar o endereço IP público real do cliente via serviços públicos rápidos e seguros com timeout.
 * Em caso de falha ou bloqueio, retorna fallback formal identificando a sessão autenticada.
 */
export async function getClientPublicIp(): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      if (data?.ip && typeof data.ip === 'string') {
        return data.ip
      }
    }
  } catch {
    // Falha silenciosa no ipify, tentar segundo endpoint
  }

  try {
    const res2 = await fetch('https://ifconfig.me/all.json', {
      headers: { Accept: 'application/json' },
    })
    if (res2.ok) {
      const data2 = await res2.json()
      if (data2?.ip_addr) return data2.ip_addr
    }
  } catch {
    // fallback padrão
  }

  return 'Conexão Autenticada via Plataforma Web/SSL'
}

/**
 * Executa a autorização ou a solicitação de revisão de um aporte lançado internamente pelo admin.
 */
export async function respondInvestmentAuthorization({
  investmentId,
  action,
  clientIp,
  note,
}: RespondAuthorizationParams): Promise<RespondAuthorizationResult> {
  const resolvedIp = clientIp || (await getClientPublicIp())

  const { data, error } = await supabase.rpc('respond_investment_authorization', {
    p_investment_id: investmentId,
    p_action: action,
    p_client_ip: resolvedIp,
    p_note: note?.trim() || null,
  })

  if (error) {
    throw new Error(error.message || 'Falha ao processar autorização do investimento.')
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as unknown as RespondAuthorizationResult
  }

  return {
    success: true,
    status: action === 'accept' ? 'accepted' : 'revision_requested',
    message: 'Operação concluída com sucesso.',
  }
}
