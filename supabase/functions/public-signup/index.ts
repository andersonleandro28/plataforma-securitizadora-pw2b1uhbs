import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, password, role, entity_type, ...profileData } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Create user in Auth
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: profileData.full_name || profileData.pj_company_name },
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (data.user) {
      // Update comprehensive profile
      const updatePayload = {
        role: role || 'investor',
        entity_type: entity_type || 'pf',
        is_investor: role === 'investor',
        is_borrower: role === 'borrower',
        document_number: profileData.document_number,
        full_name: profileData.full_name,
        phone: profileData.phone,
        pj_company_name: profileData.pj_company_name,
        pj_trade_name: profileData.pj_trade_name,
        pj_rep_name: profileData.pj_rep_name,
        pj_rep_cpf: profileData.pj_rep_cpf,
        pj_rep_role: profileData.pj_rep_role,
        address_zip: profileData.address_zip,
        address_street: profileData.address_street,
        address_number: profileData.address_number,
        address_complement: profileData.address_complement,
        address_neighborhood: profileData.address_neighborhood,
        address_city: profileData.address_city,
        address_state: profileData.address_state,
        lgpd_accepted: true,
        lgpd_accepted_at: new Date().toISOString(),
      }

      await adminClient.from('profiles').update(updatePayload).eq('id', data.user.id)

      // Try safely to update new migration fields if they exist
      await adminClient
        .from('profiles')
        .update({
          pf_birth_date: profileData.pf_birth_date || null,
          pj_state_registration: profileData.pj_state_registration || null,
        })
        .eq('id', data.user.id)
        .catch(() => {})

      // Send customized welcome email
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey) {
        const nomeExibicao =
          entity_type === 'pj' ? profileData.pj_company_name : profileData.full_name
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
            to: [email],
            subject: 'Bem-vindo(a) à Plataforma Securitizadora',
            html: `
              <div style="font-family: sans-serif; color: #333;">
                <h2>Bem-vindo(a), ${nomeExibicao}!</h2>
                <p>Sua conta na Plataforma Securitizadora foi criada com sucesso.</p>
                <p>Acesse seu painel para completar as informações de conformidade (KYC) e aproveitar nossos recursos.</p>
                <br/>
                <p>Atenciosamente,<br/>Equipe Plataforma Securitizadora</p>
              </div>
            `,
          }),
        })
      }
    }

    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
