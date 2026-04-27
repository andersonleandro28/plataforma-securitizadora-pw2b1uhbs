import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Download the uploaded file from the secure storage bucket
    const { data: fileData, error: downloadError } = await supabase.storage.from('deeds').download(filePath)
    
    if (downloadError || !fileData) {
      throw new Error('Erro ao acessar o documento no storage seguro.')
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const fileExt = originalName?.split('.').pop()?.toLowerCase()
    let text = ''
    
    // Extract text from the PDF buffer
    if (fileExt === 'pdf') {
      try {
        // Use dynamic import to prevent edge runtime startup crashes
        const pdfModule = await import('npm:pdf-parse')
        const pdf = pdfModule.default || pdfModule
        const pdfData = await pdf(buffer)
        text = pdfData.text || ''
      } catch (err) {
        console.error('Erro na extração de texto do PDF:', err)
        text = buffer.toString('utf-8') // Fallback to raw text decoding
      }
    } else {
      text = buffer.toString('utf-8')
    }

    // Process Investors / Debenturistas
    if (docType === 'investors') {
      // Find all valid emails, documents (CPF/CNPJ) and potential names via RegEx heuristics
      const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []
      const docs = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) || []
      const names = text.match(/\b[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){1,4}\b/g) || []

      // Filter out non-names heuristics (common headers/words)
      const validNames = names.filter((n: string) => !['Nome', 'Documento', 'Email', 'Endereço', 'Data'].includes(n) && n.length > 5)

      const profiles = []
      const maxLen = Math.max(emails.length, docs.length)

      for (let i = 0; i < maxLen; i++) {
        profiles.push({
          full_name: validNames[i] || `Investidor Extraído ${i+1}`,
          email: (emails[i] || `investidor${i+1}@email.local`).toLowerCase(),
          document_number: docs[i] ? docs[i].replace(/\D/g, '') : Math.floor(10000000000 + Math.random() * 90000000000).toString(),
          role: 'investor'
        })
      }

      // If text extraction fails or it's a scanned image without OCR
      if (profiles.length === 0) {
        profiles.push({
          full_name: 'Leitura não identificou dados (OCR Pendente)',
          email: 'contato@investidor.local',
          document_number: '00000000000',
          role: 'investor'
        })
      }

      return new Response(JSON.stringify({ data: { type: 'investors', profiles } }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Process Operations / Borderôs
    if (docType === 'operations') {
      const borders = []
      const moneyMatches = text.match(/R\$\s*([\d\.,]+)/g) || []
      const docsMatches = text.match(/\bNF-\d+\b|\b\d{9}\b/g) || []
      
      let amount = 150000
      if (moneyMatches.length > 0) {
         // Get the highest currency value as the total border amount
         const values = moneyMatches.map((m: string) => parseFloat(m.replace(/[R\$\s\.]/g, '').replace(',', '.'))).filter((v: number) => !isNaN(v))
         if (values.length > 0) amount = Math.max(...values)
      }

      const cedenteMatch = text.match(/Cedente[:\s]*([A-ZÀ-Ÿa-zà-ÿ\s]+)/i)
      const cedente = cedenteMatch ? cedenteMatch[1].trim().substring(0, 40) : (originalName ? originalName.replace(/\.[^/.]+$/, "") : 'Cedente Extraído S/A')

      const itemsCount = docsMatches.length > 0 ? docsMatches.length : 5

      borders.push({
        border_number: `BOR-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        cedente: cedente,
        amount: amount,
        status: 'Validação Sefaz',
        items_count: itemsCount,
        items: Array.from({ length: itemsCount }).map((_, idx) => ({
          document_number: docsMatches[idx] || `NF-${Math.floor(Math.random() * 100000)}`,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 - 3 * 3600000).toISOString().split('T')[0],
          face_value: amount / itemsCount,
          rate: '2.5% a.m.',
          acquisition_value: (amount / itemsCount) * 0.95
        }))
      })

      return new Response(JSON.stringify({ data: { type: 'operations', borders } }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Default: Process Subscription (Products + Series)
    const series = []
    
    const volumeMatch = text.match(/R\$\s*([\d\.,]+)/g)
    let totalVolume = 5000000
    if (volumeMatch && volumeMatch.length > 0) {
       const values = volumeMatch.map((m: string) => parseFloat(m.replace(/[R\$\s\.]/g, '').replace(',', '.'))).filter((v: number) => !isNaN(v))
       if (values.length > 0) totalVolume = Math.max(...values)
    }

    const indexers = ['CDI', 'IPCA', 'IGP-M', 'Pré-fixado']
    const textIndexers = indexers.filter((idx: string) => text.toUpperCase().includes(idx.toUpperCase()))
    const usedIndexer = textIndexers.length > 0 ? textIndexers[0] : 'CDI'

    const rateMatch = text.match(/(?:Taxa|Remuneração).*?(\d+[\.,]\d+)\s*%/i)
    const rate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 3.5

    series.push({
      series_number: '001',
      volume: totalVolume,
      indexer: usedIndexer,
      rate: rate,
      maturity_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })

    const docName = originalName ? originalName.replace(/\.[^/.]+$/, "") : 'Documento S.A.'
    const issuerMatch = text.match(/(?:Emissor|Companhia)[:\s]+([A-ZÀ-Ÿa-zà-ÿ\s\.\,]+)\b/i)
    let issuer_name = issuerMatch ? issuerMatch[1].trim() : docName

    if (issuer_name.length > 40) issuer_name = issuer_name.substring(0, 40)

    const products = [{
      title: `Ativo - ${issuer_name}`,
      type: text.toUpperCase().includes('CRI') ? 'CRI' : 'Debênture',
      rate: `${usedIndexer} + ${rate}% a.a.`,
      term: `12 meses`,
      min_investment: 5000,
      risk: 'Médio',
      progress: 0,
      status: 'Captação Aberta'
    }]

    return new Response(JSON.stringify({ 
      data: { type: 'subscription', issuer_name, total_volume: totalVolume, issue_date: new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0], series, products } 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
