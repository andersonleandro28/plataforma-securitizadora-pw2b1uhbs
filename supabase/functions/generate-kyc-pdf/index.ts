import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { computeSha256Hex, drawQualifiedSignatureBlock } from '../_shared/qualified-signature.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { userId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!profile) throw new Error('User not found')

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    page.drawText('Dossiê KYC - Plataforma Securitizadora', {
      x: 50,
      y: 790,
      font: fontBold,
      size: 16,
    })
    page.drawText(`Nome/Razão Social: ${profile.full_name || profile.pj_company_name || 'N/A'}`, {
      x: 50,
      y: 750,
      font,
      size: 12,
    })
    page.drawText(`Documento: ${profile.document_number || 'N/A'}`, {
      x: 50,
      y: 730,
      font,
      size: 12,
    })
    page.drawText(`Email: ${profile.email || 'N/A'}`, { x: 50, y: 710, font, size: 12 })
    page.drawText(
      `Data de Geração: ${new Date(Date.now() - 3 * 3600000).toLocaleString('pt-BR')}`,
      { x: 50, y: 690, font, size: 12 },
    )

    page.drawText(`Termos LGPD: ${profile.lgpd_accepted ? 'Aceito' : 'Pendente'}`, {
      x: 50,
      y: 650,
      font,
      size: 12,
    })
    page.drawText(`Risco PEP: ${profile.is_pep ? 'Sim' : 'Não'}`, { x: 50, y: 630, font, size: 12 })

    // Fetch Securitizadora Settings
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const secRazao = (companyData?.razao_social || 'NEXUM SECURITIZADORA S.A.').toUpperCase()
    const secCidade = (companyData?.endereco_cidade || 'Criciúma').trim()
    const secUf = (companyData?.endereco_uf || 'SC').trim()
    const secRepNome = companyData?.representante_nome || 'Diretoria Executiva'
    const secRepCargo = companyData?.representante_cargo || 'Sócio-Administrador'

    const nowIso = new Date().toISOString()
    const titNome = profile.full_name || profile.pj_company_name || 'Titular Cadastrado'
    const titDoc = profile.document_number || 'N/A'
    const hashPayload = `KYC_CADASTRO:${userId}:${titDoc}:${nowIso}`
    const shaHex = await computeSha256Hex(hashPayload)
    const formattedSha = `SHA256-${shaHex.substring(0, 32).toUpperCase()}`

    // Se a altura não for suficiente para o bloco de 145pt, permite quebra de página
    let targetPage = page
    let signStartY = 570
    if (signStartY - 145 < 45) {
      targetPage = pdfDoc.addPage([595.28, 841.89])
      signStartY = 841.89 - 50
    }

    // BLOCO DE ASSINATURA ELETRÔNICA QUALIFICADA
    drawQualifiedSignatureBlock(
      {
        page: targetPage,
        startX: 50,
        startY: signStartY,
        width: 495.28,
        fontRegular: font,
        fontBold: fontBold,
      },
      {
        cidade: secCidade,
        uf: secUf,
        dataCelebracao: profile.created_at || nowIso,
        dataAceite: nowIso,
        ipAddress: 'Conexão Autenticada via Plataforma Web/SSL',
        documentId: userId,
        documentTypeLabel: 'Cadastro / Dossiê KYC',
        hashSha256: formattedSha,
        securitizadoraRazao: secRazao,
        securitizadoraRepNome: secRepNome,
        securitizadoraRepCargo: secRepCargo,
        securitizadoraRepCpf: companyData?.representante_cpf || null,
        securitizadoraPapel: 'Securitizadora / Custodiante',
        contraparteNome: titNome,
        contraparteDocumento: titDoc,
        contrapartePapel: 'Titular / Cadastrado',
      },
    )

    const allPages = pdfDoc.getPages()
    const totalP = allPages.length
    for (let i = 0; i < totalP; i++) {
      const p = allPages[i]
      p.drawText(`Hash de Integridade: ${formattedSha}`, {
        x: 50,
        y: 25,
        font,
        size: 7.5,
        color: rgb(0.5, 0.5, 0.5),
      })
      p.drawText(
        `Documento emitido eletronicamente pela Plataforma Nexum - Página ${i + 1} de ${totalP}`,
        {
          x: 270,
          y: 25,
          font,
          size: 7.5,
          color: rgb(0.5, 0.5, 0.5),
        },
      )
    }

    const pdfBytes = await pdfDoc.save()
    const fileName = `KYC_${userId}.pdf`
    const filePath = `kyc/${fileName}`

    // Create a Blob to upload correctly
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    await supabase.storage
      .from('kyc-docs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    const { data: publicUrlData } = supabase.storage.from('kyc-docs').getPublicUrl(filePath)

    await supabase
      .from('profiles')
      .update({ kyc_consolidated_pdf: publicUrlData.publicUrl })
      .eq('id', userId)

    return new Response(JSON.stringify({ success: true, url: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
