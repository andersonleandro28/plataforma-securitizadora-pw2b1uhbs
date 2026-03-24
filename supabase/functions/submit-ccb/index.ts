import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'

function drawTextWrap(text: string, x: number, y: number, maxWidth: number, font: any, size: number, page: any, lineHeight: number = 1.5) {
  // Sanitize text to avoid WinAnsi encoding errors and split explicitly by newline
  const sanitized = text
    .replace(/\t/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\r\n]/g, '')

  const paragraphs = sanitized.split(/\r?\n/)
  let currentY = y
  const heightStep = size * lineHeight

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      currentY -= heightStep
      continue
    }

    const words = paragraph.split(' ')
    let line = ''

    for (const word of words) {
      const testLine = line + word + ' '
      const testWidth = font.widthOfTextAtSize(testLine, size)
      if (testWidth > maxWidth && line !== '') {
        page.drawText(line.trim(), { x, y: currentY, font, size, color: rgb(0, 0, 0) })
        line = word + ' '
        currentY -= heightStep
      } else {
        line = testLine
      }
    }
    if (line !== '') {
      page.drawText(line.trim(), { x, y: currentY, font, size, color: rgb(0, 0, 0) })
      currentY -= heightStep
    }
  }
  return currentY
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { borrowerData, operationData, guaranteesData, docsPaths } = await req.json()
    
    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: authErr } = await client.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Generate PDF Mirror
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const size = 10
    const margin = 50
    const maxWidth = 595.28 - (margin * 2)
    let currentY = 841.89 - margin

    page.drawText('ESPELHO DA SOLICITAÇÃO DE CCB - BDIGITAL', { x: margin, y: currentY, font: fontBold, size: 14 })
    currentY -= 30

    page.drawText('1. DADOS DO SOLICITANTE (KYC)', { x: margin, y: currentY, font: fontBold, size: 11 })
    currentY -= 20
    const kycText = `Nome: ${borrowerData.name || ''}\nCPF/CNPJ: ${borrowerData.document || ''}\nData Nasc.: ${borrowerData.dob || ''}\nEstado Civil: ${borrowerData.maritalStatus || ''}\nProfissão: ${borrowerData.occupation || ''}\nRenda Comprovada: R$ ${borrowerData.income || ''}\nTelefone: ${borrowerData.phone || ''}\nE-mail: ${borrowerData.email || ''}\nEndereço: ${borrowerData.street || ''}, ${borrowerData.number || ''} - ${borrowerData.neighborhood || ''}, ${borrowerData.city || ''}/${borrowerData.state || ''} - CEP: ${borrowerData.zip || ''}`
    currentY = drawTextWrap(kycText, margin, currentY, maxWidth, font, size, page)
    currentY -= 20

    page.drawText('2. DADOS DA OPERAÇÃO', { x: margin, y: currentY, font: fontBold, size: 11 })
    currentY -= 20
    const opText = `Valor Solicitado: R$ ${operationData.requestedValue || ''}\nPrazo Desejado: ${operationData.termMonths || ''} meses\nFinalidade: ${operationData.purpose || ''}\nTaxa Proposta: ${operationData.proposedRate || ''}% a.m.`
    currentY = drawTextWrap(opText, margin, currentY, maxWidth, font, size, page)
    currentY -= 20

    page.drawText('3. GARANTIAS / LASTRO', { x: margin, y: currentY, font: fontBold, size: 11 })
    currentY -= 20
    const guarText = `Tipo de Recebível: ${guaranteesData.receivableType || ''}\nSacados Relacionados:\n${guaranteesData.sacados?.map((s: any) => `- ${s.name} (${s.document}): R$ ${s.value}`).join('\n') || 'Nenhum sacado informado'}`
    currentY = drawTextWrap(guarText, margin, currentY, maxWidth, font, size, page)

    const pdfBytes = await pdfDoc.save()
    const fileName = `CCB_Espelho_${Date.now()}.pdf`
    const filePath = `${user.id}/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    const { error: uploadErr } = await supabaseAdmin.storage.from('ccb-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf' })
    if (uploadErr) throw new Error(`Erro ao salvar PDF: ${uploadErr.message}`)

    // 2. Insert into Database
    const { data: ccbRecord, error: dbErr } = await supabaseAdmin.from('ccb_solicitacoes').insert({
        user_id: user.id,
        requested_value: operationData.requestedValue,
        term_months: operationData.termMonths,
        borrower_data: borrowerData,
        operation_data: operationData,
        guarantees_data: guaranteesData,
        docs_paths: docsPaths,
        pdf_file_path: filePath,
        status: 'pendente'
    }).select().single()

    if (dbErr) throw dbErr

    // 3. Mock Email Notification
    console.log(`[EMAIL AUTOMÁTICO] Nova Solicitação de CCB BDIGITAL: ID ${ccbRecord.id} enviada por ${borrowerData.name}. PDF gerado em ${filePath}.`)

    return new Response(JSON.stringify({ success: true, data: ccbRecord }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
