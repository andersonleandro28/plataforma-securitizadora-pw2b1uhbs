import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { users } = await req.json()

    if (!users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ error: 'Lista de usuários inválida' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const results = []

    for (const u of users) {
      const password = u.document_number.replace(/\D/g, '')
      
      const { data, error } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: password,
        email_confirm: true,
        user_metadata: { name: u.full_name }
      })

      if (data.user) {
        // Trigger handle_new_user executes, but we must update the specific roles and constraints
        await adminClient.from('profiles').update({
          full_name: u.full_name,
          document_number: password,
          role: u.role,
          is_investor: u.role === 'investor',
          is_borrower: u.role === 'borrower',
          requires_password_change: true
        }).eq('id', data.user.id)

        results.push({ email: u.email, success: true })
      } else {
        results.push({ email: u.email, error: error?.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
