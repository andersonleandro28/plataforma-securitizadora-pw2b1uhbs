import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

interface FormattedParagraph {
  text: string
  isTitle?: boolean
  isSectionHeader?: boolean
  isBold?: boolean
  align?: 'left' | 'center' | 'justify'
  spaceAfter?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { investmentId, ipAddress, sendEmail = true, forceRegenerate = false } = await req.json()
    if (!investmentId) throw new Error('investmentId is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch Company Settings
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const secRazao = companyData?.razao_social || 'SEA CONNECTION INVESTIMENTOS S/A'
    const secNomeFantasia = companyData?.nome_fantasia || 'Sea Connection'
    const secCnpj = companyData?.cnpj || '60.703.936/0001-00'
    const secCidade = companyData?.endereco_cidade || 'Criciúma'
    const secUf = companyData?.endereco_uf || 'SC'
    const secEndParts = [
      companyData?.endereco_logradouro
        ? `${companyData.endereco_logradouro}${companyData.endereco_numero ? ', ' + companyData.endereco_numero : ''}${companyData.endereco_complemento ? ' - ' + companyData.endereco_complemento : ''}`
        : '',
      companyData?.endereco_bairro,
      `${secCidade}/${secUf}`,
      companyData?.endereco_cep ? `CEP: ${companyData.endereco_cep}` : '',
    ].filter(Boolean)
    const secEndereco = secEndParts.length > 0 ? secEndParts.join(' - ') : 'Criciúma/SC'
    const secRepNome = companyData?.representante_nome || 'Anderson Cardozo Leandro'
    const secRepCargo = companyData?.representante_cargo || 'Diretor Presidente'
    const secRepCpf = companyData?.representante_cpf || '020.936.129-84'
    const secRegulador = companyData?.registro_regulador || 'Lei das S.A. (Lei 6.404/76)'
    const secEscrituraPadrao =
      companyData?.debenture_numero_escritura_padrao ||
      '1ª Escritura de Emissão Pública de Debêntures'
    const secSeriePadrao = companyData?.debenture_serie_padrao || '1ª Série'

    // 2. Fetch Investment and Related Product + Debenture Info
    const { data: inv, error } = await supabase
      .from('investments')
      .select(`
        *,
        profiles (*),
        investment_products (
          *,
          debenture_series (
            *,
            debentures (*)
          )
        )
      `)
      .eq('id', investmentId)
      .single()

    if (error || !inv) throw new Error('Investimento não encontrado')

    // If contract_url already exists and forceRegenerate is false, return existing url directly
    if (inv.contract_url && !forceRegenerate && !sendEmail) {
      return new Response(JSON.stringify({ success: true, url: inv.contract_url, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prod = inv.investment_products || {}
    const series = prod.debenture_series || {}
    const debenture = series.debentures || {}

    // Identificação de Escritura e Série com fallback seguro
    const numeroEscritura =
      debenture.numero_escritura || debenture.issuer_name
        ? `${debenture.numero_escritura || '1ª Escritura de Emissão Pública'}`
        : secEscrituraPadrao
    const numeroEmissao = debenture.numero_emissao || '1ª Emissão'
    const serieIdentificacao = series.series_number
      ? `Série ${series.series_number}`
      : secSeriePadrao
    const taxaDebenture = prod.rate || (series.rate ? `${series.rate}% a.a.` : '18% a.a.')
    const indexadorDebenture = series.indexer || 'Pré-fixado'
    const regimeJuros =
      prod.interest_type === 'composto'
        ? 'Juros Compostos (capitalização mensal/anual exponencial)'
        : 'Juros Simples (capitalização linear pro rata die)'
    const prazoVencimento =
      prod.term ||
      (series.maturity_date
        ? `Vencimento em ${new Date(series.maturity_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
        : '24 meses')
    const carenciaMeses = prod.min_grace_period_months ?? 0
    const permiteResgateAntecipado = prod.allow_early_redemption ?? false
    const multaPrincipal = prod.early_redemption_penalty_pct ?? 0
    const descontoRendimento = prod.early_redemption_discount_pct ?? 0

    // Dados do Investidor
    const invNome = inv.profiles?.full_name || inv.profiles?.pj_company_name || 'Investidor'
    const invDocumento = inv.profiles?.document_number || 'N/A'
    const invEmail = inv.profiles?.email || 'N/A'
    const invEnderecoPartes = [
      inv.profiles?.address_street
        ? `${inv.profiles.address_street}${inv.profiles.address_number ? ', ' + inv.profiles.address_number : ''}${inv.profiles.address_complement ? ' - ' + inv.profiles.address_complement : ''}`
        : '',
      inv.profiles?.address_neighborhood,
      inv.profiles?.address_city && inv.profiles?.address_state
        ? `${inv.profiles.address_city}/${inv.profiles.address_state}`
        : '',
      inv.profiles?.address_zip ? `CEP: ${inv.profiles.address_zip}` : '',
    ].filter(Boolean)
    const invEndereco =
      invEnderecoPartes.length > 0
        ? invEnderecoPartes.join(' - ')
        : 'Endereço cadastrado na plataforma'

    const pu = Number(inv.unit_price) || Number(prod.quota_value) || 1000
    const total = Number(inv.total_value) || Number(inv.quotas) * pu
    const qtdCotas = Number(inv.quotas) || 1

    // Data de celebração / subscrição
    const dataCriacao = inv.created_at ? new Date(inv.created_at) : new Date()
    const dataCelebracaoFmt = dataCriacao.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })
    const dataHoraFmt = dataCriacao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    // 3. Montar o PDF multipáginas com formatação profissional
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 50
    const contentWidth = pageWidth - margin * 2

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let currentY = pageHeight - margin

    const addNewPageIfNeeded = (neededHeight: number): void => {
      if (currentY - neededHeight < margin + 30) {
        // Rodapé na página anterior
        drawFooter(currentPage)
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        currentY = pageHeight - margin
        drawHeader(currentPage)
      }
    }

    const drawHeader = (page: any) => {
      page.drawText(`${secRazao} • INSTRUMENTO PARTICULAR DE SUBSCRIÇÃO DE DEBÊNTURES`, {
        x: margin,
        y: pageHeight - 35,
        font: fontOblique,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
      })
      page.drawLine({
        start: { x: margin, y: pageHeight - 40 },
        end: { x: pageWidth - margin, y: pageHeight - 40 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
    }

    const drawFooter = (page: any) => {
      page.drawLine({
        start: { x: margin, y: margin + 20 },
        end: { x: pageWidth - margin, y: margin + 20 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
      page.drawText(
        `Nexum Security 360º • Escritura: ${numeroEscritura} • ${serieIdentificacao} • Autenticação: ${inv.id.substring(0, 13)}`,
        {
          x: margin,
          y: margin + 8,
          font: font,
          size: 7.5,
          color: rgb(0.5, 0.5, 0.5),
        },
      )
    }

    const drawTextWrap = (
      text: string,
      x: number,
      maxWidth: number,
      f: any,
      size: number,
      lineHeightMultiplier = 1.35,
      textColor = rgb(0.1, 0.1, 0.1),
    ): number => {
      const words = text.split(/\s+/)
      let line = ''
      const lineHeight = size * lineHeightMultiplier

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word
        const testWidth = f.widthOfTextAtSize(testLine, size)
        if (testWidth > maxWidth && line !== '') {
          addNewPageIfNeeded(lineHeight)
          currentPage.drawText(line, { x, y: currentY, font: f, size, color: textColor })
          currentY -= lineHeight
          line = word
        } else {
          line = testLine
        }
      }

      if (line !== '') {
        addNewPageIfNeeded(lineHeight)
        currentPage.drawText(line, { x, y: currentY, font: f, size, color: textColor })
        currentY -= lineHeight
      }

      return currentY
    }

    // CABEÇALHO DO DOCUMENTO (CAPA FORMAL)
    drawHeader(currentPage)

    // Título Principal
    currentPage.drawText('INSTRUMENTO PARTICULAR DE SUBSCRIÇÃO E INTEGRALIZAÇÃO', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 13,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 18

    currentPage.drawText('DE DEBÊNTURES PRIVADAS NOMINATIVAS E ESCRITURAIS', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 11,
      color: rgb(0.12, 0.22, 0.4),
    })
    currentY -= 20

    // Caixa de Destaque da Escritura e Série
    const boxHeight = 44
    currentPage.drawRectangle({
      x: margin,
      y: currentY - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.7, 0.78, 0.9),
      borderWidth: 1,
    })

    currentPage.drawText(`ESCRITURA DE EMISSÃO: ${numeroEscritura.toUpperCase()}`, {
      x: margin + 12,
      y: currentY - 16,
      font: fontBold,
      size: 9.5,
      color: rgb(0.1, 0.2, 0.4),
    })

    currentPage.drawText(
      `SÉRIE: ${serieIdentificacao.toUpperCase()}   |   EMISSÃO: ${numeroEmissao.toUpperCase()}   |   PRODUTO: ${(prod.title || 'Debênture').toUpperCase()}`,
      {
        x: margin + 12,
        y: currentY - 32,
        font: font,
        size: 8.5,
        color: rgb(0.25, 0.3, 0.4),
      },
    )

    currentY -= boxHeight + 18

    // PARÁGRAFOS DO CONTRATO
    const secoes: FormattedParagraph[] = [
      {
        text: 'PREÂMBULO — QUALIFICAÇÃO DAS PARTES',
        isSectionHeader: true,
      },
      {
        text: `DE UM LADO, na qualidade de EMISSORA, ${secRazao}, sociedade anônima fechada, inscrita no CNPJ sob o nº ${secCnpj}, com sede e foro na cidade de ${secEndereco}, neste ato representada por seu ${secRepCargo}, Sr. ${secRepNome}, inscrito no CPF sob o nº ${secRepCpf}, doravante denominada simplesmente "EMISSORA"; e,`,
      },
      {
        text: `DE OUTRO LADO, na qualidade de INVESTIDOR E SUBSCRITOR (DEBENTURISTA), ${invNome}, inscrito no CPF/CNPJ sob o nº ${invDocumento}, com endereço em ${invEndereco}, endereço eletrônico registrado ${invEmail}, doravante denominado simplesmente "DEBENTURISTA" ou "INVESTIDOR";`,
      },
      {
        text: 'Têm entre si, justo, contratado e reciprocamente outorgado o presente Instrumento Particular de Subscrição e Integralização de Debêntures, que se regerá pelas disposições da Lei Federal nº 6.404/76 (Lei das Sociedades por Ações, arts. 52 e seguintes), Lei Federal nº 6.385/76 (Mercado de Capitais e normativos da CVM aplicáveis a emissões fechadas), Lei Federal nº 10.406/2002 (Código Civil), e pelas cláusulas e condições seguintes:',
      },
      {
        text: 'CLÁUSULA PRIMEIRA — DO OBJETO E DA SUBSCRIÇÃO',
        isSectionHeader: true,
      },
      {
        text: `1.1. O presente instrumento tem por objeto irrevogável e irretratável a subscrição, pelo DEBENTURISTA, de ${qtdCotas} (${qtdCotas === 1 ? 'uma cota' : qtdCotas + ' cotas'}) debênture(s) privada(s), nominativa(s) e escritural(is) vinculada(s) à ${serieIdentificacao} da ${numeroEscritura}, emitida pela EMISSORA sob a denominação comercial de "${prod.title || 'Debênture Privada'}".`,
      },
      {
        text: `1.2. O Valor Nominal Unitário (PU de emissão) da debênture é de R$ ${pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, perfazendo o montante total subscrito de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      },
      {
        text: 'CLÁUSULA SEGUNDA — DA INTEGRALIZAÇÃO E FORMA DE PAGAMENTO',
        isSectionHeader: true,
      },
      {
        text: `2.1. O DEBENTURISTA compromete-se a integralizar o valor total de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em moeda corrente nacional, via transferência bancária eletrônica (PIX ou TED) para a conta corrente de titularidade da EMISSORA cadastrada na plataforma oficial.`,
      },
      {
        text: '2.2. A confirmação da subscrição e a respectiva emissão do certificado escritural ficam expressamente condicionadas à efetiva e irretratável compensação financeira dos fundos na conta da EMISSORA, sob pena de cancelamento automático do presente termo em caso de inadimplemento da transferência.',
      },
      {
        text: 'CLÁUSULA TERCEIRA — DA REMUNERAÇÃO, RENTABILIDADE E REGIME DE CAPITALIZAÇÃO',
        isSectionHeader: true,
      },
      {
        text: `3.1. Sobre o valor nominal integralizado incidirá a remuneração contratada correspondente à taxa de ${taxaDebenture} (${indexadorDebenture}), apurada e devida desde a data do efetivo crédito dos recursos na conta da EMISSORA (Data de Início da Remuneração / Aporte).`,
      },
      {
        text: `3.2. A apuração da remuneração obedecerá ao regime de ${regimeJuros}, calculada pro rata die com base em ano de 365 dias corridos, observadas as melhores práticas de matemática financeira e o regulamento particular do produto.`,
      },
      {
        text: 'CLÁUSULA QUARTA — DO PRAZO, VENCIMENTO, RESGATE E AMORTIZAÇÃO',
        isSectionHeader: true,
      },
      {
        text: `4.1. O prazo de vigência desta debênture é de ${prazoVencimento}, data em que a EMISSORA realizará o resgate integral do saldo devedor das debêntures acrescido dos rendimentos acumulados devidos ao DEBENTURISTA.`,
      },
      {
        text: `4.2. Carência e Resgate Antecipado: O investimento fica sujeito ao prazo de carência mínima obrigatória de ${carenciaMeses} (${carenciaMeses === 1 ? 'um mês' : carenciaMeses + ' meses'}), contado a partir da data da integralização do aporte. ${
          permiteResgateAntecipado
            ? `Após decorrido o prazo de carência, o DEBENTURISTA poderá solicitar o resgate total ou parcial de suas cotas diretamente via plataforma. Na hipótese de liquidação extraordinária antes do vencimento final, incidirão os parâmetros pré-fixados: multa sobre o principal de ${multaPrincipal}% e desconto de ${descontoRendimento}% sobre a remuneração acumulada, garantindo o equilíbrio econômico da carteira de securitização.`
            : 'Fica vedado o resgate antecipado antes do término do prazo contratual da série, salvo expressa concordância e deliberação da EMISSORA.'
        }`,
      },
      {
        text: 'CLÁUSULA QUINTA — DA ESCRITURA DE EMISSÃO, DIREITOS E CONSELHO DE DEBENTURISTAS',
        isSectionHeader: true,
      },
      {
        text: `5.1. A presente subscrição é regida e subordinada a todos os termos, condições e prerrogativas previstos na Escritura de Emissão (${numeroEscritura}), à qual o DEBENTURISTA expressamente adere neste ato para todos os fins de direito.`,
      },
      {
        text: '5.2. As debêntures conferem ao seu titular os direitos creditórios patrimoniais correspondentes ao valor nominal unitário acrescido da respectiva remuneração, gozando das prerrogativas previstas no art. 52 e seguintes da Lei 6.404/76. Quando legalmente cabível ou deliberado pela emissora, os debenturistas poderão constituir Conselho de Debenturistas para defesa e fiscalização dos interesses comuns da comunhão.',
      },
      {
        text: 'CLÁUSULA SEXTA — DO TRATAMENTO TRIBUTÁRIO (IRRF)',
        isSectionHeader: true,
      },
      {
        text: '6.1. Os rendimentos decorrentes desta aplicação estão sujeitos à incidência do Imposto de Renda Retido na Fonte (IRRF) conforme a tabela regressiva das operações de renda fixa (Lei 11.033/2004: 22,5% até 180 dias; 20% de 181 a 360 dias; 17,5% de 361 a 720 dias; 15% acima de 720 dias). A EMISSORA reterá na fonte e recolherá os tributos incidentes na forma da lei no momento de cada resgate ou liquidação, sendo todos os rendimentos contratados informados em valores brutos.',
      },
      {
        text: 'CLÁUSULA SÉTIMA — DA DECLARAÇÃO DE CIÊNCIA DE RISCOS',
        isSectionHeader: true,
      },
      {
        text: '7.1. O DEBENTURISTA declara expressamente ter plena ciência de que as debêntures emitidas por securitizadoras privadas constituem títulos de crédito de renda fixa sem garantia do Fundo Garantidor de Créditos (FGC), estando expostas aos riscos normais de crédito da emissora, liquidez e flutuações de mercado.',
      },
      {
        text: 'CLÁUSULA OITAVA — DA SUB-ROGAÇÃO, CESSÃO E INADIMPLEMENTO',
        isSectionHeader: true,
      },
      {
        text: '8.1. É vedada a cessão ou transferência das debêntures a terceiros sem prévia comunicação e validação escritural perante a EMISSORA, assegurado o registro das anotações no livro próprio ou sistema eletrônico de registro escritural da emissão.',
      },
      {
        text: 'CLÁUSULA NONA — DA PROTEÇÃO DE DADOS (LGPD)',
        isSectionHeader: true,
      },
      {
        text: '9.1. As partes comprometem-se a cumprir integralmente as normas da Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018), autorizando reciprocamente o tratamento estritamente necessário para cumprimento de obrigações regulatórias, fiscais e contratuais.',
      },
      {
        text: 'CLÁUSULA DÉCIMA — DO FORO DE ELEIÇÃO',
        isSectionHeader: true,
      },
      {
        text: `10.1. As partes elegem com expressa renúncia a qualquer outro, por mais privilegiado que seja, o Foro da Comarca de ${secCidade}, Estado de ${secUf}, para dirimir quaisquer dúvidas, controvérsias ou execuções decorrentes deste Instrumento.`,
      },
    ]

    // Renderiza cada seção
    for (const item of secoes) {
      if (item.isSectionHeader) {
        addNewPageIfNeeded(28)
        currentY -= 8
        currentPage.drawText(item.text, {
          x: margin,
          y: currentY,
          font: fontBold,
          size: 10,
          color: rgb(0.1, 0.22, 0.42),
        })
        currentY -= 14
      } else {
        currentY = drawTextWrap(item.text, margin, contentWidth, font, 8.5, 1.35)
        currentY -= 6
      }
    }

    // BLOCO DE ASSINATURA ELETRÔNICA
    addNewPageIfNeeded(160)
    currentY -= 12

    currentPage.drawRectangle({
      x: margin,
      y: currentY - 145,
      width: contentWidth,
      height: 145,
      color: rgb(0.97, 0.98, 1.0),
      borderColor: rgb(0.65, 0.75, 0.9),
      borderWidth: 1,
    })

    currentPage.drawText('FORMALIZAÇÃO E ASSINATURA ELETRÔNICA QUALIFICADA', {
      x: margin + 14,
      y: currentY - 18,
      font: fontBold,
      size: 9.5,
      color: rgb(0.08, 0.18, 0.36),
    })

    const infoSign = [
      `Assinado digitalmente nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.`,
      `Data e Local da Celebração: ${secCidade}/${secUf}, ${dataCelebracaoFmt}.`,
      `Data/Hora do Aceite Eletrônico: ${dataHoraFmt} (Horário de Brasília).`,
      `Endereço IP Registrado: ${ipAddress || 'Conexão Autenticada via Plataforma Web/SSL'}.`,
      `Código Identificador do Aporte: ${inv.id}`,
      `Hash de Autenticidade Escritural: SHA256-${inv.id.replace(/-/g, '').substring(0, 24).toUpperCase()}`,
    ]

    let signY = currentY - 34
    for (const line of infoSign) {
      currentPage.drawText(line, {
        x: margin + 14,
        y: signY,
        font: font,
        size: 8,
        color: rgb(0.2, 0.25, 0.35),
      })
      signY -= 12
    }

    // Linhas de assinatura
    signY -= 10
    currentPage.drawLine({
      start: { x: margin + 20, y: signY },
      end: { x: margin + 220, y: signY },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    })
    currentPage.drawLine({
      start: { x: margin + 260, y: signY },
      end: { x: margin + 460, y: signY },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    })

    currentPage.drawText(`${secRazao}\n${secRepNome} - ${secRepCargo}`, {
      x: margin + 20,
      y: signY - 12,
      font: fontBold,
      size: 7.5,
      color: rgb(0.1, 0.1, 0.1),
    })

    currentPage.drawText(`${invNome}\nDebenturista - CPF/CNPJ: ${invDocumento}`, {
      x: margin + 260,
      y: signY - 12,
      font: fontBold,
      size: 7.5,
      color: rgb(0.1, 0.1, 0.1),
    })

    // Adiciona rodapé na última página
    drawFooter(currentPage)

    // 4. Salvar PDF e gravar no Supabase Storage
    const pdfBytes = await pdfDoc.save()
    const fileName = `Termo_Subscricao_${inv.id.substring(0, 8)}.pdf`
    const filePath = `${inv.user_id}/${fileName}`

    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    await supabase.storage
      .from('investment-docs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    const { data: publicUrlData } = supabase.storage.from('investment-docs').getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    // 5. Atualizar tabela investments com o contract_url
    await supabase.from('investments').update({ contract_url: publicUrl }).eq('id', investmentId)

    // 6. Enviar E-mail ao Investidor apenas se solicitado (idempotência no re-download)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (sendEmail && resendApiKey && inv.profiles?.email) {
      try {
        let binary = ''
        const len = pdfBytes.byteLength
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(pdfBytes[i])
        }
        const base64Pdf = btoa(binary)

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
            to: [inv.profiles.email],
            subject: `Contrato de Subscrição de Debêntures - ${prod.title || 'Debênture'}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                <h2 style="color: #0c2340;">Termo de Subscrição de Debêntures Formalizado</h2>
                <p>Prezado(a) <strong>${invNome}</strong>,</p>
                <p>Seu <strong>Instrumento Particular de Subscrição e Integralização de Debêntures</strong> foi formalizado com sucesso na plataforma <strong>${secRazao}</strong>.</p>
                <div style="background-color: #f4f6f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0 0 8px;"><strong>Escritura de Emissão:</strong> ${numeroEscritura}</p>
                  <p style="margin: 0 0 8px;"><strong>Série:</strong> ${serieIdentificacao}</p>
                  <p style="margin: 0 0 8px;"><strong>Produto:</strong> ${prod.title || 'Debênture'}</p>
                  <p style="margin: 0 0 8px;"><strong>Quantidade de Cotas:</strong> ${qtdCotas}</p>
                  <p style="margin: 0;"><strong>Valor Total:</strong> R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <p>O contrato formal com validade jurídica encontra-se anexado a este e-mail em formato PDF e também está disponível para consulta e download permanente na sua Área do Investidor.</p>
                <p style="margin-top: 30px; font-size: 12px; color: #777;">Atenciosamente,<br/><strong>${secRazao}</strong><br/>${secEndereco}</p>
              </div>
            `,
            attachments: [
              {
                filename: fileName,
                content: base64Pdf,
              },
            ],
          }),
        })
      } catch (emailErr) {
        console.warn('Falha ao enviar e-mail com anexo:', emailErr)
      }
    }

    return new Response(JSON.stringify({ success: true, url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Erro na função generate-subscription-term:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
