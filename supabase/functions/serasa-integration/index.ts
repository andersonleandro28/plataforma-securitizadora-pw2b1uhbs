import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document } = await req.json()

    // Usage of secure credentials injected via Supabase Edge Function Secrets
    const apiKey = Deno.env.get('SERASA_API_KEY')
    const password = Deno.env.get('SERASA_PASSWORD')

    if (!document) {
      return new Response(
        JSON.stringify({ error: 'Documento (CPF/CNPJ) é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simulate API latency for Sandbox
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Deterministic mock generation based on document last 4 digits
    const docNumber = document.replace(/\D/g, '')
    const seed = docNumber.length > 0 ? parseInt(docNumber.slice(-4)) : 500
    const score = (seed * 13) % 1000
    
    let risk = 'Alto'
    if (score >= 700) risk = 'Baixo'
    else if (score >= 400) risk = 'Médio'

    const mockResponse = {
      document,
      score,
      riskClassification: risk,
      probabilityOfDefault: ((1000 - score) / 10).toFixed(2) + '%',
      lastConsultation: new Date().toISOString(),
      negativeRecords: score < 400 ? Math.floor((1000 - score) / 100) : 0,
      financialCommitment: (Math.random() * 50 + 10).toFixed(1) + '%'
    }

    return new Response(
      JSON.stringify({ data: mockResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
