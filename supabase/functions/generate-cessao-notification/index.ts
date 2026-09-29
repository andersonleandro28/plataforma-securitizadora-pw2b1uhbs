import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib'
import { corsHeaders } from '../_shared/cors.ts'
import {
  computeSha256Hex,
  drawQualifiedSignatureBlock,
  formatDataCelebracaoExtenso,
  formatDataHoraBrasilia,
} from '../_shared/qualified-signature.ts'

interface GenerateCessaoPayload {
  operationId: string
  forceRegenerate?: boolean
  sendEmail?: boolean
  originUrl?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GenerateCessaoPayload = await req.json()
    const { operationId, forceRegenerate = false, sendEmail = true, originUrl } = payload

    if (!operationId) {
      return new Response(JSON.stringify({ error: 'operationId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    // Cliente com Service Role para gravação de storage e tabelas
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Obter dados da Operação com perfis e cálculos
    const { data: op, error: opErr } = await supabase
      .from('credit_operations')
      .select('*, profiles(*), operation_calculations(*)')
      .eq('id', operationId)
      .single()

    if (opErr || !op) {
      return new Response(JSON.stringify({ error: `Operação não encontrada: ${opErr?.message}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Obter dados da Securitizadora (company_settings)
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // 3. Obter conta bancária ativa da Securitizadora para instrução de pagamento
    const { data: bankAccounts } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const secConta = bankAccounts?.[0] || null

    const secRazao = (companyData?.razao_social || 'NEXUM SECURITIZADORA S.A.').toUpperCase()
    const secCnpj = companyData?.cnpj || '00.000.000/0001-00'
    const secCidade = (companyData?.endereco_cidade || 'Criciúma').trim()
    const secUf = (companyData?.endereco_uf || 'SC').trim()
    const secCidadeUf = secCidade && secUf ? `${secCidade}/${secUf}` : 'Criciúma/SC'
    const secRepNome = companyData?.representante_nome || 'Anderson Cardozo Leandro'
    const secRepCargo = companyData?.representante_cargo || 'Diretor Presidente'
    const secRepCpf = companyData?.representante_cpf || '000.000.000-00'
    const secTelefone = companyData?.telefone || '(48) 99157-8299'
    const secEmail = companyData?.email || 'contato@seaconnection.com.br'

    const secCepRaw = companyData?.endereco_cep || ''
    const secCepDigits = secCepRaw.replace(/\D/g, '')
    const secCepFmt =
      secCepDigits.length === 8 ? `${secCepDigits.slice(0, 5)}-${secCepDigits.slice(5)}` : secCepRaw

    const secEndParts = [
      companyData?.endereco_logradouro
        ? `${companyData.endereco_logradouro}${companyData.endereco_numero ? ', nº ' + companyData.endereco_numero : ''}${companyData.endereco_complemento ? ' - ' + companyData.endereco_complemento : ''}`
        : '',
      companyData?.endereco_bairro ? `Bairro ${companyData.endereco_bairro}` : '',
      secCidadeUf,
      secCepFmt ? `CEP ${secCepFmt}` : '',
    ].filter(Boolean)
    const secEnderecoCompleto = secEndParts.length > 0 ? secEndParts.join(' - ') : secCidadeUf

    // 4. Dados do Cedente / Tomador
    const borrowerProfile = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
    const cedenteNome =
      borrowerProfile?.pj_company_name || borrowerProfile?.full_name || op.cedente || 'Cedente'
    const cedenteDoc = borrowerProfile?.document_number || 'Não informado'
    const cedenteEnd = [
      borrowerProfile?.address_street
        ? `${borrowerProfile.address_street}${borrowerProfile.address_number ? ', ' + borrowerProfile.address_number : ''}`
        : '',
      borrowerProfile?.address_neighborhood,
      borrowerProfile?.address_city && borrowerProfile?.address_state
        ? `${borrowerProfile.address_city}/${borrowerProfile.address_state}`
        : '',
      borrowerProfile?.address_zip ? `CEP: ${borrowerProfile.address_zip}` : '',
    ]
      .filter(Boolean)
      .join(' - ')

    // 5. Dados do Sacado
    const sacadoNome = op.sacado || 'Sacado Devedor'
    const sacadoDoc = op.sacado_document || 'Não cadastrado'
    const sacadoEmail = op.sacado_email || ''
    const sacadoPhone = op.sacado_phone || ''

    // 6. Consultar ou criar o registro na tabela notificacoes_cessao
    let { data: notifRecord } = await supabase
      .from('notificacoes_cessao')
      .select('*')
      .eq('operation_id', operationId)
      .maybeSingle()

    // Gerar token único caso não exista
    const token =
      notifRecord?.token ||
      crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

    if (!notifRecord) {
      const { data: createdNotif, error: createErr } = await supabase
        .from('notificacoes_cessao')
        .insert({
          operation_id: operationId,
          sacado_nome: sacadoNome,
          sacado_documento: sacadoDoc,
          sacado_email: sacadoEmail || null,
          sacado_telefone: sacadoPhone || null,
          token,
          status_envio: sacadoEmail ? 'pendente' : 'sem_email',
          status_aceite: 'aguardando',
        })
        .select('*')
        .single()

      if (createErr) {
        console.error('Erro ao criar registro em notificacoes_cessao:', createErr)
      } else {
        notifRecord = createdNotif
      }
    } else {
      // Atualizar dados de contato caso tenham sido editados
      await supabase
        .from('notificacoes_cessao')
        .update({
          sacado_nome: sacadoNome,
          sacado_documento: sacadoDoc,
          sacado_email: sacadoEmail || null,
          sacado_telefone: sacadoPhone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notifRecord.id)
    }

    // Se já tiver arquivo salvo e não for forceRegenerate, podemos reusar ou regenerar
    // Para manter integridade legal, sempre criamos o PDF com layout formal
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 45
    const contentWidth = pageWidth - margin * 2

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let currentY = pageHeight - margin

    const drawHeader = (page: any) => {
      page.drawText(`${secRazao} • NOTIFICAÇÃO FORMAL DE CESSÃO DE CRÉDITO`, {
        x: margin,
        y: pageHeight - 30,
        font: fontOblique,
        size: 8,
        color: rgb(0.35, 0.4, 0.5),
      })
      page.drawLine({
        start: { x: margin, y: pageHeight - 34 },
        end: { x: pageWidth - margin, y: pageHeight - 34 },
        thickness: 0.6,
        color: rgb(0.75, 0.8, 0.9),
      })
    }

    const drawFooter = (page: any) => {
      page.drawLine({
        start: { x: margin, y: margin + 22 },
        end: { x: pageWidth - margin, y: margin + 22 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
      page.drawText(
        `Nexum Security 360º • Operação #${op.id.substring(0, 8).toUpperCase()} • Notificação de Cessão (Art. 290 do Código Civil)`,
        {
          x: margin,
          y: margin + 10,
          font: font,
          size: 7.5,
          color: rgb(0.5, 0.5, 0.5),
        },
      )
    }

    const addNewPageIfNeeded = (neededHeight: number): void => {
      if (currentY - neededHeight < margin + 35) {
        drawFooter(currentPage)
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        currentY = pageHeight - margin
        drawHeader(currentPage)
      }
    }

    const drawTextWrap = (
      text: string,
      x: number,
      maxWidth: number,
      f: any,
      size: number,
      lineHeightMultiplier = 1.35,
      textColor = rgb(0.12, 0.15, 0.2),
    ): number => {
      const sanitized = text
        .replace(/\t/g, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF\r\n]/g, '')

      const paragraphs = sanitized.split(/\r?\n/)
      const lineHeight = size * lineHeightMultiplier

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          currentY -= lineHeight * 0.7
          continue
        }

        const words = paragraph.split(' ')
        let line = ''

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word
          let testWidth = 0
          try {
            testWidth = f.widthOfTextAtSize(testLine, size)
          } catch {
            testWidth = testLine.length * (size * 0.55)
          }

          if (testWidth > maxWidth && line !== '') {
            addNewPageIfNeeded(lineHeight)
            currentPage.drawText(line.trim(), { x, y: currentY, font: f, size, color: textColor })
            currentY -= lineHeight
            line = word
          } else {
            line = testLine
          }
        }

        if (line !== '') {
          addNewPageIfNeeded(lineHeight)
          currentPage.drawText(line.trim(), { x, y: currentY, font: f, size, color: textColor })
          currentY -= lineHeight
        }
      }

      return currentY
    }

    // Cabeçalho da página 1
    drawHeader(currentPage)

    // Título Principal
    currentPage.drawText('NOTIFICAÇÃO FORMAL DE CESSÃO DE CRÉDITO', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 13,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 16

    currentPage.drawText(
      '(Eficácia e Instrução de Pagamento — Art. 290 e seguintes da Lei Federal nº 10.406/2002 — Código Civil Brasileiro)',
      {
        x: margin,
        y: currentY,
        font: fontOblique,
        size: 8,
        color: rgb(0.3, 0.35, 0.45),
      },
    )
    currentY -= 18

    // Box de Resumo da Operação
    const boxH = 46
    currentPage.drawRectangle({
      x: margin,
      y: currentY - boxH,
      width: contentWidth,
      height: boxH,
      color: rgb(0.96, 0.98, 1.0),
      borderColor: rgb(0.68, 0.78, 0.92),
      borderWidth: 1,
    })

    const opNum = op.id.substring(0, 8).toUpperCase()
    currentPage.drawText(`OPERAÇÃO DE ANTECIPAÇÃO DE RECEBÍVEIS Nº: #${opNum}`, {
      x: margin + 12,
      y: currentY - 14,
      font: fontBold,
      size: 9.5,
      color: rgb(0.08, 0.18, 0.36),
    })

    const dataEmissaoDoc = op.created_at
      ? new Date(op.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    currentPage.drawText(
      `DATA DA NOTIFICAÇÃO: ${dataEmissaoDoc}   |   STATUS: OPERAÇÃO APROVADA E FORMALIZADA`,
      {
        x: margin + 12,
        y: currentY - 28,
        font: fontBold,
        size: 8,
        color: rgb(0.15, 0.5, 0.3),
      },
    )

    currentPage.drawText(
      `CESSIONÁRIA: ${secRazao} (CNPJ: ${secCnpj})   |   SACADO DEVEDOR: ${sacadoNome.toUpperCase()}`,
      {
        x: margin + 12,
        y: currentY - 40,
        font: font,
        size: 7.5,
        color: rgb(0.3, 0.35, 0.45),
      },
    )

    currentY -= boxH + 16

    // SEÇÃO A: IDENTIFICAÇÃO DAS PARTES
    currentPage.drawText('1. IDENTIFICAÇÃO DAS PARTES', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 10,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 14

    // Cessionária
    drawTextWrap(
      `CESSIONÁRIA (Securitizadora / Credora Atual): ${secRazao}, pessoa jurídica de direito privado sob a forma de sociedade anônima fechada, inscrita no CNPJ sob o nº ${secCnpj}, com sede na ${secEnderecoCompleto}, neste ato representada por seu ${secRepCargo}, ${secRepNome}, inscrito no CPF sob o nº ${secRepCpf}, doravante denominada simplesmente CESSIONÁRIA.`,
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 8

    // Cedente original (Tomador)
    drawTextWrap(
      `CEDENTE ORIGINAL (Tomador do Crédito): ${cedenteNome}, inscrito no CPF/CNPJ sob o nº ${cedenteDoc}${cedenteEnd ? ', com endereço em ' + cedenteEnd : ''}, doravante denominado simplesmente CEDENTE ORIGINAL.`,
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 8

    // Sacado
    const sacadoContato = [
      sacadoDoc !== 'Não cadastrado' ? `CPF/CNPJ: ${sacadoDoc}` : '',
      sacadoEmail ? `E-mail: ${sacadoEmail}` : '',
      sacadoPhone ? `Tel: ${sacadoPhone}` : '',
    ]
      .filter(Boolean)
      .join(' | ')

    drawTextWrap(
      `SACADO (Devedor Principal): ${sacadoNome}${sacadoContato ? ' (' + sacadoContato + ')' : ''}, doravante denominado simplesmente SACADO.`,
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 14

    // SEÇÃO B: DADOS DO TÍTULO / CRÉDITOS CEDIDOS
    addNewPageIfNeeded(70)
    currentPage.drawText('2. DADOS DO(S) TÍTULO(S) E CRÉDITO(S) CEDIDO(S)', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 10,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 14

    drawTextWrap(
      'Fica o SACADO formalmente notificado de que o CEDENTE ORIGINAL transferiu e cedeu à CESSIONÁRIA, em caráter irrevogável, irretratável e com eficácia plena perante terceiros, a totalidade dos direitos creditórios consubstanciados no(s) título(s) abaixo discriminado(s):',
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 8

    // Tabela dos títulos (suporta installments_data se houver)
    const installments =
      Array.isArray(op.installments_data) && op.installments_data.length > 0
        ? op.installments_data
        : null

    // Cabeçalho da tabela
    addNewPageIfNeeded(24)
    currentPage.drawRectangle({
      x: margin,
      y: currentY - 18,
      width: contentWidth,
      height: 18,
      color: rgb(0.9, 0.93, 0.98),
    })

    currentPage.drawText('Item / Parcela', {
      x: margin + 6,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentPage.drawText('Nº Documento', {
      x: margin + 90,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentPage.drawText('Espécie', {
      x: margin + 190,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentPage.drawText('Emissão', {
      x: margin + 265,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentPage.drawText('Vencimento', {
      x: margin + 340,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentPage.drawText('Valor de Face (R$)', {
      x: margin + 415,
      y: currentY - 12,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.2, 0.35),
    })
    currentY -= 20

    let totalFaceValue = 0

    if (installments && installments.length > 0) {
      for (const inst of installments) {
        addNewPageIfNeeded(18)
        const val = Number(inst.value || 0)
        totalFaceValue += val
        const due = inst.dueDate || inst.due_date
        const dueFmt = due ? new Date(due + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
        const emissaoFmt = op.issue_date
          ? new Date(op.issue_date + 'T00:00:00').toLocaleDateString('pt-BR')
          : '-'
        const docNum = inst.documentNumber || op.document_number || `OP-${opNum}/${inst.number}`

        currentPage.drawText(`Parcela ${inst.number}`, {
          x: margin + 6,
          y: currentY - 10,
          font: font,
          size: 7.8,
          color: rgb(0.2, 0.2, 0.2),
        })
        currentPage.drawText(String(docNum).substring(0, 16), {
          x: margin + 90,
          y: currentY - 10,
          font: font,
          size: 7.8,
          color: rgb(0.2, 0.2, 0.2),
        })
        currentPage.drawText((op.receivable_type || 'Duplicata').toUpperCase(), {
          x: margin + 190,
          y: currentY - 10,
          font: font,
          size: 7.8,
          color: rgb(0.2, 0.2, 0.2),
        })
        currentPage.drawText(emissaoFmt, {
          x: margin + 265,
          y: currentY - 10,
          font: font,
          size: 7.8,
          color: rgb(0.2, 0.2, 0.2),
        })
        currentPage.drawText(dueFmt, {
          x: margin + 340,
          y: currentY - 10,
          font: fontBold,
          size: 7.8,
          color: rgb(0.1, 0.2, 0.35),
        })
        currentPage.drawText(
          val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          {
            x: margin + 415,
            y: currentY - 10,
            font: fontBold,
            size: 7.8,
            color: rgb(0.1, 0.5, 0.25),
          },
        )

        page.drawLine({
          start: { x: margin, y: currentY - 13 },
          end: { x: pageWidth - margin, y: currentY - 13 },
          thickness: 0.3,
          color: rgb(0.85, 0.85, 0.85),
        })
        currentY -= 15
      }
    } else {
      addNewPageIfNeeded(18)
      const val = Number(op.face_value || op.requested_value || 0)
      totalFaceValue = val
      const dueFmt = op.due_date
        ? new Date(op.due_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : '-'
      const emissaoFmt = op.issue_date
        ? new Date(op.issue_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : '-'
      const docNum = op.document_number || `OP-${opNum}`

      currentPage.drawText('Título Único (1/1)', {
        x: margin + 6,
        y: currentY - 10,
        font: font,
        size: 7.8,
        color: rgb(0.2, 0.2, 0.2),
      })
      currentPage.drawText(String(docNum).substring(0, 16), {
        x: margin + 90,
        y: currentY - 10,
        font: font,
        size: 7.8,
        color: rgb(0.2, 0.2, 0.2),
      })
      currentPage.drawText((op.receivable_type || 'Duplicata').toUpperCase(), {
        x: margin + 190,
        y: currentY - 10,
        font: font,
        size: 7.8,
        color: rgb(0.2, 0.2, 0.2),
      })
      currentPage.drawText(emissaoFmt, {
        x: margin + 265,
        y: currentY - 10,
        font: font,
        size: 7.8,
        color: rgb(0.2, 0.2, 0.2),
      })
      currentPage.drawText(dueFmt, {
        x: margin + 340,
        y: currentY - 10,
        font: fontBold,
        size: 7.8,
        color: rgb(0.1, 0.2, 0.35),
      })
      currentPage.drawText(
        val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        {
          x: margin + 415,
          y: currentY - 10,
          font: fontBold,
          size: 7.8,
          color: rgb(0.1, 0.5, 0.25),
        },
      )

      page.drawLine({
        start: { x: margin, y: currentY - 13 },
        end: { x: pageWidth - margin, y: currentY - 13 },
        thickness: 0.3,
        color: rgb(0.85, 0.85, 0.85),
      })
      currentY -= 15
    }

    // Linha de Total Geral
    addNewPageIfNeeded(20)
    currentPage.drawRectangle({
      x: margin,
      y: currentY - 16,
      width: contentWidth,
      height: 16,
      color: rgb(0.95, 0.97, 0.95),
    })
    currentPage.drawText('TOTAL GERAL DOS TÍTULOS CEDIDOS:', {
      x: margin + 6,
      y: currentY - 11,
      font: fontBold,
      size: 8,
      color: rgb(0.1, 0.35, 0.2),
    })
    currentPage.drawText(
      `R$ ${totalFaceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      {
        x: margin + 415,
        y: currentY - 11,
        font: fontBold,
        size: 8.5,
        color: rgb(0.08, 0.5, 0.22),
      },
    )
    currentY -= 24

    // SEÇÃO C: INSTRUÇÃO DE PAGAMENTO E ADVERTÊNCIA LEGAL
    addNewPageIfNeeded(130)
    currentPage.drawText('3. INSTRUÇÃO DE PAGAMENTO E ADVERTÊNCIA LEGAL', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 10,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 14

    drawTextWrap(
      '3.1. EXCLUSIVIDADE DO PAGAMENTO: Em virtude da presente cessão de crédito celebrada entre o Cedente e a Cessionária, o SACADO fica terminantemente instruído a efetuar o adimplemento dos valores devidos EXCLUSIVAMENTE em favor da CESSIONÁRIA, na(s) data(s) de vencimento pactuada(s).',
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 6

    drawTextWrap(
      '3.2. ADVERTÊNCIA LEGAL (ART. 290 DO CÓDIGO CIVIL): A presente notificação atende rigorosamente aos ditames do artigo 290 da Lei Federal nº 10.406/2002. Fica expressamente advertido que o pagamento eventualmente efetuado ao CEDENTE ORIGINAL ou a terceiros não indicados formalmente pela Cessionária NÃO TERÁ EFICÁCIA LIBERATÓRIA DA DÍVIDA, persistindo a obrigação perante a CESSIONÁRIA ("Quem paga mal, paga duas vezes" — art. 308 do Código Civil).',
      margin,
      contentWidth,
      font,
      8.5,
      1.35,
    )
    currentY -= 8

    // Box de Dados Bancários para Pagamento
    const bankBoxH = 62
    addNewPageIfNeeded(bankBoxH + 10)
    currentPage.drawRectangle({
      x: margin,
      y: currentY - bankBoxH,
      width: contentWidth,
      height: bankBoxH,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.7, 0.75, 0.85),
      borderWidth: 1,
    })

    currentPage.drawText('DADOS BANCÁRIOS OFICIAIS DA CESSIONÁRIA PARA LIQUIDAÇÃO:', {
      x: margin + 10,
      y: currentY - 14,
      font: fontBold,
      size: 8.5,
      color: rgb(0.08, 0.18, 0.36),
    })

    if (secConta) {
      currentPage.drawText(
        `BANCO: ${secConta.bank_name || 'Banco Parceiro'}${secConta.bank_code ? ' (Cód. ' + secConta.bank_code + ')' : ''}   |   AGÊNCIA: ${secConta.branch || '001'}   |   CONTA CORRENTE: ${secConta.account_number}`,
        {
          x: margin + 10,
          y: currentY - 28,
          font: font,
          size: 8,
          color: rgb(0.15, 0.2, 0.3),
        },
      )
      currentPage.drawText(
        `FAVORECIDO: ${secConta.owner_name || secRazao}   |   CNPJ: ${secConta.owner_document || secCnpj}`,
        {
          x: margin + 10,
          y: currentY - 41,
          font: font,
          size: 8,
          color: rgb(0.15, 0.2, 0.3),
        },
      )
      currentPage.drawText(
        `CHAVE PIX: ${secConta.pix_key || secCnpj} (Transferência instantânea ou TED de mesma titularidade)`,
        {
          x: margin + 10,
          y: currentY - 54,
          font: fontBold,
          size: 8,
          color: rgb(0.1, 0.45, 0.2),
        },
      )
    } else {
      currentPage.drawText(`FAVORECIDO: ${secRazao}   |   CNPJ: ${secCnpj}`, {
        x: margin + 10,
        y: currentY - 28,
        font: font,
        size: 8,
        color: rgb(0.15, 0.2, 0.3),
      })
      currentPage.drawText(
        `CHAVE PIX: ${secCnpj}   |   E-mail de Contato Financeiro: ${secEmail}`,
        {
          x: margin + 10,
          y: currentY - 43,
          font: fontBold,
          size: 8,
          color: rgb(0.1, 0.45, 0.2),
        },
      )
    }

    currentY -= bankBoxH + 16

    // SEÇÃO D: CIÊNCIA E ASSINATURA ELETRÔNICA QUALIFICADA
    addNewPageIfNeeded(165)
    currentPage.drawText('4. FORMALIZAÇÃO, CIÊNCIA E ASSINATURA', {
      x: margin,
      y: currentY,
      font: fontBold,
      size: 10,
      color: rgb(0.08, 0.18, 0.36),
    })
    currentY -= 12

    const dataCeleb = op.created_at ? new Date(op.created_at) : new Date()

    drawQualifiedSignatureBlock(
      {
        page: currentPage,
        startX: margin,
        startY: currentY,
        width: contentWidth,
        fontRegular: font,
        fontBold: fontBold,
        boxHeight: 145,
      },
      {
        cidade: secCidade,
        uf: secUf,
        dataCelebracao: dataCeleb,
        dataAceite: notifRecord?.aceito_em ? new Date(notifRecord.aceito_em) : dataCeleb,
        ipAddress: notifRecord?.aceito_ip || 'Acesso seguro autenticado via plataforma',
        documentId: `NOTIF-${op.id.substring(0, 8).toUpperCase()}`,
        documentTypeLabel: 'Notificação de Cessão',
        securitizadoraRazao: secRazao,
        securitizadoraRepNome: secRepNome,
        securitizadoraRepCargo: secRepCargo,
        securitizadoraRepCpf: secRepCpf,
        securitizadoraPapel: 'Securitizadora Cessionária',
        contraparteNome: sacadoNome,
        contraparteDocumento: sacadoDoc,
        contrapartePapel:
          notifRecord?.status_aceite === 'aceito'
            ? 'Sacado Notificado (Ciência Confirmada)'
            : 'Sacado Notificado (Aguardando Aceite)',
      },
    )

    // Rodapé na última página
    drawFooter(currentPage)

    // 7. Salvar PDF no storage (bucket operation-docs)
    const pdfBytes = await pdfDoc.save()
    const fileName = `Notificacao_Cessao_${op.id.substring(0, 8).toUpperCase()}.pdf`
    const filePath = `notificacoes/${op.id}/${fileName}`

    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    const { error: uploadErr } = await supabase.storage
      .from('operation-docs')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      console.error('Erro ao fazer upload da Notificação no storage:', uploadErr)
    }

    const { data: publicUrlData } = supabase.storage.from('operation-docs').getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    const { data: signedUrlData } = await supabase.storage
      .from('operation-docs')
      .createSignedUrl(filePath, 3600 * 24 * 7) // 7 dias

    // Atualiza a tabela notificacoes_cessao com o link do PDF
    await supabase
      .from('notificacoes_cessao')
      .update({
        pdf_file_path: filePath,
        pdf_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('token', token)

    // 8. Enviar E-mail ao Sacado caso tenha e-mail cadastrado
    let emailStatus = notifRecord?.status_envio || 'sem_email'
    let emailErro: string | null = null

    if (sacadoEmail && resendApiKey && sendEmail) {
      try {
        // Converter PDF para base64
        let binary = ''
        const len = pdfBytes.byteLength
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(pdfBytes[i])
        }
        const base64Pdf = btoa(binary)

        // URL base do frontend
        const baseUrl = originUrl || 'https://misoqvscsydxqcsfjaux.supabase.co'
        const linkAceite = `${baseUrl}/ciencia-cessao/${token}`

        const resEmail = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Plataforma Securitizadora <contato@seaconnection.api.br>',
            to: [sacadoEmail],
            subject: `Notificação de Cessão de Crédito - Operação #${opNum} - ${sacadoNome}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e1e7ef; border-radius: 8px; padding: 24px;">
                <h2 style="color: #0c2340; margin-top: 0;">Notificação Formal de Cessão de Crédito</h2>
                <p>Prezado(a) <strong>${sacadoNome}</strong>,</p>
                <p>Comunicamos que os créditos referentes à operação <strong>#${opNum}</strong>, originados pelo cedente <strong>${cedenteNome}</strong> (CNPJ/CPF: ${cedenteDoc}), foram formalmente cedidos e transferidos para a <strong>${secRazao}</strong> (CNPJ: ${secCnpj}) nos termos do art. 290 da Lei Federal nº 10.406/2002 (Código Civil).</p>
                
                <div style="background-color: #f4f6fa; border-left: 4px solid #1a56db; padding: 14px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 0 0 6px;"><strong>Valor Total Cedido:</strong> R$ ${totalFaceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p style="margin: 0 0 6px;"><strong>Cedente Original:</strong> ${cedenteNome}</p>
                  <p style="margin: 0 0 6px;"><strong>Cessionária / Nova Credora:</strong> ${secRazao}</p>
                  <p style="margin: 0;"><strong>Instrução:</strong> O pagamento deve ser realizado exclusivamente à Securitizadora Cessionária nas datas de vencimento pactuadas.</p>
                </div>

                <p>Solicitamos que confirme o recebimento e ciência desta notificação clicando no botão abaixo:</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${linkAceite}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block;">
                    Confirmar Ciência da Cessão de Crédito
                  </a>
                </div>

                <p style="font-size: 12px; color: #666;">Se o botão não funcionar, copie e cole o link a seguir no seu navegador:<br/>
                <a href="${linkAceite}" style="color: #1a56db;">${linkAceite}</a></p>

                <p style="font-size: 12px; color: #666;">O documento completo formalizado em PDF encontra-se anexado a este e-mail.</p>

                <hr style="border: none; border-top: 1px solid #e1e7ef; margin: 24px 0;" />
                <p style="font-size: 11px; color: #888; margin: 0;">
                  <strong>${secRazao}</strong><br/>
                  ${secEnderecoCompleto}<br/>
                  Contato: ${secTelefone} | ${secEmail}
                </p>
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

        if (!resEmail.ok) {
          const errText = await resEmail.text()
          console.error('Falha ao enviar e-mail pelo Resend:', errText)
          emailStatus = 'falha_envio'
          emailErro = errText
        } else {
          emailStatus = 'enviado'
          emailErro = null
        }
      } catch (sendErr: any) {
        console.error('Erro de rede ao enviar e-mail:', sendErr)
        emailStatus = 'falha_envio'
        emailErro = sendErr?.message || 'Erro de conexão'
      }

      // Atualizar status do envio
      await supabase
        .from('notificacoes_cessao')
        .update({
          status_envio: emailStatus,
          email_enviado_em: emailStatus === 'enviado' ? new Date().toISOString() : null,
          email_erro: emailErro,
          updated_at: new Date().toISOString(),
        })
        .eq('token', token)
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        filePath,
        url: signedUrlData?.signedUrl || publicUrl,
        signedUrl: signedUrlData?.signedUrl,
        publicUrl,
        emailStatus,
        emailErro,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    console.error('Erro na função generate-cessao-notification:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
