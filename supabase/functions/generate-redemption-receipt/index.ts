import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { computeSha256Hex, drawQualifiedSignatureBlock } from '../_shared/qualified-signature.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { redemptionId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch company settings (singleton)
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const secRazao = (companyData?.razao_social || 'Nexum Securitizadora S.A.').toUpperCase()
    const secCnpj = companyData?.cnpj || '00.000.000/0001-00'
    const secCidade = (companyData?.endereco_cidade || 'Criciúma').trim()
    const secUf = (companyData?.endereco_uf || 'SC').trim()
    const secCidadeUf =
      secCidade && secUf ? `${secCidade}/${secUf}` : secCidade || secUf || 'Criciúma/SC'

    const secCepRaw = companyData?.endereco_cep || ''
    const secCepDigits = secCepRaw.replace(/\D/g, '')
    const secCepFmt =
      secCepDigits.length === 8 ? `${secCepDigits.slice(0, 5)}-${secCepDigits.slice(5)}` : secCepRaw

    const secEndParts = [
      companyData?.endereco_logradouro
        ? `${companyData.endereco_logradouro}${companyData.endereco_numero ? ', ' + companyData.endereco_numero : ''}${companyData.endereco_complemento ? ' - ' + companyData.endereco_complemento : ''}`
        : '',
      companyData?.endereco_bairro,
      secCidadeUf,
      secCepFmt ? `CEP: ${secCepFmt}` : '',
    ].filter(Boolean)
    const secEndereco = secEndParts.length > 0 ? secEndParts.join(' - ') : secCidadeUf

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

    page.drawText(secRazao.toUpperCase(), {
      x: 50,
      y: 800,
      font: fontBold,
      size: 13,
    })
    page.drawText(`CNPJ: ${secCnpj} | ${secEndereco}`, {
      x: 50,
      y: 785,
      font,
      size: 9,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText('COMPROVANTE DE LIQUIDAÇÃO DE RESGATE', {
      x: 50,
      y: 755,
      font: fontBold,
      size: 15,
    })
    page.drawText(`ID do Resgate: ${red.id.split('-')[0].toUpperCase()}`, {
      x: 50,
      y: 730,
      font,
      size: 11,
    })
    page.drawText(
      `Data da Liquidação: ${new Date(red.updated_at || red.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      { x: 50, y: 740, font, size: 12 },
    )

    page.drawText('Dados do Investidor:', { x: 50, y: 700, font: fontBold, size: 12 })
    page.drawText(`Nome: ${red.profiles?.full_name || red.profiles?.pj_company_name}`, {
      x: 50,
      y: 680,
      font,
      size: 12,
    })
    page.drawText(`Documento: ${red.profiles?.document_number}`, { x: 50, y: 660, font, size: 12 })

    page.drawText('Dados do Investimento:', { x: 50, y: 620, font: fontBold, size: 12 })
    page.drawText(`Produto: ${red.investments?.investment_products?.title}`, {
      x: 50,
      y: 600,
      font,
      size: 12,
    })
    page.drawText(`Cotas Resgatadas: ${red.requested_quotas}`, { x: 50, y: 580, font, size: 12 })

    page.drawText('Valores da Liquidação:', { x: 50, y: 540, font: fontBold, size: 12 })

    let curY = 520
    page.drawText(
      `Valor Bruto: R$ ${red.gross_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      { x: 50, y: curY, font, size: 12 },
    )
    curY -= 20

    if (red.yield_amount > 0) {
      page.drawText(
        `Rendimento (Base IR): R$ ${red.yield_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font, size: 12 },
      )
      curY -= 20
    }

    if (red.tax_amount > 0) {
      page.drawText(
        `Imposto Retido (IRRF ${red.tax_rate || 0}%): R$ ${red.tax_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) },
      )
      curY -= 20
    }

    if (red.penalty_applied > 0) {
      page.drawText(
        `Multa/Penalidade: R$ ${red.penalty_applied.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) },
      )
      curY -= 20
    }

    if (red.discount_applied > 0) {
      page.drawText(
        `Deságio: R$ ${red.discount_applied.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font, size: 12, color: rgb(0.8, 0, 0) },
      )
      curY -= 20
    }

    curY -= 20
    if (red.is_reinvestment) {
      const reinvestAmount =
        red.reinvestment_quotas *
        (red.investments?.investment_products?.quota_value ||
          red.investments?.investment_products?.min_investment ||
          1000)
      const troco = red.net_value - reinvestAmount

      page.drawText(
        `Valor Destinado a Reinvestimento: R$ ${reinvestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font: fontBold, size: 12, color: rgb(0, 0.3, 0.7) },
      )
      curY -= 20
      page.drawText(
        `Troco Creditado em Conta: R$ ${troco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font: fontBold, size: 12, color: rgb(0, 0.5, 0) },
      )
    } else {
      page.drawText(
        `Valor Líquido Creditado: R$ ${red.net_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { x: 50, y: curY, font: fontBold, size: 14, color: rgb(0, 0.5, 0) },
      )
    }

    curY -= 25
    page.drawText(
      'O investidor declara haver recebido o valor discriminado, conferindo à Securitizadora plena e irrevogável quitação.',
      { x: 50, y: curY, font, size: 8, color: rgb(0.3, 0.3, 0.3) },
    )
    curY -= 15

    const investidorNome = red.profiles?.full_name || red.profiles?.pj_company_name || 'Investidor'
    const investidorDoc = red.profiles?.document_number || 'N/A'
    const dataAceiteDoc = red.updated_at || red.created_at || new Date().toISOString()
    const valorLiqNum = red.net_value || 0

    const hashPayload = `RESGATE_RECIBO:${red.id}:${investidorDoc}:${valorLiqNum}:${dataAceiteDoc}`
    const shaHex = await computeSha256Hex(hashPayload)
    const formattedSha = `SHA256-${shaHex.substring(0, 32).toUpperCase()}`

    // BLOCO DE ASSINATURA ELETRÔNICA QUALIFICADA
    drawQualifiedSignatureBlock(
      {
        page,
        startX: 50,
        startY: curY,
        width: 495.28,
        fontRegular: font,
        fontBold: fontBold,
      },
      {
        cidade: secCidade,
        uf: secUf,
        dataCelebracao: red.created_at,
        dataAceite: dataAceiteDoc,
        ipAddress: 'Conexão Autenticada via Plataforma Web/SSL',
        documentId: red.id,
        documentTypeLabel: 'Resgate / Liquidação',
        hashSha256: formattedSha,
        securitizadoraRazao: secRazao,
        securitizadoraRepNome: companyData?.representante_nome || 'Diretoria Executiva',
        securitizadoraRepCargo: companyData?.representante_cargo || 'Sócio-Administrador',
        securitizadoraRepCpf: companyData?.representante_cpf || null,
        securitizadoraPapel: 'Securitizadora / Pagadora',
        contraparteNome: investidorNome,
        contraparteDocumento: investidorDoc,
        contrapartePapel: 'Investidor / Titular do Resgate',
      },
    )

    // Rodapé de integridade
    page.drawText(`Hash de Integridade: ${formattedSha}`, {
      x: 50,
      y: 22,
      font,
      size: 7.5,
      color: rgb(0.5, 0.5, 0.5),
    })
    page.drawText('Documento emitido eletronicamente pela Plataforma Nexum - Página 1 de 1', {
      x: 270,
      y: 22,
      font,
      size: 7.5,
      color: rgb(0.5, 0.5, 0.5),
    })

    const pdfBytes = await pdfDoc.save()

    const fileName = `Comprovante_Resgate_${red.id.split('-')[0]}.pdf`
    const filePath = `receipts/${fileName}`
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })

    await supabase.storage
      .from('operation-docs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
    const { data: publicUrlData } = supabase.storage.from('operation-docs').getPublicUrl(filePath)

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
