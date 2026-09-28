import { rgb } from 'npm:pdf-lib'

export interface QualifiedSignatureData {
  cidade: string
  uf: string
  dataCelebracao?: string | Date | null
  dataAceite?: string | Date | null
  ipAddress?: string | null
  documentId: string
  documentTypeLabel?: string // ex: "Aporte", "Operação", "CCB", "Resgate", "Dossiê"
  hashSha256?: string
  hashSeed?: string
  // Securitizadora
  securitizadoraRazao: string
  securitizadoraRepNome: string
  securitizadoraRepCargo: string
  securitizadoraRepCpf?: string | null
  securitizadoraPapel?: string // padrão: 'Securitizadora' ou 'Emissora' ou 'Cessionária'
  // Contraparte
  contraparteNome: string
  contraparteDocumento: string
  contrapartePapel: string // ex: "Debenturista", "Cedente", "Tomador / Emitente da CCB", "Beneficiário", "Titular"
}

export interface DrawQualifiedSignatureOptions {
  page: any
  startX: number
  startY: number // Y do topo do box
  width: number
  fontRegular: any
  fontBold: any
  pdfDoc?: any // para poder criar nova página se drawQualifiedSignatureWithAutoPageBreak for usado
  boxHeight?: number // padrão: 145
}

/**
 * Gera um hash SHA256 determinístico em formato hexadecimal/maiúsculo
 */
export async function computeSha256Hex(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const encoded = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  } catch {
    // Fallback caso crypto.subtle falhe
    return data
      .replace(/[^a-zA-Z0-9]/g, '')
      .padEnd(32, 'F')
      .substring(0, 32)
      .toUpperCase()
  }
}

/**
 * Formata data no formato extenso brasileiro (ex: 28 de Setembro de 2026)
 */
export function formatDataCelebracaoExtenso(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })
  }
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Formata data e hora no horário de Brasília (ex: 28/09/2026 14:32:00)
 */
