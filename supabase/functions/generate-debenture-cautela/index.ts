import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { valorPorExtenso } from '../_shared/number-to-words.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

function formatDateDDMMYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '05/06/25'
  try {
    const raw = String(dateStr).split('T')[0]
    const [y, m, d] = raw.split('-').map(Number)
    if (!y || !m || !d) return '05/06/25'
    const shortYear = String(y).slice(-2)
    const dd = String(d).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${dd}/${mm}/${shortYear}`
  } catch {
    return '05/06/25'
  }
}

function formatDateExtenso(dateStr: string | null | undefined): string {
  if (!dateStr) return '8 de Janeiro de 2026'
  try {
    const raw = String(dateStr).split('T')[0]
    const [y, m, d] = raw.split('-').map(Number)
    if (!y || !m || !d) return '8 de Janeiro de 2026'
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const formatted = date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    // Capitaliza primeira letra do mês (ex: 8 de Janeiro de 2026)
    return formatted.replace(/ de ([a-z])/g, (_, l) => ` de ${l.toUpperCase()}`)
  } catch {
    return '8 de Janeiro de 2026'
  }
}

/**
 * Desenha cantoneira ornamental no estilo certificado/cautela
 */
function drawOrnamentalCorner(
  page: any,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  color: any,
) {
  // L-corner externa
  page.drawLine({
    start: { x: cx, y: cy },
    end: { x: cx + dirX * 28, y: cy },
    thickness: 1.5,
    color,
  })
  page.drawLine({
    start: { x: cx, y: cy },
    end: { x: cx, y: cy + dirY * 28 },
    thickness: 1.5,
    color,
  })

  // Pequeno adorno diagonal/curvo decorativo
  page.drawLine({
    start: { x: cx + dirX * 8, y: cy + dirY * 8 },
    end: { x: cx + dirX * 20, y: cy + dirY * 8 },
    thickness: 0.8,
    color,
  })
  page.drawLine({
    start: { x: cx + dirX * 8, y: cy + dirY * 8 },
    end: { x: cx + dirX * 8, y: cy + dirY * 20 },
    thickness: 0.8,
    color,
  })
  page.drawCircle({
    x: cx + dirX * 14,
    y: cy + dirY * 14,
    size: 2,
    color,
  })
}

/**
 * Desenha moldura de borda ornamental de cautela
 */
function drawSecurityBorder(page: any, width: number, height: number) {
  const primaryColor = rgb(0.24, 0.44, 0.38) // Tom esverdeado/sage clássico do modelo
  const lightColor = rgb(0.55, 0.72, 0.65)
  const thinColor = rgb(0.78, 0.86, 0.82)

  // Borda 1: Retângulo externo fino
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: thinColor,
    borderWidth: 0.8,
  })

  // Borda 2: Linha principal esverdeada
  page.drawRectangle({
    x: 26,
    y: 26,
    width: width - 52,
    height: height - 52,
    borderColor: primaryColor,
    borderWidth: 2,
  })

  // Borda 3: Linha interna fina
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: lightColor,
    borderWidth: 0.8,
  })

  // Cantoneiras nos 4 cantos (x, y, dirX, dirY)
  drawOrnamentalCorner(page, 34, height - 34, 1, -1, primaryColor)
  drawOrnamentalCorner(page, width - 34, height - 34, -1, -1, primaryColor)
  drawOrnamentalCorner(page, 34, 34, 1, 1, primaryColor)
  drawOrnamentalCorner(page, width - 34, 34, -1, 1, primaryColor)

  // Vinhetas centrais (topo e base)
  drawCenterOrnament(page, width / 2, height - 35, primaryColor)
  drawCenterOrnament(page, width / 2, 35, primaryColor)
}

function drawCenterOrnament(page: any, cx: number, cy: number, color: any) {
  // Pequeno adorno simétrico no centro superior e inferior
  page.drawCircle({ x: cx, y: cy, size: 3.5, color })
  page.drawCircle({ x: cx - 12, y: cy, size: 2, color })
  page.drawCircle({ x: cx + 12, y: cy, size: 2, color })
  page.drawLine({
    start: { x: cx - 35, y: cy },
    end: { x: cx - 18, y: cy },
    thickness: 1,
    color,
  })
  page.drawLine({
    start: { x: cx + 18, y: cy },
    end: { x: cx + 35, y: cy },
    thickness: 1,
    color,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { investmentId, ipAddress, forceRegenerate = false } = await req.json()
    if (!investmentId) throw new Error('investmentId é obrigatório')

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

    const secRazaoOriginal = companyData?.razao_social || 'SEA CONNECTION INVESTIMENTOS S/A'
    const secRazao = (companyData?.razao_social || 'SEA CONNECTION INVESTIMENTOS SA').toUpperCase()
    const secCnpj = companyData?.cnpj || '60.703.936/0001-00'
    const secCidadeRaw = (companyData?.endereco_cidade || 'Criciúma').trim()
    const secUfRaw = (companyData?.endereco_uf || 'SC').trim()
    const secCidade = secCidadeRaw.toUpperCase()
    const secUf = secUfRaw.toUpperCase()
    const secLogradouro = (
      companyData?.endereco_logradouro || 'RODOVIA ANTÔNIO JUSTI'
    ).toUpperCase()
    const secNumero = companyData?.endereco_numero || '2470'
    const secBairro = (companyData?.endereco_bairro || 'PRIMEIRA LINHA PONTILHÃO').toUpperCase()

    const secEnderecoCompleto = `${secLogradouro}, ${secNumero}, ${secBairro}`
    const secCidadeEstadoLinha = `${secCidade} - ${secUf}`

    const secRepNome = companyData?.representante_nome || 'Anderson Cardozo Leandro'
    const secRepCargo = companyData?.representante_cargo || 'Diretor Presidente'

    const secOrgaoPadrao =
      companyData?.debenture_orgao_registro_padrao || 'Junta Comercial do Estado de Santa Catarina'
    const secDataRegistroPadrao = companyData?.debenture_data_registro_padrao || '2025-06-05'
    const secNumeroArquivamentoPadrao =
      companyData?.debenture_numero_arquivamento_padrao || 'ED009857000'

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

    // Se já tiver cautela_url gravada e não for regeneração forçada, retorna cache
    const existingFileName = `Cautela_Debentures_${inv.id.substring(0, 8)}.pdf`
    const defaultFilePath = `${inv.user_id}/cautelas/${existingFileName}`

    if (inv.cautela_url && !forceRegenerate) {
      let parsedPath = defaultFilePath
      const match = inv.cautela_url.match(/investment-docs\/(.+?)(\?|$)/)
      if (match?.[1]) {
        parsedPath = match[1].replace(/^\/+/, '')
      }

      const { data: signedData } = await supabase.storage
        .from('investment-docs')
        .createSignedUrl(parsedPath, 3600)

      const { data: publicUrlData } = supabase.storage
        .from('investment-docs')
        .getPublicUrl(parsedPath)

      return new Response(
        JSON.stringify({
          success: true,
          url: signedData?.signedUrl || publicUrlData.publicUrl,
          signedUrl: signedData?.signedUrl,
          filePath: parsedPath,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // 3. Obter número sequencial da cautela
    // Se existir debenture_subscriptions vinculado por investment_id, podemos buscar a posição sequencial
    const { count: priorSubsCount } = await supabase
      .from('investments')
      .select('id', { count: 'exact', head: true })
      .lte('created_at', inv.created_at || new Date().toISOString())

    const numeroCautela = priorSubsCount && priorSubsCount > 0 ? priorSubsCount : 1

    const prod = inv.investment_products || {}
    const series = prod.debenture_series || {}
    const debenture = series.debentures || {}

    // Escritura e Série com fallback
    const rawNumeroEscritura =
      debenture.numero_escritura ||
      companyData?.debenture_numero_escritura_padrao ||
      '1° EMISSÃO DE DEBÊNTURES SIMPLES SEA CONNECTION'

    // Formata o nome da escritura no padrão do modelo
    let escrituraNome = rawNumeroEscritura.toUpperCase()
    if (!escrituraNome.includes('ESCRITURA') && !escrituraNome.includes('EMISSÃO')) {
      escrituraNome = `1° EMISSÃO DE DEBÊNTURES SIMPLES ${secRazao}`
    }

    const seriesNum = series.series_number || '83'
    const seriesNumPad = String(seriesNum).padStart(6, '0')
    const serieIdentificacao = `${seriesNumPad} - SERIE - ${seriesNum}`

    // Registro na Junta
    const orgaoRegistro = debenture.orgao_registro || secOrgaoPadrao
    // Abrevia para "Junta Comercial do Estado de SC" se for Santa Catarina
    let orgaoAbreviado = orgaoRegistro
    if (/Santa Catarina/i.test(orgaoRegistro)) {
      orgaoAbreviado = 'Junta Comercial do Estado de SC'
    } else if (/São Paulo/i.test(orgaoRegistro)) {
      orgaoAbreviado = 'Junta Comercial do Estado de SP'
    } else if (/Rio de Janeiro/i.test(orgaoRegistro)) {
      orgaoAbreviado = 'Junta Comercial do Estado de RJ'
    }

    const dataRegistroRaw = debenture.data_registro || secDataRegistroPadrao
    const dataRegistroFormatada = formatDateDDMMYY(dataRegistroRaw)
    const numeroArquivamento = debenture.numero_arquivamento || secNumeroArquivamentoPadrao

    // Nome do Debenturista
    const debenturistaNome = (
      inv.profiles?.full_name ||
      inv.profiles?.pj_company_name ||
      'INVESTIDOR'
    ).toUpperCase()

    // Quantidade de debêntures e Valor Nominal Unitário
    // Se o valor nominal da debênture da série/emissão for 100 e unit_price for múltiplo, calculamos quantidade de debêntures
    // Caso padrão: cada cota = 1 debênture; se quota_value for 100, qtd debêntures = total_value / 100
    const valorTotal = Number(inv.total_value) || 0
    let valorNominalUnitario = 100.0 // Padrão clássico de debênture no modelo anexado
    let qtdDebentures = Math.floor(valorTotal / valorNominalUnitario)

    if (qtdDebentures <= 0) {
      // Se total for menor que 100 ou não divisível, usa quotas e unit_price
      qtdDebentures = Number(inv.quotas) || 1
      valorNominalUnitario = Number(inv.unit_price) || 100.0
    }

    const valorUnitarioExtenso = valorPorExtenso(valorNominalUnitario)
    const valorUnitarioFmt = valorNominalUnitario.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    // Preenchimento de segurança clássico de cautela com asteriscos
    // "Cem Reais ********** ********** ********** ********** ********** **********)"
    const fillerAsterisks = '********** ********** ********** ********** ********** **********'
    const valorExtensoCompleto = `${valorUnitarioExtenso} ${fillerAsterisks}`

    // Frase da escritura registrada:
    // “Escritura de emissão registrada na Junta Comercial do Estado de SC em 05/06/25, sob o nº ED009857000”
    const fraseRegistro = `“Escritura de emissão registrada na ${orgaoAbreviado} em ${dataRegistroFormatada}, sob o nº ${numeroArquivamento}”`

    // Data de emissão/subscrição da cautela e formato para auditoria eletrônica
    const dataSubscricaoRaw = inv.transfer_date || inv.created_at || new Date().toISOString()
    const dataSubscricaoExtenso = formatDateExtenso(dataSubscricaoRaw)
    const rodapeLocalData = `${secCidade}(${secUf}), ${dataSubscricaoExtenso}`

    const dataAceiteDate = inv.created_at ? new Date(inv.created_at) : new Date()
    const dataCelebracaoFmt = dataAceiteDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })
    const dataHoraFmt = dataAceiteDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const invDocumento = inv.profiles?.document_number || 'N/A'
    const invNomeOriginal = inv.profiles?.full_name || inv.profiles?.pj_company_name || 'Investidor'

    // 4. Montar o PDF A4 Retrato Página Única (fiel ao modelo da Cautela)
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    const fontTimesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

    const pageWidth = 595.28
    const pageHeight = 841.89
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    // Desenha bordas de segurança
    drawSecurityBorder(page, pageWidth, pageHeight)

    // Início da renderização dos blocos internos (com margem de 50pt de cada lado)
    const contentMarginLeft = 56
    const contentMarginRight = pageWidth - 56
    const contentWidth = contentMarginRight - contentMarginLeft

    // BLOCO 1: Cabeçalho da Companhia (Box superior central)
    let curY = pageHeight - 68

    // Linhas centrais da empresa
    const companyHeaderLines = [
      { text: secRazao, font: fontBold, size: 9.5, color: rgb(0.1, 0.1, 0.1) },
      { text: `CNPJ: ${secCnpj}`, font: font, size: 8.5, color: rgb(0.15, 0.15, 0.15) },
      { text: secEnderecoCompleto, font: font, size: 8, color: rgb(0.2, 0.2, 0.2) },
      { text: secCidadeEstadoLinha, font: font, size: 8, color: rgb(0.2, 0.2, 0.2) },
    ]

    for (const item of companyHeaderLines) {
      const textW = item.font.widthOfTextAtSize(item.text, item.size)
      const x = (pageWidth - textW) / 2
      page.drawText(item.text, {
        x,
        y: curY,
        font: item.font,
        size: item.size,
        color: item.color,
      })
      curY -= 11.5
    }

    curY -= 10

    // BLOCO 2: Características da Sociedade (em duas colunas no modelo)
    // Coluna esquerda: Data de Constituição e arquivamento
    // Coluna direita: Objeto Social
    const colGap = 20
    const colWidth = (contentWidth - colGap) / 2
    const leftColX = contentMarginLeft
    const rightColX = contentMarginLeft + colWidth + colGap

    const colTopY = curY

    // Texto Coluna Esquerda
    const constitucaoText = `Data de Constituição da Sociedade: , com seus atos constitutivos arquivados na ${orgaoAbreviado} em ${dataRegistroFormatada}, sob o nº ${numeroArquivamento}.`

    // Texto Coluna Direita
    const objetoSocialText = `Objeto Social: A Sociedade tem por objeto a aquisição e securitização de recebíveis comerciais e industriais.`

    const drawParagraphInBox = (
      text: string,
      x: number,
      startY: number,
      width: number,
      f: any,
      size: number,
      lineHeight: number,
    ) => {
      const words = text.split(/\s+/)
      let line = ''
      let y = startY
      for (const w of words) {
        const testLine = line ? `${line} ${w}` : w
        if (f.widthOfTextAtSize(testLine, size) > width && line !== '') {
          page.drawText(line, { x, y, font: f, size, color: rgb(0.15, 0.15, 0.15) })
          y -= lineHeight
          line = w
        } else {
          line = testLine
        }
      }
      if (line) {
        page.drawText(line, { x, y, font: f, size, color: rgb(0.15, 0.15, 0.15) })
        y -= lineHeight
      }
      return y
    }

    const endLeftY = drawParagraphInBox(
      constitucaoText,
      leftColX,
      colTopY,
      colWidth,
      fontTimes,
      8,
      10.5,
    )
    const endRightY = drawParagraphInBox(
      objetoSocialText,
      rightColX,
      colTopY,
      colWidth,
      fontTimes,
      8,
      10.5,
    )

    curY = Math.min(endLeftY, endRightY) - 10

    // Prazo de Duração e Espécie da Debênture (centralizado)
    const duracaoText = 'Prazo de Duração da Sociedade: Indeterminado'
    const duracaoW = fontTimes.widthOfTextAtSize(duracaoText, 8.5)
    page.drawText(duracaoText, {
      x: (pageWidth - duracaoW) / 2,
      y: curY,
      font: fontTimes,
      size: 8.5,
      color: rgb(0.15, 0.15, 0.15),
    })
    curY -= 11.5

    const especieText = 'DEBÊNTURES SIMPLES, SUBORDINADAS'
    const especieW = fontBold.widthOfTextAtSize(especieText, 9)
    page.drawText(especieText, {
      x: (pageWidth - especieW) / 2,
      y: curY,
      font: fontBold,
      size: 9,
      color: rgb(0.1, 0.1, 0.1),
    })

    curY -= 18

    // BLOCO 3: Dois Boxes em Destaque (Estilo Cautela)
    // Box 1 (Esquerda): Número da Cautela
    // Box 2 (Direita): Quantidade de Debêntures
    const boxW = 145
    const boxH = 42
    const boxSpacing = 28
    const boxesTotalW = boxW * 2 + boxSpacing
    const box1X = (pageWidth - boxesTotalW) / 2
    const box2X = box1X + boxW + boxSpacing
    const boxY = curY - boxH

    // Cores dos boxes (fundo cinza/esverdeado suave com borda arredondada elegante)
    const boxBgColor = rgb(0.68, 0.78, 0.73) // Tom esverdeado acinzentado do modelo original
    const boxBorderColor = rgb(0.4, 0.55, 0.48)

    // Box 1: Número da Cautela
    page.drawRectangle({
      x: box1X,
      y: boxY,
      width: boxW,
      height: boxH,
      color: boxBgColor,
      borderColor: boxBorderColor,
      borderWidth: 1,
    })
    const b1Title = 'Número da Cautela'
    const b1TitleW = fontTimesBold.widthOfTextAtSize(b1Title, 8.5)
    page.drawText(b1Title, {
      x: box1X + (boxW - b1TitleW) / 2,
      y: boxY + boxH - 14,
      font: fontTimesBold,
      size: 8.5,
      color: rgb(0.12, 0.2, 0.15),
    })
    const b1Value = String(numeroCautela)
    const b1ValueW = fontBold.widthOfTextAtSize(b1Value, 12)
    page.drawText(b1Value, {
      x: box1X + (boxW - b1ValueW) / 2,
      y: boxY + 9,
      font: fontBold,
      size: 12,
      color: rgb(0.1, 0.18, 0.12),
    })

    // Box 2: Quantidade de Debêntures
    page.drawRectangle({
      x: box2X,
      y: boxY,
      width: boxW,
      height: boxH,
      color: boxBgColor,
      borderColor: boxBorderColor,
      borderWidth: 1,
    })
    const b2Title = 'Quantidade de Debêntures'
    const b2TitleW = fontTimesBold.widthOfTextAtSize(b2Title, 8.5)
    page.drawText(b2Title, {
      x: box2X + (boxW - b2TitleW) / 2,
      y: boxY + boxH - 14,
      font: fontTimesBold,
      size: 8.5,
      color: rgb(0.12, 0.2, 0.15),
    })
    const b2Value = String(qtdDebentures)
    const b2ValueW = fontBold.widthOfTextAtSize(b2Value, 12)
    page.drawText(b2Value, {
      x: box2X + (boxW - b2ValueW) / 2,
      y: boxY + 9,
      font: fontBold,
      size: 12,
      color: rgb(0.1, 0.18, 0.12),
    })

    curY = boxY - 20

    // BLOCO 4: Texto Principal da Cautela (Parágrafo Solene Justificado/Centrado)
    const textoPrincipal = `Esta cautela representativa de ${qtdDebentures} debêntures, não conversíveis em ações, da Escritura ${escrituraNome}, da série ${serieIdentificacao}, no valor nominal unitário de R$ ${valorUnitarioFmt} (${valorExtensoCompleto}) e demais características especificadas na Escritura de Emissão ${escrituraNome}, confere a ${debenturistaNome} os direitos que a Lei e a Escritura de Emissão lhes asseguram.`

    // Renderiza parágrafo principal em Times-Roman justificado elegante
    const mainFontSize = 8
    const mainLineHeight = 11.5
    curY = drawParagraphInBox(
      textoPrincipal,
      contentMarginLeft,
      curY,
      contentWidth,
      fontTimes,
      mainFontSize,
      mainLineHeight,
    )

    curY -= 8

    // BLOCO 5: Frase de Registro na Junta Comercial (Itálico/Aspas)
    page.drawText(fraseRegistro, {
      x: contentMarginLeft,
      y: curY,
      font: fontTimesItalic,
      size: 8,
      color: rgb(0.15, 0.15, 0.15),
    })

    curY -= 16

    // BLOCO 6: Local e Data (Centralizado)
    const dataW = fontTimes.widthOfTextAtSize(rodapeLocalData, 8.5)
    page.drawText(rodapeLocalData, {
      x: (pageWidth - dataW) / 2,
      y: curY,
      font: fontTimes,
      size: 8.5,
      color: rgb(0.15, 0.15, 0.15),
    })

    curY -= 16

    // BLOCO 7: BLOCO DE ASSINATURA ELETRÔNICA QUALIFICADA (Padrão Idêntico ao Contrato)
    const signBoxHeight = 145
    const signBoxY = curY - signBoxHeight

    page.drawRectangle({
      x: contentMarginLeft,
      y: signBoxY,
      width: contentWidth,
      height: signBoxHeight,
      color: rgb(0.97, 0.98, 1.0),
      borderColor: rgb(0.65, 0.75, 0.9),
      borderWidth: 1,
    })

    page.drawText('FORMALIZAÇÃO E ASSINATURA ELETRÔNICA QUALIFICADA', {
      x: contentMarginLeft + 14,
      y: curY - 18,
      font: fontBold,
      size: 9.5,
      color: rgb(0.08, 0.18, 0.36),
    })

    const infoSign = [
      `Assinado digitalmente nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.`,
      `Data e Local da Celebração: ${secCidadeRaw}/${secUfRaw}, ${dataCelebracaoFmt}.`,
      `Data/Hora do Aceite Eletrônico: ${dataHoraFmt} (Horário de Brasília).`,
      `Endereço IP Registrado: ${ipAddress || 'Conexão Autenticada via Plataforma Web/SSL'}.`,
      `Código Identificador do Aporte: ${inv.id}`,
      `Hash de Autenticidade Escritural: SHA256-${inv.id.replace(/-/g, '').substring(0, 24).toUpperCase()}`,
    ]

    let signTextY = curY - 34
    for (const line of infoSign) {
      page.drawText(line, {
        x: contentMarginLeft + 14,
        y: signTextY,
        font: font,
        size: 7.8,
        color: rgb(0.2, 0.25, 0.35),
      })
      signTextY -= 11.5
    }

    // Linhas de assinatura dos representantes e debenturista
    signTextY -= 10
    const halfWidth = (contentWidth - 40) / 2
    page.drawLine({
      start: { x: contentMarginLeft + 14, y: signTextY },
      end: { x: contentMarginLeft + 14 + halfWidth, y: signTextY },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawLine({
      start: { x: contentMarginLeft + 28 + halfWidth, y: signTextY },
      end: { x: contentMarginLeft + 28 + halfWidth * 2, y: signTextY },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText(`${secRazaoOriginal}\n${secRepNome} - ${secRepCargo}`, {
      x: contentMarginLeft + 14,
      y: signTextY - 12,
      font: fontBold,
      size: 7.5,
      color: rgb(0.1, 0.1, 0.1),
    })

    page.drawText(`${invNomeOriginal}\nDebenturista - CPF/CNPJ: ${invDocumento}`, {
      x: contentMarginLeft + 28 + halfWidth,
      y: signTextY - 12,
      font: fontBold,
      size: 7.5,
      color: rgb(0.1, 0.1, 0.1),
    })

    // 5. Salvar PDF no bucket investment-docs sob /cautelas/
    const pdfBytes = await pdfDoc.save()
    const fileName = `Cautela_Debentures_${inv.id.substring(0, 8)}.pdf`
    const filePath = `${inv.user_id}/cautelas/${fileName}`

    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    await supabase.storage
      .from('investment-docs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    const { data: publicUrlData } = supabase.storage.from('investment-docs').getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    const { data: signedData } = await supabase.storage
      .from('investment-docs')
      .createSignedUrl(filePath, 3600)

    // Atualiza tabela investments com cautela_url
    await supabase.from('investments').update({ cautela_url: publicUrl }).eq('id', investmentId)

    return new Response(
      JSON.stringify({
        success: true,
        url: signedData?.signedUrl || publicUrl,
        signedUrl: signedData?.signedUrl,
        filePath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    console.error('Erro na função generate-debenture-cautela:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
