import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { ccb_id, user_id } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Esta função usa service role (ignora RLS) e envia e-mail em nome da
    // empresa: precisa saber quem chamou. Antes, qualquer pessoa podia
    // disparar e-mail para qualquer user_id.
    const authHeader = req.headers.get('Authorization') || ''
    let callerId: string | null = null
    if (authHeader) {
      const callerClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userResp } = await callerClient.auth.getUser()
      callerId = userResp?.user?.id || null
    }
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Autenticação obrigatória.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin, is_staff, role')
      .eq('id', callerId)
      .maybeSingle()
    const callerIsAdmin =
      !!callerProfile?.is_admin ||
      !!callerProfile?.is_staff ||
      ['admin', 'staff'].includes(String(callerProfile?.role || ''))
    if (!callerIsAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // `ccb_id` vem do chamador e era interpolado no HTML do e-mail sem
    // tratamento: um valor com tags injetava HTML no e-mail enviado pela
    // empresa a um cliente. Aqui ele é reduzido a caracteres seguros.
    const refSegura = String(ccb_id || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase()

    const { data: user } = await supabase.auth.admin.getUserById(user_id)
    const email = user?.user?.email

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tomador sem e-mail cadastrado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey && email) {
      // A resposta do Resend era ignorada: um 401/422 (chave inválida, domínio
      // não verificado) passava como sucesso e o cliente nunca recebia nada.
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
          to: [email],
          subject: 'Sua proposta de crédito foi revisada',
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Proposta de Crédito Revisada</h2>
              <p>Olá,</p>
              <p>Sua proposta de crédito (Ref: #${refSegura}) foi revisada pelo nosso comitê.</p>
              <p>Confira as novas condições no seu painel para dar aceite e continuarmos com a emissão da CCB.</p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
            </div>
          `,
        }),
      })

      if (!resendRes.ok) {
        const detalhe = await resendRes.text()
        console.error('Resend recusou o envio:', resendRes.status, detalhe)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'O e-mail não foi aceito pelo provedor.',
            provider_status: resendRes.status,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
