import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { filename } = body

    if (!filename) {
      return new Response(
        JSON.stringify({ error: 'Nenhum arquivo enviado para processamento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simulate AI extraction processing time
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Mock extracted data based on typical debenture deed structures
    const mockExtractedData = {
      issuer_name: 'Securitizadora Alpha S.A.',
      total_volume: 65000000,
      issue_date: new Date().toISOString().split('T')[0],
      series: [
        { 
          series_number: '1', 
          volume: 50000000, 
          indexer: 'CDI', 
          rate: 2.5, 
          maturity_date: '2025-10-15' 
        },
        { 
          series_number: '2', 
          volume: 15000000, 
          indexer: 'IPCA', 
          rate: 6.0, 
          maturity_date: '2028-10-15' 
        }
      ]
    }

    return new Response(
      JSON.stringify({ data: mockExtractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Extraction Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