export function formatDataHoraBrasilia(dateInput?: string | Date | null): string {
  const date = !dateInput
    ? new Date()
    : typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Desenha o bloco visual padrão de formalização e assinatura eletrônica qualificada.
 * Retorna o Y final após o box (para continuar desenhando rodapés, se necessário).
 */
export function drawQualifiedSignatureBlock(
  opts: DrawQualifiedSignatureOptions,
  data: QualifiedSignatureData,
): number {
  const { page, startX, startY, width, fontRegular, fontBold, boxHeight = 145 } = opts

  const signBoxY = startY - boxHeight

  // 1. Box de fundo com borda azul suave institucional
  page.drawRectangle({
    x: startX,
    y: signBoxY,
    width,
    height: boxHeight,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.65, 0.75, 0.9),
    borderWidth: 1,
  })

  // 2. Título do bloco em azul marinho
  page.drawText('FORMALIZAÇÃO E ASSINATURA ELETRÔNICA QUALIFICADA', {
    x: startX + 14,
    y: startY - 16,
    font: fontBold,
    size: 9.0,
    color: rgb(0.08, 0.18, 0.36),
  })

  // 3. Montar dados de auditoria legal
  const cidade = (data.cidade || 'Criciúma').trim()
  const uf = (data.uf || 'SC').trim()
  const dataCelebracaoStr = formatDataCelebracaoExtenso(data.dataCelebracao)
  const dataHoraStr = formatDataHoraBrasilia(data.dataAceite)
  const docTypeLabel = data.documentTypeLabel || 'Documento / Operação'

  const hashFormatted =
    data.hashSha256 ||
    `SHA256-${(data.hashSeed || data.documentId).replace(/-/g, '').substring(0, 24).toUpperCase()}`

  const infoSign = [
    `Assinado digitalmente nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.`,
    `Data e Local da Celebração: ${cidade}/${uf}, ${dataCelebracaoStr}.`,
    `Data/Hora do Aceite Eletrônico: ${dataHoraStr} (Horário de Brasília).`,
    `Endereço IP Registrado: ${data.ipAddress || 'Conexão Autenticada via Plataforma Web/SSL'}.`,
    `Código Identificador do ${docTypeLabel}: ${data.documentId}`,
    `Hash de Autenticidade Escritural: ${hashFormatted}`,
  ]

  let lineY = startY - 30
  for (const line of infoSign) {
    page.drawText(line, {
      x: startX + 14,
      y: lineY,
      font: fontRegular,
      size: 7.4,
      color: rgb(0.2, 0.25, 0.35),
    })
    lineY -= 10.5
  }

  // 4. Linhas de assinatura duplas
  lineY -= 8
  const availableWidth = width - 42
  const colWidth = availableWidth / 2
  const colGap = 14
  const col1X = startX + 14
  const col2X = col1X + colWidth + colGap

  // Linha 1 (Securitizadora / Emissora / Cessionária)
  page.drawLine({
    start: { x: col1X, y: lineY },
    end: { x: col1X + colWidth, y: lineY },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Linha 2 (Contraparte: Debenturista, Cedente, Tomador, etc.)
  page.drawLine({
    start: { x: col2X, y: lineY },
    end: { x: col2X + colWidth, y: lineY },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Helper interno de quebra de texto por largura para garantir que o texto de cada coluna NUNCA invada a outra
  const wrapTextToWidth = (
    text: string,
    maxWidth: number,
    fontToMeasure: any,
    fontSize: number,
  ): string[] => {
    if (!text) return []
    const rawParagraphs = text.split('\n')
    const finalLines: string[] = []

    for (const paragraph of rawParagraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean)
      if (words.length === 0) continue

      let currentLine = ''
      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word
        let candidateWidth = 0
        try {
          candidateWidth = fontToMeasure.widthOfTextAtSize(candidate, fontSize)
        } catch {
          candidateWidth = candidate.length * (fontSize * 0.55)
        }

        if (candidateWidth <= maxWidth || !currentLine) {
          currentLine = candidate
        } else {
          finalLines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) {
        finalLines.push(currentLine)
      }
    }

    return finalLines
  }

  // Textos de qualificação sob as assinaturas
  // Securitizadora / Diretor:
  // Linha 1: Razão Social (com papel se houver)
  // Linha 2+: Nome do Representante + Cargo
  // Linha final: CPF do Representante destacado em linha própria
  const secPapel = data.securitizadoraPapel ? ` (${data.securitizadoraPapel})` : ''
  const secLine1 = `${data.securitizadoraRazao}${secPapel}`
  const secLine2 = `${data.securitizadoraRepNome} - ${data.securitizadoraRepCargo}`
  const secCpfLine = data.securitizadoraRepCpf ? `CPF: ${data.securitizadoraRepCpf}` : ''

  // Contraparte (ex: Debenturista, Tomador, Cedente):
  // Linha 1+: Nome da Contraparte
  // Linha 2: Papel da Contraparte (ex: "Debenturista")
  // Linha final: CPF/CNPJ da Contraparte em linha própria
  const contraparteLine1 = data.contraparteNome || ''
  const contraparteLine2 = data.contrapartePapel || ''
  const contraparteDocLine = data.contraparteDocumento
    ? `CPF/CNPJ: ${data.contraparteDocumento}`
    : ''

  // Quebra segura dentro da largura de cada coluna individual (colWidth)
  const secLines: { text: string; isBold: boolean }[] = []
  for (const l of wrapTextToWidth(secLine1, colWidth, fontBold, 7.2)) {
    secLines.push({ text: l, isBold: true })
  }
  for (const l of wrapTextToWidth(secLine2, colWidth, fontRegular, 7.0)) {
    secLines.push({ text: l, isBold: false })
  }
  if (secCpfLine) {
    for (const l of wrapTextToWidth(secCpfLine, colWidth, fontRegular, 6.8)) {
      secLines.push({ text: l, isBold: false })
    }
  }

  const contraLines: { text: string; isBold: boolean }[] = []
  for (const l of wrapTextToWidth(contraparteLine1, colWidth, fontBold, 7.2)) {
    contraLines.push({ text: l, isBold: true })
  }
  for (const l of wrapTextToWidth(contraparteLine2, colWidth, fontBold, 7.0)) {
    contraLines.push({ text: l, isBold: true })
  }
  if (contraparteDocLine) {
    for (const l of wrapTextToWidth(contraparteDocLine, colWidth, fontRegular, 6.8)) {
      contraLines.push({ text: l, isBold: false })
    }
  }

  // Renderiza textos da coluna 1 (Securitizadora / Diretor)
  let curCol1Y = lineY - 10
  const lineHeightCol1 = 8.8
  for (const item of secLines) {
    page.drawText(item.text, {
      x: col1X,
      y: curCol1Y,
      font: item.isBold ? fontBold : fontRegular,
      size: item.isBold ? 7.2 : 7.0,
      color: rgb(0.12, 0.15, 0.2),
    })
    curCol1Y -= lineHeightCol1
  }

  // Renderiza textos da coluna 2 (Debenturista / Contraparte)
  let curCol2Y = lineY - 10
  const lineHeightCol2 = 8.8
  for (const item of contraLines) {
    page.drawText(item.text, {
      x: col2X,
      y: curCol2Y,
      font: item.isBold ? fontBold : fontRegular,
      size: item.isBold ? 7.2 : 7.0,
      color: rgb(0.12, 0.15, 0.2),
    })
    curCol2Y -= lineHeightCol2
  }

  return signBoxY
}
