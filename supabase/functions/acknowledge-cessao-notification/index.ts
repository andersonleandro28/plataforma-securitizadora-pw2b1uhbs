import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { computeSha256Hex } from '../_shared/qualified-signature.ts'

interface AcknowledgePayload {
  token: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extrair IP do cliente dos headers comuns
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')
    const clientIp =
      (forwardedFor ? forwardedFor.split(',')[0].trim() : '') ||
      realIp ||
      cfConnectingIp ||
      '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || 'Navegador Web'

    if (req.method === 'GET') {
      // Consulta detalhada para a página pública
      const url = new URL(req.url)
      const token = url.searchParams.get('token')

      if (!token) {
        return new Response(JSON.stringify({ error: 'Token não informado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: notif, error: notifErr } = await supabase
        .from('notificacoes_cessao')
        .select('*, credit_operations(*, profiles(*))')
        .eq('token', token)
        .single()

      if (notifErr || !notif) {
        return new Response(
          JSON.stringify({ error: 'Notificação não encontrada ou link inválido' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Validação de expiração (90 dias)
      if (notif.expira_em && new Date(notif.expira_em) < new Date()) {
        return new Response(
          JSON.stringify({
            error: 'Este link de notificação expirou. Entre em contato com a securitizadora.',
            expired: true,
          }),
          {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Buscar dados da Securitizadora
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      // Buscar conta bancária ativa
      const { data: bankAccounts } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('is_active', true)
        .limit(1)

      return new Response(
        JSON.stringify({
          notification: notif,
          company: companyData,
          bankAccount: bankAccounts?.[0] || null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (req.method === 'POST') {
      const { token } = (await req.json()) as AcknowledgePayload

      if (!token) {
        return new Response(JSON.stringify({ error: 'Token não informado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Buscar o registro
      const { data: notif, error: notifErr } = await supabase
        .from('notificacoes_cessao')
        .select('*')
        .eq('token', token)
        .single()

      if (notifErr || !notif) {
        return new Response(
          JSON.stringify({ error: 'Notificação não encontrada ou token expirado' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Validação de expiração
      if (notif.expira_em && new Date(notif.expira_em) < new Date()) {
        return new Response(
          JSON.stringify({
            error: 'Este link de notificação expirou. Entre em contato com a securitizadora.',
            expired: true,
          }),
          {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      if (notif.status_aceite === 'aceito') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ciência já confirmada anteriormente',
            alreadyAcknowledged: true,
            aceito_em: notif.aceito_em,
            aceito_ip: notif.aceito_ip,
            aceito_hash: notif.aceito_hash,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const now = new Date()
      const nowIso = now.toISOString()

      // Gerar Hash SHA-256 de validação jurídica
      const hashPayload = `${notif.id}|${notif.operation_id}|${notif.sacado_nome}|${clientIp}|${nowIso}`
      const hash = await computeSha256Hex(hashPayload)

      const { data: updated, error: updateErr } = await supabase
        .from('notificacoes_cessao')
        .update({
          status_aceite: 'aceito',
          aceito_em: nowIso,
          aceito_ip: clientIp,
          aceito_user_agent: userAgent,
          aceito_hash: hash,
          updated_at: nowIso,
        })
        .eq('token', token)
        .select('*')
        .single()

      if (updateErr) {
        return new Response(
          JSON.stringify({ error: `Erro ao salvar aceite: ${updateErr.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ciência da cessão de crédito confirmada com sucesso',
          aceito_em: updated.aceito_em,
          aceito_ip: updated.aceito_ip,
          aceito_hash: updated.aceito_hash,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Erro na função acknowledge-cessao-notification:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
