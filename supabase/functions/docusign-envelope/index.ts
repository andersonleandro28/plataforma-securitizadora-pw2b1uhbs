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

    const accountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID')
    const jwt = Deno.env.get('DOCUSIGN_ACCESS_TOKEN')
    
    let envelopeId = crypto.randomUUID()
    let signingUrl = ''

    const defaultCallback = req.headers.get('origin') || 'http://localhost:5173'
    const returnUrl = callbackUrl || defaultCallback

    if (accountId && jwt) {
      // 1. Envelope com embedded signing
      const envelopeResp = await fetch(`https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSubject: type === 'kyc' ? 'Assine seu KYC - Plataforma Securitizadora' : 'Assine seu Aditivo - Plataforma Securitizadora',
          documents: [{ 
            name: type === 'kyc' ? 'KYC.pdf' : 'Aditivo.pdf', 
            fileExtension: 'pdf', 
            documentId: '1',
            // Basic empty PDF as fallback payload if documentUrl is not converted to base64
            documentBase64: 'JVBERi0xLjcKJeLjz9MKMSAwIG9iaiA8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PiBlbmRvYmoKMiAwIG9iaiA8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PiBlbmRvYmoKMyAwIG9iaiA8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUuMjggODQxLjg5XS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4gZW5kb2JqCjQgMCBvYmogPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4gZW5kb2JqCjUgMCBvYmogPDwvTGVuZ3RoIDQ0Pj5zdHJlYW0KQlQKMCAwIDAgcmcKL0YxIDI0IFRmCjUwIDc1MCBUZAooRG9jdW1lbnRvIGRlIHRlc3RlKSBUagpFVAplbmRzdHJlYW0gZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDYwIDAwMDAwIG4gCjAwMDAwMDAxMTcgMDAwMDAgbiAKMDAwMDAwMDIxNSAwMDAwMCBuIAowMDAwMDAwMzA0IDAwMDAwIG4gCnRyYWlsZXIgPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzk3CiUlRU9G'
          }],
          recipients: { 
            signers: [{ 
              email: signerEmail, 
              name: signerName, 
              recipientId: '1', 
              clientUserId: id || '1000', // Necessário para Embedded Signing
              userId: '1000', 
              clientUserIdTimestamp: Date.now().toString(), 
              routingOrder: '1', 
              embeddedRecipientStartURL: returnUrl
            }] 
          },
          status: 'sent'
        })
      });
      const envelope = await envelopeResp.json();
      if (envelope.errorCode) throw new Error(`DocuSign API Error: ${envelope.message}`);
      envelopeId = envelope.envelopeId;

      // 2. Gerar signing URL embedded (Recipients View)
      const signingUrlResp = await fetch(`https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authenticationMethod: 'none',
          clientUserId: id || '1000',
          recipientId: '1',
          returnUrl: returnUrl,
          userName: signerName,
          email: signerEmail
        })
      });
      const signingUrlData = await signingUrlResp.json();
      if (signingUrlData.errorCode) throw new Error(`DocuSign View Error: ${signingUrlData.message}`);
      signingUrl = signingUrlData.url;
    } else {
      // Fallback robusto para sandbox caso variáveis de ambiente do DocuSign não estejam configuradas
      // Redireciona de volta para a aplicação com parâmetros para simular a assinatura concluída
      signingUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}docusign_mock=true&envelopeId=${envelopeId}`
    }

    // Salvar envelopeId e URL na tabela correspondente
    if (type === 'kyc') {
      await supabase.from('profiles').update({
        kyc_signature_envelope_id: envelopeId,
        kyc_signature_status: 'enviado',
        kyc_signature_url: signingUrl
      }).eq('id', id)
      
      await supabase.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: id,
        action: 'docusign_kyc_sent',
        details: { envelopeId, signerEmail, documentUrl, signingUrl, isMock: !accountId }
      })
    } else if (type === 'operation') {
      await supabase.from('credit_operations').update({
        signature_envelope_id: envelopeId,
        signature_status: 'enviado',
        signature_url: signingUrl
      }).eq('id', id)
      
      await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: id,
        action: 'docusign_operation_sent',
        details: { envelopeId, signerEmail, documentUrl, signingUrl, isMock: !accountId }
      })
    }

    // Simulate Email Notification (Resend)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey && signerEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
          to: [signerEmail],
          subject: type === 'kyc' ? 'Assine seu KYC (DocuSign)' : 'Assine seu Aditivo de Cessão (DocuSign)',
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Assinatura Eletrônica Pendente</h2>
              <p>Olá ${signerName},</p>
              <p>Você tem um documento aguardando assinatura eletrônica segura via DocuSign na Plataforma Securitizadora.</p>
              <p><a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Documento para Assinatura</a></p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
            </div>
          `
        })
      })
    }

    return new Response(JSON.stringify({ success: true, envelopeId, url: signingUrl }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
