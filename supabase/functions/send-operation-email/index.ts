import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
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
    const payload = await req.json()
    const { record, old_record } = payload

    if (!record || !record.borrower_id || !record.status) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only process if status changed
    if (old_record && old_record.status === record.status) {
      return new Response(JSON.stringify({ message: 'Status não alterado, ignorando.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user details to get the email address
    const {
      data: { user },
      error,
    } = await supabase.auth.admin.getUserById(record.borrower_id)

    if (error || !user) {
      console.error('Erro ao buscar usuário:', error)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userEmail = user.email
    const opId = record.id.split('-')[0].toUpperCase() // Short ID for readability
    let subject = ''
    let message = ''

    switch (record.status) {
      case 'enviado':
        subject = `Solicitação Recebida: Operação #${opId}`
        message = `Recebemos sua solicitação #${opId}. Estamos iniciando a triagem e análise dos documentos.`
        break
      case 'pendencia_documental':
        subject = `Ação Necessária: Pendência na Operação #${opId}`
        message = `Atenção: Identificamos documentação incompleta ou divergente na operação #${opId}. Por favor, verifique seu painel para mais detalhes e envie os arquivos complementares.`
        break
      case 'aprovado':
        subject = `Aprovado: Operação #${opId}`
        message = `Parabéns! Sua operação #${opId} foi aprovada em nosso comitê de crédito e seguiu para o processo de formalização e assinatura.`
        break
      case 'pago':
        subject = `Liquidação Efetuada: Operação #${opId}`
        message = `Tudo certo! O valor líquido referente à operação #${opId} foi liberado e transferido para a sua conta bancária cadastrada.`
        break
      case 'reprovado':
        subject = `Atualização: Operação #${opId}`
        message = `Sua operação #${opId} não foi aprovada neste momento. Você pode consultar os detalhes no seu painel.`
        break
      default:
        // Ignore other intermediate statuses to avoid spam
        return new Response(JSON.stringify({ message: 'Status não requer notificação.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Simulate sending an email notification
    console.log('--- ENVIO DE E-MAIL AUTOMÁTICO ---')
    console.log(`Para: ${userEmail}`)
    console.log(`Assunto: ${subject}`)
    console.log(`Mensagem: ${message}`)
    console.log('----------------------------------')

    // In a real scenario, you would integrate Resend, SendGrid, AWS SES, etc. here.
    // Example: await fetch('https://api.resend.com/emails', { ... })

    return new Response(
      JSON.stringify({ success: true, message: 'Notificação enviada com sucesso.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Erro interno:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
