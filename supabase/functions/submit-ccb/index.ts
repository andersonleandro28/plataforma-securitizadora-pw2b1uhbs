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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { entityType, borrowerData, spouseData, partnerData, operationData, bankData, guaranteesData, guarantorData, docsPaths } = await req.json()
    
    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await client.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const ccbId = crypto.randomUUID()

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
    page.drawText(`Valor Solicitado: R$ ${Number(operationData?.requestedValue || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})} | Prazo: ${sanitize(operationData?.termMonths)} meses`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
    
    if (bankData) {
      page.drawText(`Banco ${sanitize(bankData.bank)} | Agência ${sanitize(bankData.branch)} | Conta ${sanitize(bankData.account)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
    }

    const pdfBytes = await pdfDoc.save()
    const fileName = `Dossie_CCB_${ccbId.substring(0,8)}.pdf`
    const filePath = `${user.id}/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    await supabaseAdmin.storage.from('ccb-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf' })

    const { data: ccbRecord, error: dbErr } = await supabaseAdmin.from('ccb_solicitacoes').insert({
        id: ccbId, user_id: user.id, requested_value: operationData?.requestedValue || 0,
        term_months: operationData?.termMonths || 0, borrower_data: borrowerData || {}, operation_data: operationData || {},
        guarantees_data: guaranteesData || {}, docs_paths: docsPaths || {}, pdf_file_path: filePath, status: 'pendente',
        partner_data: partnerData || null
    }).select().single()
    if (dbErr) throw dbErr

    return new Response(JSON.stringify({ success: true, data: ccbRecord }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
