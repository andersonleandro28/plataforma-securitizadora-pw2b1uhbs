import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { series_id, old_rate, new_rate, old_maturity, new_maturity } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all subscriptions for this series
    const { data: subs } = await supabase
      .from('debenture_subscriptions')
      .select('document_number, debenture_series(series_number, debentures(issuer_name))')
      .eq('series_id', series_id)

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum investidor para notificar.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get distinct document_numbers
    const docs = [...new Set(subs.map((s: any) => s.document_number).filter(Boolean))]

    // Get emails from profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('document_number', docs)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const seriesData: any = subs[0].debenture_series
    const seriesName = `${seriesData?.debentures?.issuer_name} - Série ${seriesData?.series_number}`

    if (resendApiKey && profiles && profiles.length > 0) {
      const emails = profiles.map((p: any) => p.email).filter(Boolean) as string[]

      if (emails.length > 0) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
            to: emails,
            subject: `Atualização de Rendimento: ${seriesName}`,
            html: `
              <div style="font-family: sans-serif; color: #333;">
                <h2>Atualização nas condições da sua Debênture</h2>
                <p>Olá,</p>
                <p>Houve uma atualização nas condições da série <strong>${seriesName}</strong> que pode afetar seus rendimentos.</p>
                <ul>
                  <li><strong>Taxa Anterior:</strong> ${old_rate}% a.a. ➔ <strong>Nova Taxa:</strong> ${new_rate}% a.a.</li>
                  <li><strong>Vencimento Anterior:</strong> ${old_maturity} ➔ <strong>Novo Vencimento:</strong> ${new_maturity}</li>
                </ul>
                <p>Acesse seu painel para ver a projeção atualizada do seu portfólio.</p>
                <br/>
                <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
              </div>
            `,
          }),
        })
      }
    } else {
      console.log('Mocking email notification for:', docs, 'Series:', seriesName)
    }

    return new Response(JSON.stringify({ success: true, notified: profiles?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
