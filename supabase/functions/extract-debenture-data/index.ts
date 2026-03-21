import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { filePath, originalName, docType } = body

    if (!filePath && !originalName) {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo enviado para processamento.' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    await new Promise(resolve => setTimeout(resolve, 2000))

    if (docType === 'investors') {
      const profiles = Array.from({ length: 12 }).map((_, i) => ({
        full_name: `Investidor Identificado ${i+1}`,
        email: `investidor${i+1}@carteira.local`,
        document_number: Math.floor(10000000000 + Math.random() * 90000000000).toString(),
        role: 'investor'
      }))
      profiles.push({ full_name: 'Tomador Principal Alpha', email: 'tomador_alpha@corporativo.local', document_number: '11111111111', role: 'borrower' })
      profiles.push({ full_name: 'Tomador Secundário Beta', email: 'tomador_beta@corporativo.local', document_number: '22222222222', role: 'borrower' })

      return new Response(JSON.stringify({ data: { type: 'investors', profiles } }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (docType === 'operations') {
      const borders = Array.from({ length: 20 }).map((_, i) => {
        const amount = Math.floor(Math.random() * 500000) + 50000
        const itemsCount = Math.floor(Math.random() * 8) + 2
        return {
          border_number: `BOR-2024-${String(i+1).padStart(3, '0')}`,
          cedente: `Fundo Cedente ${String.fromCharCode(65 + (i % 5))} S/A`,
          amount: amount,
          status: i % 3 === 0 ? 'Concluído' : (i % 2 === 0 ? 'Assinatura' : 'Validação Sefaz'),
          items_count: itemsCount,
          items: Array.from({ length: itemsCount }).map(() => ({
            document_number: `NF-${Math.floor(Math.random() * 100000)}`,
            due_date: new Date(Date.now() + Math.random() * 5000000000).toISOString().split('T')[0],
            face_value: Math.floor(amount / itemsCount),
            rate: '2.5% a.m.',
            acquisition_value: Math.floor((amount / itemsCount) * 0.95)
          }))
        }
      })
      return new Response(JSON.stringify({ data: { type: 'operations', borders } }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Default: Subscription mapping (Products + Series)
    const seriesCount = 12
    const series = []
    let totalVolume = 0
    const indexers = ['CDI', 'IPCA', 'IGP-M', 'Pré-fixado']
    
    for (let i = 1; i <= seriesCount; i++) {
      const volume = Math.floor(Math.random() * 4000000) + 500000
      totalVolume += volume
      series.push({
        series_number: String(i).padStart(3, '0'),
        volume: volume,
        indexer: indexers[Math.floor(Math.random() * indexers.length)],
        rate: Number((Math.random() * 5 + 3).toFixed(2)),
        maturity_date: new Date(Date.now() + Math.random() * 100000000000).toISOString().split('T')[0]
      })
    }

    const products = Array.from({ length: 10 }).map((_, i) => ({
      title: `Ativo Estruturado ${i+1}`,
      type: i % 2 === 0 ? 'CRI' : 'Debênture',
      rate: i % 2 === 0 ? 'CDI + 3.5% a.a.' : 'IPCA + 7.2% a.a.',
      term: `${(i % 5) * 12 + 12} meses`,
      min_investment: Math.floor(Math.random() * 20) * 5000 + 5000,
      risk: i % 3 === 0 ? 'Baixo' : (i % 2 === 0 ? 'Médio' : 'Alto'),
      progress: Math.floor(Math.random() * 100),
      status: i % 4 === 0 ? 'Últimas Cotas' : 'Captação Aberta'
    }))

    const docName = originalName ? originalName.replace(/\.[^/.]+$/, "") : 'Subscrição S.A.'
    const issuer_name = docName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

    return new Response(JSON.stringify({ 
      data: { type: 'subscription', issuer_name, total_volume: totalVolume, issue_date: new Date().toISOString().split('T')[0], series, products } 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
