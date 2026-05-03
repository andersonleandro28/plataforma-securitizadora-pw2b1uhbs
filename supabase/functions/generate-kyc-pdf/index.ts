import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'

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

    page.drawLine({ start: { x: 50, y: 550 }, end: { x: 250, y: 550 }, thickness: 1 })
    page.drawText('Assinatura Eletrônica do Usuário', { x: 50, y: 535, font, size: 10 })

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
