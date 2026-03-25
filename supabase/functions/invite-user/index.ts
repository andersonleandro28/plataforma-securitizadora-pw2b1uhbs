import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerError } = await client.auth.getUser(jwt)
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: callerProfile } = await adminClient.from('profiles').select('role, is_admin').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin' && !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can invite users' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { email, role, fullName } = await req.json()

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'Bad Request: Email and role are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { name: fullName }
    })

    if (inviteError) throw inviteError

    if (inviteData.user) {
      const updateData: any = { role: role, full_name: fullName };
      if (role === 'admin') updateData.is_admin = true;
      if (role === 'staff') updateData.is_staff = true;
      if (role === 'investor') updateData.is_investor = true;
      if (role === 'borrower') updateData.is_borrower = true;

      const { error: profileError } = await adminClient
        .from('profiles')
        .update(updateData)
        .eq('id', inviteData.user.id)
        
      if (profileError) {
        console.error('Error updating invited user profile:', profileError)
      }
    }

    return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function invite-user error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
