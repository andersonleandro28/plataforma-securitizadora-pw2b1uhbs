import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'

function drawTextWrap(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any,
  size: number,
  page: any,
  lineHeight: number = 1.5,
) {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  const heightStep = size * lineHeight

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
  return currentY
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { operationId } = await req.json()
    if (!operationId) throw new Error('operationId is required')

    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Fetch operation and relations
    const { data: op, error: opError } = await supabase
      .from('credit_operations')
      .select('*, profiles(*), operation_calculations(*)')
      .eq('id', operationId)
      .single()

    if (opError || !op) throw new Error('Operação não encontrada.')

    // Generate PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 Size
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    const size = 11

    const margin = 50
    const maxWidth = 595.28 - margin * 2
    let currentY = 841.89 - margin

    // [CABEÇALHO]
    page.drawText('SECURITIZADORA', { x: margin, y: currentY, font: fontBold, size: 14 })
    currentY -= 30
    const title = `ADITIVO AO CONTRATO MÃE DE CESSÃO DE CRÉDITO Nº ${op.id.split('-')[0].toUpperCase()}`
    page.drawText(title, { x: margin, y: currentY, font: fontBold, size: 12 })
    currentY -= 20
    const opDate = new Date().toLocaleDateString('pt-BR')
    page.drawText(`Data da Operação: ${opDate}`, { x: margin, y: currentY, font, size })
    currentY -= 30

    // [QUALIFICAÇÃO DO CEDENTE]
    page.drawText('[QUALIFICAÇÃO DO CEDENTE]', { x: margin, y: currentY, font: fontBold, size })
    currentY -= 20
    const cedenteNome =
      op.profiles?.pj_company_name || op.profiles?.full_name || op.cedente || 'N/A'
    const cedenteDoc = op.profiles?.document_number || 'N/A'
    const cedenteEnd = `${op.profiles?.address_street || ''}, ${op.profiles?.address_number || ''} - ${op.profiles?.address_city || ''}/${op.profiles?.address_state || ''}`

    currentY = drawTextWrap(
      `Razão Social / Nome: ${cedenteNome} | CNPJ/CPF: ${cedenteDoc}`,
      margin,
      currentY,
      maxWidth,
      font,
      size,
      page,
    )
    currentY = drawTextWrap(`Endereço: ${cedenteEnd}`, margin, currentY, maxWidth, font, size, page)
    currentY -= 15

    // [CLÁUSULA PRIMEIRA]
    page.drawText('[CLÁUSULA PRIMEIRA - DO OBJETO]', {
      x: margin,
      y: currentY,
      font: fontBold,
      size,
    })
    currentY -= 20
    const clausula1 =
      'O CEDENTE, pela presente e na melhor forma de direito, CEDE e TRANSFERE à SECURITIZADORA, de forma irrevogável e irretratável, os Direitos Creditórios abaixo relacionados, originados de operações comerciais legítimas.'
    currentY = drawTextWrap(clausula1, margin, currentY, maxWidth, font, size, page)
    currentY -= 15

    // [CLÁUSULA SEGUNDA]
    page.drawText('[CLÁUSULA SEGUNDA - RELAÇÃO DE TÍTULOS]', {
      x: margin,
      y: currentY,
      font: fontBold,
      size,
    })
    currentY -= 20
    const tableHeader = 'Espécie | Nº Título | Sacado/Devedor | Vencimento | Valor de Face'
    page.drawText(tableHeader, { x: margin, y: currentY, font: fontBold, size: 10 })
    currentY -= 15
    const row = `${op.receivable_type.toUpperCase()} | ${op.document_number} | ${op.sacado.substring(0, 25)} | ${new Date(op.due_date).toLocaleDateString('pt-BR')} | R$ ${op.face_value.toFixed(2)}`
    page.drawText(row, { x: margin, y: currentY, font, size: 10 })
    currentY -= 30

    // [CLÁUSULA TERCEIRA]
    page.drawText('[CLÁUSULA TERCEIRA - CONDIÇÕES FINANCEIRAS]', {
      x: margin,
      y: currentY,
      font: fontBold,
      size,
    })
    currentY -= 20

    const calcArr = op.operation_calculations
    const calc = Array.isArray(calcArr) ? calcArr[0] : calcArr || {}
    const totalDescontos = calc?.total_discounts || 0
    const valorLiquido = calc?.net_value || op.face_value

    currentY = drawTextWrap(
      `Valor de Face Total: R$ ${op.face_value.toFixed(2)}`,
      margin,
      currentY,
      maxWidth,
      font,
      size,
      page,
    )
    currentY = drawTextWrap(
      `Total de Descontos (Deságio/Taxas/IOF): R$ ${totalDescontos.toFixed(2)}`,
      margin,
      currentY,
      maxWidth,
      font,
      size,
      page,
    )
    currentY = drawTextWrap(
      `Valor Líquido a ser Pago: R$ ${valorLiquido.toFixed(2)}`,
      margin,
      currentY,
      maxWidth,
      font,
      size,
      page,
    )
    currentY = drawTextWrap(
      `Dados Bancários para Crédito: Banco a definir | Ag: a definir | CC: a definir`,
      margin,
      currentY,
      maxWidth,
      font,
      size,
      page,
    )
    currentY -= 60

    // Assinaturas
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: margin + 200, y: currentY },
      thickness: 1,
    })
    page.drawLine({
      start: { x: margin + 250, y: currentY },
      end: { x: margin + 450, y: currentY },
      thickness: 1,
    })
    currentY -= 15
    page.drawText('Assinatura do Cedente', { x: margin, y: currentY, font, size: 9 })
    page.drawText('Assinatura da Securitizadora', { x: margin + 250, y: currentY, font, size: 9 })

    // Rodapé
    const hash = crypto.randomUUID()
    page.drawText(`Hash de Integridade: ${hash}`, {
      x: margin,
      y: 30,
      font,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    })
    page.drawText(`Página 1 de 1`, {
      x: 595.28 - margin - 50,
      y: 30,
      font,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Save and Upload
    const pdfBytes = await pdfDoc.save()
    const fileName = `Aditivo_Cessao_${op.id.substring(0, 8)}_${Date.now()}.pdf`
    const filePath = `${op.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('operation-docs')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Insert to operation_documents
    const { error: dbError } = await supabase.from('operation_documents').insert({
      operation_id: op.id,
      file_name: fileName,
      file_path: filePath,
      file_size: pdfBytes.byteLength,
      file_type: 'application/pdf',
      category: 'Aditivo Contratual',
    })

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, filePath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
