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

    const { data: op, error: fetchErr } = await supabase
      .from('credit_operations')
      .select('id, status')
      .eq('signature_envelope_id', envelope_id)
      .single()

    if (fetchErr || !op) throw new Error('Operação não encontrada para este envelope.')

    const { error } = await supabase
      .from('credit_operations')
      .update({
        signature_status: status,
        // Advance the operation status if signed
        status: status === 'assinado' ? 'aguardando_formalizacao' : op.status,
      })
      .eq('signature_envelope_id', envelope_id)

    if (error) throw error

    await supabase.from('audit_logs').insert({
      entity_type: 'credit_operations',
      entity_id: op.id,
      action: 'status_assinatura_atualizado',
      details: { envelope_id, new_status: status },
    })

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
