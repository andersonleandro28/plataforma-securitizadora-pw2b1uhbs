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
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await client.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin' && !callerProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only administrators can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json()
    const { email, role, document_number, ...profileData } = body

    if (!email || !role || !document_number) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Email, role, and document_number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Generate temporary password based on numbers of the document or fallback
    const password = document_number.replace(/\D/g, '') || 'Secreta@123'

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: profileData.full_name || profileData.pj_company_name },
    })

    if (createError) throw createError

    if (userData.user) {
      // The handle_new_user trigger might have created an empty profile. We update it now.
      const updateData: any = {
        ...profileData,
        role: role,
        document_number: document_number,
        is_admin: role === 'admin',
        is_staff: role === 'staff',
        is_investor: role === 'investor',
        is_borrower: role === 'borrower',
        requires_password_change: true,
      }

      const { error: profileError } = await adminClient
        .from('profiles')
        .update(updateData)
        .eq('id', userData.user.id)

      if (profileError) {
        console.error('Error updating created user profile:', profileError)
      }

      await adminClient.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: userData.user.id,
        action: 'admin_created_user',
        details: { admin_id: caller.id, email },
      })
    }

    return new Response(
      JSON.stringify({ success: true, user: userData.user, tempPassword: password }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Edge function admin-create-user error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
