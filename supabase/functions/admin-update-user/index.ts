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

    // 2. Initialize Admin Client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Verify Caller is Admin
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('full_name, role, is_admin')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin' && !callerProfile?.is_admin) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Only administrators can update user credentials and status',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { targetUserId, action, payload } = await req.json()

    if (!targetUserId || !action) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: targetUserId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (action === 'toggle_block' && caller.id === targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Não é possível bloquear o seu próprio usuário.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4. Process Action
    if (action === 'change_password') {
      const { password } = payload
      if (!password || password.length < 6)
        throw new Error('A senha deve ter pelo menos 6 caracteres')

      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: password,
      })
      if (updateError) throw updateError

      // Force user to change password on next login
      await adminClient
        .from('profiles')
        .update({ force_password_change: true })
        .eq('id', targetUserId)

      const adminName = callerProfile?.full_name || caller.email || 'Administrador'
      const logMessage = `Senha do usuário ${targetUserId} redefinida pelo Admin ${adminName} em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

      await adminClient.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: targetUserId,
        action: 'admin_changed_password',
        details: { admin_id: caller.id, message: logMessage },
      })
    } else if (action === 'toggle_block') {
      const isBlocked = payload.is_blocked
      const banDuration = isBlocked ? '876000h' : 'none' // 100 years or none

      const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: banDuration,
      })
      if (authError) throw authError

      await adminClient.from('profiles').update({ is_blocked: isBlocked }).eq('id', targetUserId)

      await adminClient.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: targetUserId,
        action: isBlocked ? 'admin_blocked_user' : 'admin_unblocked_user',
        details: { admin_id: caller.id },
      })
    } else {
      throw new Error('Invalid action provided')
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function admin-update-user error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
