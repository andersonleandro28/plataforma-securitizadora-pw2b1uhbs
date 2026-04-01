import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { envelope_id, status } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check credit operations
    const { data: op } = await supabase
      .from('credit_operations')
      .select('id, status')
      .eq('signature_envelope_id', envelope_id)
      .maybeSingle()
    if (op) {
      await supabase
        .from('credit_operations')
        .update({
          signature_status: status,
          status: status === 'assinado' ? 'formalizado' : op.status,
        })
        .eq('id', op.id)

      await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: op.id,
        action: 'docusign_status_update',
        details: { envelope_id, new_status: status },
      })
    } else {
      // Check profiles for KYC
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, kyc_status')
        .eq('kyc_signature_envelope_id', envelope_id)
        .maybeSingle()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            kyc_signature_status: status,
          })
          .eq('id', profile.id)

        await supabase.from('audit_logs').insert({
          entity_type: 'profiles',
          entity_id: profile.id,
          action: 'docusign_kyc_status_update',
          details: { envelope_id, new_status: status },
        })
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
