import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { ccb_id, user_id, newSimulation } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: user } = await supabase.auth.admin.getUserById(user_id)
    const email = user?.user?.email

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey && email) {
      await fetch('https://api.resend.com/emails', {
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
              <p>Sua proposta de crédito (Ref: #${ccb_id.split('-')[0].toUpperCase()}) foi revisada pelo nosso comitê.</p>
              <p>Confira as novas condições no seu painel para dar aceite e continuarmos com a emissão da CCB.</p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
            </div>
          `,
        }),
      })
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
