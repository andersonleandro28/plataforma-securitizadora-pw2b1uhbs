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
    const { borrowerData, spouseData, operationData, bankData, guaranteesData, guarantorData, docsPaths } = await req.json()
    
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

    // 1. KYC
    drawH2('1. DADOS DO SOLICITANTE (KYC)', currentY); currentY -= 20
    page.drawText(`Nome: ${sanitize(borrowerData?.name).substring(0, 50)} | CPF/CNPJ: ${sanitize(borrowerData?.document)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
    page.drawText(`Endereço: ${sanitize(borrowerData?.street)}, ${sanitize(borrowerData?.number)} - ${sanitize(borrowerData?.city)}/${sanitize(borrowerData?.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20

    if (spouseData) {
      drawH2('2. DADOS DO CÔNJUGE', currentY); currentY -= 20
      page.drawText(`Nome: ${sanitize(spouseData.name).substring(0, 50)} | CPF: ${sanitize(spouseData.document)} | Tel: ${sanitize(spouseData.phone)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      page.drawText(`Endereço: ${sanitize(spouseData.street)}, ${sanitize(spouseData.number)} - ${sanitize(spouseData.city)}/${sanitize(spouseData.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20
    }

    if (guarantorData) {
      drawH2('3. DADOS DO AVALISTA', currentY); currentY -= 20
      page.drawText(`Nome: ${sanitize(guarantorData.name).substring(0, 50)} | CPF: ${sanitize(guarantorData.document)} | Renda: R$ ${sanitize(guarantorData.income)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      page.drawText(`Endereço: ${sanitize(guarantorData.street)}, ${sanitize(guarantorData.number)} - ${sanitize(guarantorData.city)}/${sanitize(guarantorData.state)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20
    }

    // OP & BANK
    drawH2('4. OPERAÇÃO E DADOS BANCÁRIOS', currentY); currentY -= 20
    page.drawText(`Tipo Crédito: ${sanitize(operationData?.creditType).substring(0, 70)}`, { x: margin, y: currentY, font: fontBold, size: 10 }); currentY -= 15
    page.drawText(`Valor Solicitado: R$ ${Number(operationData?.requestedValue || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})} | Prazo: ${sanitize(operationData?.termMonths)} meses`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
    
    const sim = operationData?.simulation || {}
    const iofFixo = sim.iof_fixo || 0
    const iofDiario = sim.iof_diario || 0
    const totalIof = sim.total_iof || 0
    const custoFixo = sim.fixed_cost || 0
    const parcelaFinal = sim.installment_value || 0

    page.drawText(`Custo Fixo Emissão: R$ ${custoFixo.toLocaleString('pt-BR', {minimumFractionDigits:2})} | Parcela Mensal: R$ ${parcelaFinal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
    page.drawText(`Detalhamento IOF: Fixo (0.38%) R$ ${iofFixo.toLocaleString('pt-BR', {minimumFractionDigits:2})} + Diário R$ ${iofDiario.toLocaleString('pt-BR', {minimumFractionDigits:2})} = Total R$ ${totalIof.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15

    if (bankData) {
      page.drawText(`Dados Recebimento: Banco ${sanitize(bankData.bank)} | Agência ${sanitize(bankData.branch)} | Conta ${sanitize(bankData.account)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 15
      page.drawText(`Titular: ${sanitize(bankData.owner_name)} (${sanitize(bankData.owner_document)}) | PIX: ${sanitize(bankData.pix_key)}`, { x: margin, y: currentY, font, size: 10 }); currentY -= 20
    }

    // DOCS SUMMARY
    drawH2('5. RESUMO DE DOCUMENTAÇÃO', currentY); currentY -= 20
    const keys = Object.keys(docsPaths || {}).map(k => k.replace(/_/g, ' ')).join(', ')
    page.drawText(`Documentos enviados via sistema: ${keys.substring(0, 150)}...`, { x: margin, y: currentY, font, size: 10 })

    const pdfBytes = await pdfDoc.save()
    const fileName = `Dossie_CCB_${ccbId.substring(0,8)}.pdf`
    const filePath = `${user.id}/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    await supabaseAdmin.storage.from('ccb-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf' })

    const { data: ccbRecord, error: dbErr } = await supabaseAdmin.from('ccb_solicitacoes').insert({
        id: ccbId, user_id: user.id, requested_value: operationData?.requestedValue || 0,
        term_months: operationData?.termMonths || 0, borrower_data: borrowerData || {}, operation_data: operationData || {},
        guarantees_data: guaranteesData || {}, docs_paths: docsPaths || {}, pdf_file_path: filePath, status: 'pendente'
    }).select().single()
    if (dbErr) throw dbErr

    if (spouseData) {
      await supabaseAdmin.from('usuarios_conjuges').insert({
        ccb_id: ccbId, user_id: user.id, name: spouseData.name, document: spouseData.document,
        dob: spouseData.dob || null, phone: spouseData.phone, email: spouseData.email, zip: spouseData.zip,
        street: spouseData.street, number: spouseData.number, neighborhood: spouseData.neighborhood,
        city: spouseData.city, state: spouseData.state, docs_paths: docsPaths || {}
      })
    }
    if (guarantorData) {
      await supabaseAdmin.from('usuarios_avalistas').insert({
        ccb_id: ccbId, user_id: user.id, name: guarantorData.name, document: guarantorData.document,
        dob: guarantorData.dob || null, phone: guarantorData.phone, email: guarantorData.email, zip: guarantorData.zip,
        street: guarantorData.street, number: guarantorData.number, neighborhood: guarantorData.neighborhood,
        city: guarantorData.city, state: guarantorData.state, income: guarantorData.income ? Number(guarantorData.income) : null,
        relationship: guarantorData.relationship, docs_paths: docsPaths || {}
      })
    }
    if (bankData) {
      await supabaseAdmin.from('dados_bancarios_ccb').insert({
        ccb_id: ccbId, user_id: user.id, bank: bankData.bank, branch: bankData.branch, account: bankData.account,
        owner_name: bankData.owner_name, owner_document: bankData.owner_document, pix_key: bankData.pix_key, docs_paths: docsPaths || {}
      })
    }

    return new Response(JSON.stringify({ success: true, data: ccbRecord }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
