import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { redemptionId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: red, error } = await supabase
      .from('investment_redemptions')
      .select('*, investments(*, investment_products(*)), profiles(*)')
      .eq('id', redemptionId)
      .single()

    if (error || !red) throw new Error('Resgate não encontrado')

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    page.drawText('COMPROVANTE DE LIQUIDAÇÃO DE RESGATE', { x: 50, y: 790, font: fontBold, size: 16 })
    page.drawText(`ID do Resgate: ${red.id.split('-')[0].toUpperCase()}`, { x: 50, y: 760, font, size: 12 })
    page.drawText(`Data da Liquidação: ${new Date(red.updated_at || red.created_at).toLocaleDateString('pt-BR')}`, { x: 50, y: 740, font, size: 12 })
    
    page.drawText('Dados do Investidor:', { x: 50, y: 700, font: fontBold, size: 12 })
    page.drawText(`Nome: ${red.profiles?.full_name || red.profiles?.pj_company_name}`, { x: 50, y: 680, font, size: 12 })
    page.drawText(`Documento: ${red.profiles?.document_number}`, { x: 50, y: 660, font, size: 12 })

    page.drawText('Dados do Investimento:', { x: 50, y: 620, font: fontBold, size: 12 })
    page.drawText(`Produto: ${red.investments?.investment_products?.title}`, { x: 50, y: 600, font, size: 12 })
    page.drawText(`Cotas Resgatadas: ${red.requested_quotas}`, { x: 50, y: 580, font, size: 12 })

    page.drawText('Valores da Liquidação:', { x: 50, y: 540, font: fontBold, size: 12 })
    
    let curY = 520
    page.drawText(`Valor Bruto: R$ ${red.gross_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font, size: 12 })
    curY -= 20

    if (red.yield_amount > 0) {
      page.drawText(`Rendimento (Base IR): R$ ${red.yield_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font, size: 12 })
      curY -= 20
    }

    if (red.tax_amount > 0) {
      page.drawText(`Imposto Retido (IRRF ${red.tax_rate || 0}%): R$ ${red.tax_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) })
      curY -= 20
    }

    if (red.penalty_applied > 0) {
      page.drawText(`Multa/Penalidade: R$ ${red.penalty_applied.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) })
      curY -= 20
    }
    
    if (red.discount_applied > 0) {
      page.drawText(`Deságio: R$ ${red.discount_applied.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) })
      curY -= 20
    }

    curY -= 20
    page.drawText(`Valor Líquido Creditado: R$ ${red.net_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { x: 50, y: curY, font: fontBold, size: 14, color: rgb(0, 0.5, 0) })
    
    curY -= 40
    page.drawLine({ start: { x: 50, y: curY }, end: { x: 545, y: curY }, thickness: 1 })
    curY -= 20
    page.drawText('Este documento é emitido digitalmente pela Plataforma Securitizadora e serve como recibo legal de liquidação.', { x: 50, y: curY, font, size: 9, color: rgb(0.3, 0.3, 0.3) })

    const pdfBytes = await pdfDoc.save()
    
    const fileName = `Comprovante_Resgate_${red.id.split('-')[0]}.pdf`
    const filePath = `receipts/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    await supabase.storage.from('operation-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
    const { data: publicUrlData } = supabase.storage.from('operation-docs').getPublicUrl(filePath)

    return new Response(JSON.stringify({ success: true, url: publicUrlData.publicUrl }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
