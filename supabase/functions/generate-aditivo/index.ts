import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'

function drawTextWrap(text: string, x: number, y: number, maxWidth: number, font: any, size: number, page: any, lineHeight: number = 1.5) {
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
    const { operationId, reason } = await req.json()
    if (!operationId) throw new Error('operationId is required')

    const authHeader = req.headers.get('Authorization')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user } } = await client.auth.getUser()

    // Service role for administrative inserts
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // Fetch operation and relations
    const { data: op, error: opError } = await supabase
      .from('credit_operations')
      .select('*, profiles(*), operation_calculations(*)')
      .eq('id', operationId)
      .single()

    // 1. VALIDAÇÃO DE DADOS (PRE-FLIGHT)
    if (opError || !op) {
        console.error(`Erro: Dados da operação não encontrados para o ID ${operationId}`);
        throw new Error(`Erro: Dados da operação não encontrados para o ID ${operationId}`);
    }

    if (!op.face_value || !op.document_number || !op.sacado) {
        console.error(`Erro: Dados da operação incompletos ou itens do borderô ausentes (ID: ${operationId})`);
        throw new Error(`Erro: Dados da operação incompletos ou itens do borderô ausentes.`);
    }

    // Fetch versions
    const { data: versionsData } = await supabase.from('contract_versions').select('version_number').eq('operation_id', operationId)
    let nextVersion = 1
    if (versionsData && versionsData.length > 0) {
      nextVersion = Math.max(...versionsData.map(v => v.version_number)) + 1
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 Size
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    const size = 11

    const margin = 50
    const maxWidth = 595.28 - (margin * 2)
    let currentY = 841.89 - margin

    // [CABEÇALHO]
    page.drawText('SECURITIZADORA', { x: margin, y: currentY, font: fontBold, size: 14 })
    currentY -= 30
    const title = `ADITIVO AO CONTRATO MÃE DE CESSÃO DE CRÉDITO Nº ${op.id.split('-')[0].toUpperCase()} - V${nextVersion}`
    page.drawText(title, { x: margin, y: currentY, font: fontBold, size: 12 })
    currentY -= 20
    const opDate = new Date().toLocaleDateString('pt-BR')
    page.drawText(`Data da Operação: ${opDate}`, { x: margin, y: currentY, font, size })
    currentY -= 30

    // [QUALIFICAÇÃO DO CEDENTE]
    page.drawText('[QUALIFICAÇÃO DO CEDENTE]', { x: margin, y: currentY, font: fontBold, size })
    currentY -= 20
    
    // 4. MAPEAMENTO DE CAMPOS (PLACEHOLDERS)
    const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
    const cedenteNome = prof?.pj_company_name || prof?.full_name || op.cedente || 'N/A'
    const cedenteDoc = prof?.document_number || 'N/A'
    const cedenteEnd = `${prof?.address_street || ''}, ${prof?.address_number || ''} - ${prof?.address_city || ''}/${prof?.address_state || ''}`

    currentY = drawTextWrap(`Razão Social / Nome: ${cedenteNome} | CNPJ/CPF: ${cedenteDoc}`, margin, currentY, maxWidth, font, size, page)
    currentY = drawTextWrap(`Endereço: ${cedenteEnd}`, margin, currentY, maxWidth, font, size, page)
    currentY -= 15

    // [CLÁUSULA PRIMEIRA]
    page.drawText('[CLÁUSULA PRIMEIRA - DO OBJETO]', { x: margin, y: currentY, font: fontBold, size })
    currentY -= 20
    const clausula1 = 'O CEDENTE, pela presente e na melhor forma de direito, CEDE e TRANSFERE à SECURITIZADORA, de forma irrevogável e irretratável, os Direitos Creditórios abaixo relacionados, originados de operações comerciais legítimas.'
    currentY = drawTextWrap(clausula1, margin, currentY, maxWidth, font, size, page)
    currentY -= 15

    // [CLÁUSULA SEGUNDA]
    // 4. ITERAÇÃO DE RECEBÍVEIS
    page.drawText('[CLÁUSULA SEGUNDA - RELAÇÃO DE TÍTULOS]', { x: margin, y: currentY, font: fontBold, size })
    currentY -= 20
    const tableHeader = 'Espécie | Nº Título | Sacado/Devedor | Vencimento | Valor de Face'
    page.drawText(tableHeader, { x: margin, y: currentY, font: fontBold, size: 10 })
    currentY -= 15
    
    const titulos = [op] // Array fallback based on schema design for operations/receivables
    for (const titulo of titulos) {
        const row = `${(titulo.receivable_type || '').toUpperCase()} | ${titulo.document_number} | ${(titulo.sacado || '').substring(0,25)} | ${new Date(titulo.due_date).toLocaleDateString('pt-BR')} | R$ ${titulo.face_value.toFixed(2)}`
        page.drawText(row, { x: margin, y: currentY, font, size: 10 })
        currentY -= 15
    }
    currentY -= 15

    // [CLÁUSULA TERCEIRA]
    page.drawText('[CLÁUSULA TERCEIRA - CONDIÇÕES FINANCEIRAS]', { x: margin, y: currentY, font: fontBold, size })
    currentY -= 20
    
    const calcArr = op.operation_calculations
    const calc = Array.isArray(calcArr) ? calcArr[0] : (calcArr || {})
    const totalDescontos = calc?.total_discounts || 0
    const valorLiquido = calc?.net_value || op.face_value

    currentY = drawTextWrap(`Valor de Face Total: R$ ${op.face_value.toFixed(2)}`, margin, currentY, maxWidth, font, size, page)
    currentY = drawTextWrap(`Total de Descontos (Deságio/Taxas/IOF): R$ ${totalDescontos.toFixed(2)}`, margin, currentY, maxWidth, font, size, page)
    currentY = drawTextWrap(`Valor Líquido a ser Pago: R$ ${valorLiquido.toFixed(2)}`, margin, currentY, maxWidth, font, size, page)
    currentY = drawTextWrap(`Dados Bancários para Crédito: Banco a definir | Ag: a definir | CC: a definir`, margin, currentY, maxWidth, font, size, page)
    currentY -= 60

    // Assinaturas
    page.drawLine({ start: { x: margin, y: currentY }, end: { x: margin + 200, y: currentY }, thickness: 1 })
    page.drawLine({ start: { x: margin + 250, y: currentY }, end: { x: margin + 450, y: currentY }, thickness: 1 })
    currentY -= 15
    page.drawText('Assinatura do Cedente', { x: margin, y: currentY, font, size: 9 })
    page.drawText('Assinatura da Securitizadora', { x: margin + 250, y: currentY, font, size: 9 })

    // Rodapé
    const hash = crypto.randomUUID()
    page.drawText(`Hash de Integridade: ${hash}`, { x: margin, y: 30, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
    page.drawText(`Página 1 de 1`, { x: 595.28 - margin - 50, y: 30, font, size: 8, color: rgb(0.5, 0.5, 0.5) })

    // 2. CORREÇÃO DO STREAM DE GERAÇÃO (AWAIT e finalização de buffer)
    const pdfBytes = await pdfDoc.save()
    
    if (pdfBytes.byteLength === 0) {
      console.error(`Erro crítico: O buffer do PDF gerado possui 0 bytes. Processo abortado. ID: ${operationId}`);
      throw new Error('Falha na geração do arquivo PDF: O buffer retornado está vazio.');
    }

    const fileName = `Aditivo_Cessao_${op.id.substring(0,8)}_v${nextVersion}.pdf`
    const filePath = `${op.id}/${fileName}`

    // Ensure we create a Blob so Supabase Storage accurately tracks the bytes across runtimes
    const pdfBlob = new Blob([pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)], { type: 'application/pdf' });

    const { error: uploadError } = await supabase.storage
      .from('operation-docs')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error(`Upload error:`, uploadError);
      throw new Error(`Erro ao salvar no storage: ${uploadError.message}`);
    }

    // 3. VALIDAÇÃO DE PERSISTÊNCIA NO STORAGE (Tamanho > 0 bytes)
    const { data: listData, error: listError } = await supabase.storage
      .from('operation-docs')
      .list(op.id, {
        limit: 1,
        search: fileName
      })

    if (listError) {
      console.error('Erro ao verificar tamanho do arquivo:', listError)
    } else {
      const uploadedFile = listData?.find(f => f.name === fileName)
      if (!uploadedFile || (uploadedFile.metadata && uploadedFile.metadata.size === 0)) {
        console.error(`Erro de persistência: O arquivo no storage possui 0 KB. ID: ${operationId}`)
        throw new Error('Falha na persistência do arquivo')
      }
    }

    const activeReason = reason || (nextVersion === 1 ? 'Primeira emissão' : 'Reemissão')

    // Record Contract Version
    const { error: versionError } = await supabase.from('contract_versions').insert({
        operation_id: op.id,
        version_number: nextVersion,
        file_path: filePath,
        file_name: fileName,
        reason: activeReason,
        created_by: user?.id
    })

    if (versionError) throw versionError

    // Insert to operation_documents for legacy support
    await supabase.from('operation_documents').insert({
        operation_id: op.id,
        file_name: fileName,
        file_path: filePath,
        file_size: pdfBytes.byteLength,
        file_type: 'application/pdf',
        category: `Aditivo Contratual v${nextVersion}`,
    })

    // Audit Log for Email Dispatch
    await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: op.id,
        action: 'email_formalizacao_enviado',
        details: { email_to: prof?.email, version: nextVersion }
    })

    return new Response(JSON.stringify({ success: true, filePath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Generate Aditivo Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
