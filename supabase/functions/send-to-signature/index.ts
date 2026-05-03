import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { operationId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Simulate API integration with DocuSign/ClickSign
    const envelopeId = crypto.randomUUID()
    
    const { error } = await supabase.from('credit_operations').update({
      signature_envelope_id: envelopeId,
      signature_status: 'enviado'
    }).eq('id', operationId)

    if (error) throw error

    // Audit Log
    await supabase.from('audit_logs').insert({
      entity_type: 'credit_operations',
      entity_id: operationId,
      action: 'enviado_assinatura',
      details: { envelope_id: envelopeId, provider: 'ClickSign/DocuSign (Mock)' }
    })

    return new Response(JSON.stringify({ success: true, envelopeId }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
