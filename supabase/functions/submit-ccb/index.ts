import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'

const sanitize = (text: any) => {
  if (text === null || text === undefined || text === '') return 'Não informado'
  return String(text)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { borrowerData, operationData, guaranteesData, docsPaths, spouseData, guarantorData } = await req.json()
    
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
    const ccbId = crypto.randomUUID()

    // 1. Generate Professional PDF Mirror (A4 Landscape)
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([841.89, 595.28]) // A4 Landscape
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const margin = 40
    let currentY = 595.28 - margin

    const drawLine = (y: number) => page.drawLine({ start: { x: margin, y }, end: { x: 841.89 - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })
    const drawH2 = (title: string, y: number) => {
      page.drawText(title, { x: margin, y, font: fontBold, size: 12 })
      page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: 841.89 - margin, y: y - 5 }, thickness: 1 })
    }

    // HEADER
    page.drawText('BDIGITAL', { x: margin, y: currentY, font: fontBold, size: 24, color: rgb(0, 0.4, 0.7) })
    page.drawText('SOLICITAÇÃO E SIMULAÇÃO DE EMISSÃO DE CCB', { x: margin + 150, y: currentY + 4, font: fontBold, size: 16 })
    currentY -= 20
    page.drawText(`Tomador: ${sanitize(borrowerData?.name).substring(0, 50)} | Documento: ${sanitize(borrowerData?.document)}`, { x: margin, y: currentY, font, size: 10 })
    currentY -= 15
    page.drawText(`Data/Hora: ${new Date().toLocaleString('pt-BR')} | ID Solicitação: ${ccbId.split('-')[0].toUpperCase()}`, { x: margin, y: currentY, font, size: 10 })
    currentY -= 30

    // SEC 1: KYC
    drawH2('1. DADOS DO SOLICITANTE (KYC)', currentY)
    currentY -= 20
    page.drawText(`Nome Completo: ${sanitize(borrowerData?.name).substring(0, 60)}`, { x: margin, y: currentY, font, size: 10 })
    page.drawText(`CPF/CNPJ: ${sanitize(borrowerData?.document)}`, { x: 400, y: currentY, font, size: 10 })
    currentY -= 15
    page.drawText(`Data Nasc.: ${sanitize(borrowerData?.dob)}`, { x: margin, y: currentY, font, size: 10 })
    page.drawText(`Estado Civil: ${sanitize(borrowerData?.maritalStatus)}`, { x: 250, y: currentY, font, size: 10 })
    page.drawText(`Profissão: ${sanitize(borrowerData?.occupation).substring(0, 40)}`, { x: 500, y: currentY, font, size: 10 })
    currentY -= 15
    page.drawText(`Renda Mensal: R$ ${sanitize(borrowerData?.income)}`, { x: margin, y: currentY, font, size: 10 })
    page.drawText(`Telefone: ${sanitize(borrowerData?.phone)}`, { x: 250, y: currentY, font, size: 10 })
    page.drawText(`E-mail: ${sanitize(borrowerData?.email).substring(0, 40)}`, { x: 500, y: currentY, font, size: 10 })
    currentY -= 15
    
    const endStr = `Endereço: ${sanitize(borrowerData?.street)}, ${sanitize(borrowerData?.number)} - ${sanitize(borrowerData?.neighborhood)} - ${sanitize(borrowerData?.city)}/${sanitize(borrowerData?.state)} - CEP: ${sanitize(borrowerData?.zip)}`
    page.drawText(endStr.substring(0, 130), { x: margin, y: currentY, font, size: 10 })
    currentY -= 30

    // SEC 2: DOCS
    drawH2('2. DOCUMENTOS ANEXADOS', currentY)
    currentY -= 20
    const attached = Object.keys(docsPaths || {}).filter(k => k !== 'borderos').map(k => k.toUpperCase()).join(', ') || 'Nenhum'
    page.drawText(`Arquivos Base de KYC e Comprovação: ${attached.substring(0, 100)}`, { x: margin, y: currentY, font, size: 10 })
    currentY -= 15
    if (attached.length > 100) {
      page.drawText(`...${attached.substring(100)}`, { x: margin, y: currentY, font, size: 10 })
      currentY -= 15
    }
    currentY -= 15

    if (spouseData) {
      page.drawText(`Dados Cônjuge: ${sanitize(spouseData.name).substring(0, 40)} | CPF: ${sanitize(spouseData.document)}`, { x: margin, y: currentY, font, size: 10 })
      page.drawText(`Nasc.: ${sanitize(spouseData.dob)} | Tel: ${sanitize(spouseData.phone)}`, { x: 400, y: currentY, font, size: 10 })
      currentY -= 15
      if (docsPaths?.spouse_rg) page.drawText(`[X] Documentos do cônjuge anexados no sistema`, { x: margin, y: currentY, font, size: 9, color: rgb(0, 0.4, 0.7) })
      currentY -= 15
    }

    // SEC 3: OP & SIMULATION
    drawH2('3. SIMULAÇÃO E DADOS DA OPERAÇÃO', currentY)
    currentY -= 20
    page.drawText(`Tipo Crédito: ${sanitize(operationData?.creditType).substring(0, 70)}`, { x: margin, y: currentY, font: fontBold, size: 10 })
    currentY -= 15
    page.drawText(`Valor Solicitado: R$ ${Number(operationData?.requestedValue || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: margin, y: currentY, font: fontBold, size: 10 })
    page.drawText(`Prazo: ${sanitize(operationData?.termMonths)} meses`, { x: 250, y: currentY, font, size: 10 })
    page.drawText(`Finalidade: ${sanitize(operationData?.purpose)}`, { x: 450, y: currentY, font, size: 10 })
    currentY -= 20

    if (operationData?.simulation) {
      const sim = operationData.simulation;
      page.drawText(`Valor da Parcela Mensal: R$ ${Number(sim.installment_value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: margin, y: currentY, font: fontBold, size: 10, color: rgb(0, 0.4, 0.7) })
      page.drawText(`Total Projetado a Pagar: R$ ${Number(sim.total_to_pay || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: 300, y: currentY, font: fontBold, size: 10 })
      currentY -= 15
      page.drawText(`Custo Efetivo Total (CET): ${Number(sim.cet || 0).toFixed(2)}% no período`, { x: margin, y: currentY, font, size: 10 })
      page.drawText(`Taxa Mensal Aplicada: ${(Number(sim.rate_used || 0) * 100).toFixed(2)}% a.m.`, { x: 300, y: currentY, font, size: 10 })
      currentY -= 15
      page.drawText(`Custo Fixo Emissão: R$ ${Number(sim.fixed_cost || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: margin, y: currentY, font, size: 10 })
    } else {
      page.drawText(`Taxa Proposta: ${sanitize(operationData?.proposedRate)}% a.m.`, { x: margin, y: currentY, font, size: 10 })
    }
    currentY -= 30

    // SEC 4: GUARANTEES
    drawH2('4. GARANTIAS / LASTRO', currentY)
    currentY -= 20
    page.drawText(`Garantia Exclusiva: ${sanitize(guaranteesData?.guaranteeType).toUpperCase()}`, { x: margin, y: currentY, font: fontBold, size: 10 })
    page.drawText(`Recebível Vinculado: ${sanitize(guaranteesData?.receivableType).toUpperCase()}`, { x: 300, y: currentY, font, size: 10 })
    currentY -= 15

    if (guarantorData) {
      page.drawText(`Avalista: ${sanitize(guarantorData.name).substring(0, 40)} | CPF: ${sanitize(guarantorData.document)} | Renda: R$ ${sanitize(guarantorData.income)}`, { x: margin, y: currentY, font, size: 10 })
      currentY -= 15
      page.drawText(`Relação: ${sanitize(guarantorData.relationship)} | Tel: ${sanitize(guarantorData.phone)}`, { x: margin, y: currentY, font, size: 10 })
      currentY -= 15
      if (docsPaths?.guarantor_rg) page.drawText(`[X] Documentos do avalista (RG, Renda, Endereço) anexados no sistema`, { x: margin, y: currentY, font, size: 9, color: rgb(0, 0.4, 0.7) })
      currentY -= 15
    }
    
    if (docsPaths?.vehicleDoc) {
      page.drawText(`Documento do Veículo Anexado no Sistema`, { x: margin, y: currentY, font: fontBold, size: 10, color: rgb(0, 0.4, 0.7) })
      currentY -= 15
    }

    page.drawText('Relação de Sacados (Resumo):', { x: margin, y: currentY, font: fontBold, size: 10 })
    currentY -= 15
    if (guaranteesData?.sacados && guaranteesData.sacados.length > 0) {
      guaranteesData.sacados.slice(0, 4).forEach((s: any) => {
        page.drawText(`- Nome: ${sanitize(s.name).substring(0, 40)} | Documento: ${sanitize(s.document)} | Valor: R$ ${sanitize(s.value)}`, { x: margin + 10, y: currentY, font, size: 10 })
        currentY -= 15
      })
      if (guaranteesData.sacados.length > 4) {
        page.drawText(`... e mais ${guaranteesData.sacados.length - 4} sacados (vide arquivos em anexo na plataforma)`, { x: margin + 10, y: currentY, font, size: 10, color: rgb(0.5, 0.5, 0.5) })
        currentY -= 15
      }
    } else {
      page.drawText('Nenhum sacado informado individualmente.', { x: margin + 10, y: currentY, font, size: 10 })
      currentY -= 15
    }
    const borderosCount = Array.isArray(docsPaths?.borderos) ? docsPaths.borderos.length : 0
    page.drawText(`Anexos de Lastro (Borderôs/NFs/Boletos): ${borderosCount} arquivo(s)`, { x: margin, y: currentY, font, size: 10 })
    currentY -= 40

    // FOOTER
    drawLine(currentY)
    currentY -= 20
    page.drawText('Tomador submete a simulação e concorda com a análise de crédito via BDIGITAL e Plataforma Securitizadora.', { x: margin, y: currentY, font: fontBold, size: 10 })
    page.drawText(`Emitido via Parceria Integrada BDIGITAL - ID Transação: ${ccbId}`, { x: margin, y: currentY - 15, font, size: 8, color: rgb(0.5, 0.5, 0.5) })

    // BDIGITAL STAMP BOX
    const boxW = 200, boxH = 60
    page.drawRectangle({ x: 841.89 - margin - boxW, y: currentY - 40, width: boxW, height: boxH, borderColor: rgb(0,0,0), borderWidth: 1 })
    page.drawText('Uso Exclusivo BDIGITAL / Securitizadora', { x: 841.89 - margin - boxW + 10, y: currentY + 5, font: fontBold, size: 8 })
    page.drawText('Aprovação / Carimbo', { x: 841.89 - margin - boxW + 45, y: currentY - 15, font, size: 10, color: rgb(0.7, 0.7, 0.7) })

    const pdfBytes = await pdfDoc.save()
    const fileName = `CCB_Simulacao_Espelho_${ccbId.substring(0,8)}.pdf`
    const filePath = `${user.id}/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    const { error: uploadErr } = await supabaseAdmin.storage.from('ccb-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf' })
    if (uploadErr) throw new Error(`Erro ao salvar PDF: ${uploadErr.message}`)

    // Console log for debugging
    const filledFieldsCount = Object.keys(borrowerData || {}).length + Object.keys(operationData || {}).length;
    console.log(`PDF gerado com ${filledFieldsCount} campos processados e salvo em ${filePath}.`);

    // 2. Insert into Database using predefined UUID
    const { data: ccbRecord, error: dbErr } = await supabaseAdmin.from('ccb_solicitacoes').insert({
        id: ccbId,
        user_id: user.id,
        requested_value: operationData?.requestedValue || 0,
        term_months: operationData?.termMonths || 0,
        borrower_data: borrowerData || {},
        operation_data: operationData || {},
        guarantees_data: guaranteesData || {},
        docs_paths: docsPaths || {},
        pdf_file_path: filePath,
        status: 'pendente'
    }).select().single()

    if (dbErr) throw dbErr

    if (spouseData) {
      await supabaseAdmin.from('ccb_conjuges').insert({
        ccb_id: ccbId,
        name: spouseData.name,
        document: spouseData.document,
        dob: spouseData.dob || null,
        phone: spouseData.phone
      }).catch(err => console.error('Spouse error', err))
    }

    if (guarantorData) {
      await supabaseAdmin.from('ccb_avalistas').insert({
        ccb_id: ccbId,
        name: guarantorData.name,
        document: guarantorData.document,
        income: guarantorData.income ? Number(guarantorData.income) : null,
        address: guarantorData.address,
        phone: guarantorData.phone,
        relationship: guarantorData.relationship,
        docs_paths: docsPaths.guarantorDocs || []
      }).catch(err => console.error('Guarantor error', err))

      const avalDocs = [];
      if (docsPaths?.guarantor_rg) avalDocs.push({ ccb_id: ccbId, nome_arquivo: 'RG/CPF Avalista', url: docsPaths.guarantor_rg });
      if (docsPaths?.guarantor_income) avalDocs.push({ ccb_id: ccbId, nome_arquivo: 'Comprovante de Renda', url: docsPaths.guarantor_income });
      if (docsPaths?.guarantor_address) avalDocs.push({ ccb_id: ccbId, nome_arquivo: 'Comprovante de Residência', url: docsPaths.guarantor_address });

      if (avalDocs.length > 0) {
        await supabaseAdmin.from('ccb_avalistas_documentos').insert(avalDocs).catch(err => console.error('Guarantor docs error', err))
      }
    }

    return new Response(JSON.stringify({ success: true, data: ccbRecord }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("Generate CCB PDF Error: ", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
