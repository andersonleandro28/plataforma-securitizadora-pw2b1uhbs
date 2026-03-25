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

    // 1. Verify Caller Identity
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const jwt = authHeader.replace('Bearer ', '')
    const {
      data: { user: caller },
      error: callerError,
    } = await client.auth.getUser(jwt)
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Initialize Service Role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Verify Caller is Admin
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin' && !callerProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only administrators can delete users' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // 4. Extract target user id
    const { targetUserId } = await req.json()

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Bad Request: targetUserId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (caller.id === targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Não é possível excluir o seu próprio usuário.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get target user info for logging before deletion
    const { data: targetUser } = await adminClient.auth.admin.getUserById(targetUserId)

    // 5. Delete user from auth.users (cascades to profiles)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)

    if (deleteError) throw deleteError

    // 6. Audit Log
    await adminClient.from('audit_logs').insert({
      entity_type: 'profiles',
      entity_id: targetUserId,
      action: 'admin_deleted_user',
      details: {
        admin_id: caller.id,
        target_email: targetUser?.user?.email || 'unknown',
      },
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function delete-user error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
