import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const { investmentId, ipAddress } = await req.json()
    if (!investmentId) throw new Error('investmentId is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: inv, error } = await supabase
      .from('investments')
      .select('*, profiles(*), investment_products(*)')
      .eq('id', investmentId)
      .single()

    if (error || !inv) throw new Error('Investimento não encontrado')

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    const margin = 50
    let currentY = 841.89 - margin

    const drawTextWrap = (text: string, x: number, y: number, maxWidth: number, f: any, size: number) => {
      const words = text.split(' ')
      let line = ''
      for (const word of words) {
        const testLine = line + word + ' '
        const testWidth = f.widthOfTextAtSize(testLine, size)
        if (testWidth > maxWidth && line !== '') {
          page.drawText(line.trim(), { x, y, font: f, size, color: rgb(0, 0, 0) })
          line = word + ' '
          y -= size * 1.5
        } else {
          line = testLine
        }
      }
      if (line !== '') {
        page.drawText(line.trim(), { x, y, font: f, size, color: rgb(0, 0, 0) })
        y -= size * 1.5
      }
      return y
    }

    page.drawText('TERMO DE INVESTIMENTO EM DEBÊNTURES', { x: margin, y: currentY, font: fontBold, size: 14 })
    currentY -= 30

    const pu = inv.unit_price
    const total = inv.total_value

    const content = `
CEDENTE/EMISSORA: Sea Connection Investimentos S.A.
INVESTIDOR: ${inv.profiles?.full_name || inv.profiles?.pj_company_name || 'N/A'}
CPF/CNPJ: ${inv.profiles?.document_number || 'N/A'}
E-MAIL: ${inv.profiles?.email || 'N/A'}
ENDEREÇO: ${inv.profiles?.address_street || 'N/A'}, ${inv.profiles?.address_number || 'N/A'} - ${inv.profiles?.address_city || 'N/A'}/${inv.profiles?.address_state || 'N/A'}

PRODUTO: ${inv.investment_products?.title || 'N/A'}

CLÁUSULA 1 - DO OBJETO
O presente termo tem como objeto a subscrição, pelo INVESTIDOR, de ${inv.quotas} cotas do produto ${inv.investment_products?.title}, no valor unitário de R$ ${pu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, totalizando o montante de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.

CLÁUSULA 2 - DO VALOR E INTEGRALIZAÇÃO
O INVESTIDOR compromete-se a integralizar o valor total de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via transferência bancária (PIX/TED) para a conta da emissora, sob pena de cancelamento desta subscrição caso o valor não seja compensado.

CLÁUSULA 3 - DA RENTABILIDADE E PRAZOS
O investimento terá a rentabilidade alvo de ${inv.investment_products?.rate || 'N/A'}, com prazo de vencimento para ${inv.investment_products?.term || 'N/A'}. O resgate antecipado obedece ao prazo de carência mínimo de ${inv.investment_products?.min_grace_period_months || 0} meses e ao regulamento específico da emissão.

CLÁUSULA 4 - DOS RISCOS
O INVESTIDOR declara expressa ciência de que o investimento em debêntures está sujeito a riscos de mercado, liquidez e de crédito, não contando com garantia do Fundo Garantidor de Créditos (FGC).

CLÁUSULA 5 - DA PROTEÇÃO DE DADOS (LGPD)
O INVESTIDOR autoriza o tratamento de seus dados pessoais para as finalidades de execução deste contrato, auditoria e compliance, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).

CLÁUSULA 6 - DO FORO
As partes elegem o foro da Comarca de Criciúma/SC para dirimir quaisquer dúvidas oriundas deste termo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Assinatura Eletrônica vinculada ao acesso autenticado na Plataforma Securitizadora.
Data/Hora do Aceite: ${new Date().toLocaleString('pt-BR')}
IP Registrado: ${ipAddress || 'Não identificado'}
ID Subscrição: ${inv.id}
    `.trim()

    currentY = drawTextWrap(content.replace(/\n/g, ' \n '), margin, currentY, 595.28 - margin * 2, font, 11)

    const pdfBytes = await pdfDoc.save()
    const fileName = `Termo_Subscricao_${inv.id.substring(0,8)}.pdf`
    const filePath = `${inv.user_id}/${fileName}`
    
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    await supabase.storage.from('investment-docs').upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
    
    const { data: publicUrlData } = supabase.storage.from('investment-docs').getPublicUrl(filePath)

    await supabase.from('investments').update({ contract_url: publicUrlData.publicUrl }).eq('id', investmentId)

    // Send Email
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey && inv.profiles?.email) {
      let binary = '';
      const len = pdfBytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(pdfBytes[i]);
      }
      const base64Pdf = btoa(binary);

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
          to: [inv.profiles.email],
          subject: `Termo de Subscrição Formalizado - ${inv.investment_products?.title}`,
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Subscrição de Investimento Iniciada</h2>
              <p>Olá ${inv.profiles?.full_name || inv.profiles?.pj_company_name},</p>
              <p>Sua subscrição foi formalizada digitalmente com sucesso. Segue em anexo o <strong>Termo de Investimento em Debêntures</strong>.</p>
              <p>O próximo passo é realizar a transferência (PIX/TED) para concluir a integralização da sua cota, utilizando a aba de investimentos da plataforma.</p>
              <br/>
              <p>Atenciosamente,<br/>Equipe Sea Connection Investimentos S.A.</p>
            </div>
          `,
          attachments: [
            {
              filename: fileName,
              content: base64Pdf,
            }
          ]
        })
      })
    }

    return new Response(JSON.stringify({ success: true, url: publicUrlData.publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
