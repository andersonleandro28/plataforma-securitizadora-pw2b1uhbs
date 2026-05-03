import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { filePath, bucket = 'operation-docs' } = await req.json()
    
    if (!filePath) {
       return new Response(JSON.stringify({ error: 'filePath é obrigatório' }), { 
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // 1. Valida a autenticação do usuário para manter o sistema seguro
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authErr } = await authClient.auth.getUser()
    
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    
    // 2. Instancia o cliente com Service Role para buscar o arquivo diretamente via Admin
    // Isso ignora políticas restritivas do bucket CDN e evita bloqueios (ERR_BLOCKED_BY_CLIENT)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Faz o download do arquivo como Blob
    const { data: file, error } = await supabaseAdmin.storage.from(bucket).download(filePath)

    if (error || !file) {
      throw new Error(`Erro ao buscar arquivo no bucket: ${error?.message}`)
    }

    // 4. Retorna o Blob com os headers limpos, ignorando o roteamento padrão do CDN
    const fileName = filePath.split('/').pop() || 'documento.pdf'
    
    return new Response(file, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (err: any) {
    console.error('Edge Function serve-pdf error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
