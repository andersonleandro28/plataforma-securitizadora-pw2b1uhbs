import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

const sanitize = (text: any) => {
  if (text === null || text === undefined || text === '') return 'Não informado'
  return String(text).replace(/[\r\n\t]/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim()
}

const parseNumeric = (val: any) => {
  if (!val) return 0
  const clean = String(val).replace(/[^\d.,]/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { entityType, borrowerData, spouseData, partnerData, operationData, bankData, guaranteesData, guarantorData, docsPaths } = body
    
    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await client.auth.getUser()
    if (authErr || !user) throw new Error('Usuário não autenticado ou token inválido')

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const ccbId = crypto.randomUUID()

    // Preparar payload consolidado para evitar erros de schema e tipagem
    const borrowerPayload = {
      ...(borrowerData || {}),
      document: borrowerData?.document?.replace(/[^\d]/g, ''), 
      income: parseNumeric(borrowerData?.income),
      partnerData: partnerData ? {
        ...partnerData,
        document: partnerData.document?.replace(/[^\d]/g, ''),
        participation: parseNumeric(partnerData.participation)
      } : null,
      spouseData: spouseData ? {
        ...spouseData,
        document: spouseData.document?.replace(/[^\d]/g, '')
      } : null,
      bankData: bankData || null,
      guarantorData: guarantorData ? {
        ...guarantorData,
        document: guarantorData.document?.replace(/[^\d]/g, ''),
        income: parseNumeric(guarantorData.income)
      } : null
    }

    const reqValue = parseNumeric(operationData?.requestedValue)
    const termMonths = parseInt(operationData?.termMonths) || 0

    // 1. OTIMIZAÇÃO: Inserir dados no banco PRIMEIRO. Se o upload demorar ou falhar, os dados não são perdidos.
    const { data: ccbRecord, error: dbErr } = await supabaseAdmin.from('ccb_solicitacoes').insert({
        id: ccbId, 
        user_id: user.id, 
        requested_value: reqValue,
        term_months: termMonths, 
        borrower_data: borrowerPayload, 
        operation_data: operationData || {},
        guarantees_data: guaranteesData || {}, 
        docs_paths: docsPaths || {}, 
        status: 'pendente'
    }).select().single()

    if (dbErr) {
      console.error('Erro na inserção do banco:', dbErr)
      throw new Error(`Falha ao registrar solicitação no banco de dados: ${dbErr.message}`)
    }

    // 2. Geração e Upload do PDF em background/Try-Catch isolado
    try {
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([841.89, 595.28])
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const margin = 40
      let currentY = 595.28 - margin

      const drawH2 = (title: string, y: number) => {
        page.drawText(title, { x: margin, y, font: fontBold, size: 12 })
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: 841.89 - margin, y: y - 5 }, thickness: 1 })
      }

      page.drawText('BDIGITAL', { x: margin, y: currentY, font: fontBold, size: 24, color: rgb(0, 0.4, 0.7) })
      page.drawText('DOSSIÊ CCB - SOLICITAÇÃO COMPLETA', { x: margin + 150, y: currentY + 4, font: fontBold, size: 16 })
      currentY -= 30

      drawH2(`1. DADOS DO SOLICITANTE (${entityType === 'pj' ? 'PJ' : 'PF'})`, currentY); currentY -= 20
      if (entityType === 'pj') {
        page.drawText(`Razão Social: ${sanitize(borrowerData?.name).substring(0, 50)} | CNPJ: ${sanitize(borrowerData?.document)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
        page.drawText(`CNAE: ${sanitize(borrowerData?.cnae)} | Fundação: ${sanitize(borrowerData?.foundationDate)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
        page.drawText(`Faturamento Médio: R$ ${sanitize(borrowerData?.income)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
        page.drawText(`Endereço Comercial: ${sanitize(borrowerData?.street)}, ${sanitize(borrowerData?.number)} - ${sanitize(borrowerData?.city)}/${sanitize(borrowerData?.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20

        if (partnerData) {
          drawH2('2. DADOS DO SÓCIO ADMINISTRADOR', currentY); currentY -= 20
          page.drawText(`Nome: ${sanitize(partnerData.name).substring(0, 50)} | CPF: ${sanitize(partnerData.document)} | Part.: ${sanitize(partnerData.participation)}%`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
          page.drawText(`Endereço: ${sanitize(partnerData.street)}, ${sanitize(partnerData.number)} - ${sanitize(partnerData.city)}/${sanitize(partnerData.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20
        }
      } else {
        page.drawText(`Nome: ${sanitize(borrowerData?.name).substring(0, 50)} | CPF: ${sanitize(borrowerData?.document)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
        page.drawText(`Profissão: ${sanitize(borrowerData?.occupation)} | Renda: R$ ${sanitize(borrowerData?.income)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
        page.drawText(`Endereço: ${sanitize(borrowerData?.street)}, ${sanitize(borrowerData?.number)} - ${sanitize(borrowerData?.city)}/${sanitize(borrowerData?.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20

        if (spouseData) {
          drawH2('2. DADOS DO CÔNJUGE', currentY); currentY -= 20
          page.drawText(`Nome: ${sanitize(spouseData.name).substring(0, 50)} | CPF: ${sanitize(spouseData.document)} | Tel: ${sanitize(spouseData.phone)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
          page.drawText(`Endereço: ${sanitize(spouseData.street)}, ${sanitize(spouseData.number)} - ${sanitize(spouseData.city)}/${sanitize(spouseData.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20
        }
      }

      if (guarantorData) {
        drawH2('3. DADOS DO AVALISTA EXTRA', currentY); currentY -= 20
        page.drawText(`Nome: ${sanitize(guarantorData.name).substring(0, 50)} | CPF: ${sanitize(guarantorData.document)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      }

      drawH2('4. OPERAÇÃO E DADOS BANCÁRIOS', currentY); currentY -= 20
      page.drawText(`Tipo Crédito: ${sanitize(operationData?.creditType).substring(0, 70)}`, { x: margin, y: currentY, font: fontBold, size: 10 }); currentY -= 15
      page.drawText(`Valor Solicitado: R$ ${reqValue.toLocaleString('pt-BR', {minimumFractionDigits:2})} | Prazo: ${termMonths} meses`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      
      if (bankData) {
        page.drawText(`Banco ${sanitize(bankData.bank)} | Agência ${sanitize(bankData.branch)} | Conta ${sanitize(bankData.account)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      }

      const pdfBytes = await pdfDoc.save()
      const fileName = `Dossie_CCB_${ccbId.substring(0,8)}.pdf`
      const filePath = `${user.id}/${fileName}`
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

      const { error: uploadError } = await supabaseAdmin.storage.from('ccb-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf' })
      
      if (!uploadError) {
        await supabaseAdmin.from('ccb_solicitacoes').update({ pdf_file_path: filePath }).eq('id', ccbId)
        ccbRecord.pdf_file_path = filePath
      } else {
        console.error('Erro ao salvar PDF no Storage:', uploadError)
      }
    } catch (pdfErr) {
      console.error('Falha na geração do PDF (Ignorado para não interromper fluxo):', pdfErr)
    }

    return new Response(JSON.stringify({ success: true, data: ccbRecord }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('Erro na function submit-ccb:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no processamento da CCB' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
