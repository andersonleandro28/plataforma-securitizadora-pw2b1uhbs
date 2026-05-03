import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document } = await req.json()

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
    let seed = docNumber.length > 0 ? parseInt(docNumber.slice(-4)) : 500
    if (isNaN(seed)) seed = 500
    
    let score = (seed * 13) % 1000
    
    // For testing hard rules, if document starts with certain prefixes, force specific scores
    if (docNumber.startsWith('000')) score = 150; // Critical score < 200
    else if (docNumber.startsWith('111')) score = 850; // High score

    let risk = 'Alto'
    if (score >= 700) risk = 'Baixo'
    else if (score >= 400) risk = 'Médio'

    // Simulate negative records amount and bankruptcy flags based on score thresholds
    const negativeValue = score < 400 ? Math.floor((1000 - score) * 15.5) : 0;
    const bankruptcies = score < 200 ? 1 : 0;

    const mockResponse = {
      document,
      score,
      riskClassification: risk,
      probabilityOfDefault: ((1000 - score) / 10).toFixed(2) + '%',
      lastConsultation: new Date().toISOString(),
      negativeRecords: score < 400 ? Math.floor((1000 - score) / 100) : 0,
      negativeRecordsValue: negativeValue,
      bankruptcies: bankruptcies,
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
