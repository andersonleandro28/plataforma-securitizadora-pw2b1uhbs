import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record || payload

    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: 'Registro não encontrado no payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user details to get the email address
    const {
      data: { user },
      error,
    } = await supabase.auth.admin.getUserById(record.user_id)

    if (error || !user) {
      console.error('Erro ao buscar usuário:', error)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userEmail = user.email
    const logDate = new Date(record.created_at).toLocaleString('pt-BR')

    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
          to: [userEmail],
          subject: 'Alerta de Segurança - Novo Acesso',
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Novo Acesso Detectado</h2>
              <p>Um novo acesso foi detectado em sua conta na Plataforma Securitizadora.</p>
              <p><strong>Data/Hora:</strong> ${logDate}</p>
              <p>Se não foi você, por favor, entre em contato com o suporte imediatamente.</p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
            </div>
          `,
        }),
      })

      if (!res.ok) {
        console.error('Erro ao enviar email pelo Resend:', await res.text())
      } else {
        console.log(`Email de notificação de login enviado com sucesso para ${userEmail}`)
      }
    } else {
      // Simulate sending an email notification (mock since no SMTP provider is configured)
      console.log('--- NOTIFICAÇÃO DE LOGIN ---')
      console.log(`Para: ${userEmail}`)
      console.log(`Assunto: Alerta de Segurança - Novo Acesso`)
      console.log(
        `Mensagem: Um novo acesso foi detectado em sua conta na Plataforma Securitizadora.`,
      )
      console.log(`Data/Hora: ${logDate}`)
      console.log('----------------------------')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notificação de login disparada com sucesso.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Erro interno:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
