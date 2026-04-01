import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { signerEmail, signerName, documentUrl, callbackUrl, type, id } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Mock DocuSign API Call Envelope Creation (Sandbox demo.docusign.net)
    const envelopeId = crypto.randomUUID()
    const docusignUrl = `https://demo.docusign.net/Signing/start_session?envelopeId=${envelopeId}`

    if (type === 'kyc') {
      await supabase
        .from('profiles')
        .update({
          kyc_signature_envelope_id: envelopeId,
          kyc_signature_status: 'enviado',
          kyc_signature_url: docusignUrl,
        })
        .eq('id', id)

      await supabase.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: id,
        action: 'docusign_kyc_sent',
        details: { envelopeId, signerEmail, documentUrl },
      })
    } else if (type === 'operation') {
      await supabase
        .from('credit_operations')
        .update({
          signature_envelope_id: envelopeId,
          signature_status: 'enviado',
          signature_url: docusignUrl,
        })
        .eq('id', id)

      await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: id,
        action: 'docusign_operation_sent',
        details: { envelopeId, signerEmail, documentUrl },
      })
    }

    // Simulate Email Notification (Resend)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey && signerEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
          to: [signerEmail],
          subject:
            type === 'kyc'
              ? 'Assine seu KYC (DocuSign)'
              : 'Assine seu Aditivo de Cessão (DocuSign)',
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Assinatura Eletrônica Pendente</h2>
              <p>Olá ${signerName},</p>
              <p>Você tem um documento aguardando assinatura eletrônica segura via DocuSign na Plataforma Securitizadora.</p>
              <p><a href="${docusignUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar DocuSign</a></p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
            </div>
          `,
        }),
      })
    }

    return new Response(JSON.stringify({ success: true, envelopeId, url: docusignUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
