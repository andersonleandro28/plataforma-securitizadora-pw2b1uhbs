/**
 * Utilitário de Impressão Isolada para o Relatório Financeiro e Operacional Unificado
 * Nexum Security 360º
 *
 * Gera um documento de impressão autônomo (self-contained) dentro de um <iframe> oculto,
 * eliminando qualquer conflito de @page, @media print ou orientação de abas de fundo.
 */

import { CompanySettings, formatCompanyAddress } from '@/services/company-settings'

export interface PrintUnifiedReportOptions {
  title?: string
  settings?: Partial<CompanySettings> | null
}
/**
 * Coleta todo o HTML do elemento alvo do relatório unificado,
 * clona-o para um iframe isolado com folhas de estilo próprias embutidas
 * configuradas rigorosamente para A4 paisagem (@page { size: A4 landscape; margin: 10mm; }),
 * e aciona o window.print() do iframe.
 */
export function printIsolatedUnifiedReport(
  sourceElement: HTMLElement,
  options: PrintUnifiedReportOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = options.settings
    const secRazaoSocial = s?.razao_social || 'NEXUM SECURITIZADORA S.A.'
    const secNomeFantasia = s?.nome_fantasia || 'NEXUM SECURITY 360º'
    const secCnpj = s?.cnpj || '00.000.000/0001-00'
    const secEndereco = s ? formatCompanyAddress(s) : 'São Paulo - SP | Brasil'
    const secContato = [s?.telefone, s?.email].filter(Boolean).join(' • ')
    const secRepresentante = s?.representante_nome
      ? `${s.representante_nome}${s.representante_cargo ? ` (${s.representante_cargo})` : ''}`
      : ''
    try {
      // Remove iframe residual se existir de tentativa anterior
      const existingIframe = document.getElementById('nexum-isolated-print-frame')
      if (existingIframe) {
        existingIframe.remove()
      }

      const iframe = document.createElement('iframe')
      iframe.id = 'nexum-isolated-print-frame'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.tabIndex = -1

      // Posiciona fora da tela sem afetar layout
      iframe.style.position = 'fixed'
      iframe.style.top = '0'
      iframe.style.left = '-10000px'
      iframe.style.width = '297mm'
      iframe.style.height = '210mm'
      iframe.style.border = 'none'
      iframe.style.opacity = '0'
      iframe.style.pointerEvents = 'none'
      iframe.style.zIndex = '-9999'

      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        iframe.remove()
        reject(new Error('Não foi possível acessar o documento do iframe de impressão.'))
        return
      }

      // Clona o conteúdo do elemento
      const clonedContent = sourceElement.cloneNode(true) as HTMLElement

      // Remove elementos marcados com .no-print do clone
      const noPrintElements = clonedContent.querySelectorAll('.no-print')
      noPrintElements.forEach((el) => el.remove())

      // Injeta/atualiza os dados oficiais da securitizadora no clone da capa, se existirem placeholders
      const coverTitleEl = clonedContent.querySelector('.cover-title-group h1')
      if (coverTitleEl && secRazaoSocial) {
        coverTitleEl.textContent = secRazaoSocial
      }
      const coverSubtitleEl = clonedContent.querySelector('.cover-title-group p')
      if (coverSubtitleEl) {
        coverSubtitleEl.textContent = `${secNomeFantasia} — Securitizadora de Créditos & Emissora de Debêntures`
      }
      const coverDetailsEl = clonedContent.querySelector('.cover-company-details')
      if (coverDetailsEl) {
        coverDetailsEl.innerHTML = `
          <span>CNPJ: ${secCnpj} ${s?.registro_regulador ? `• ${s.registro_regulador}` : ''}</span>
          ${secEndereco ? `<span>${secEndereco}</span>` : ''}
          ${secContato ? `<span>${secContato}</span>` : ''}
          ${secRepresentante ? `<span>Representante Legal: ${secRepresentante}</span>` : ''}
        `
      }

      // Força linhas de detalhamento do investidor (.investor-detail-row) que possam ter a classe hidden para ficarem visíveis na tabela clonada
      const investorDetailRows = clonedContent.querySelectorAll('.investor-detail-row')
      investorDetailRows.forEach((row) => {
        row.classList.remove('hidden')
        ;(row as HTMLElement).style.display = 'table-row'
      })

      // Monta CSS autônomo com A4 paisagem garantido e tipografia nítida
      const styles = `
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          width: 100% !important;
          height: auto !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 8.5pt;
          line-height: 1.35;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Área útil A4 Paisagem: 297mm - 20mm margens = 277mm */
        .print-root {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          display: block;
        }

        /* Oculta controles indesejados */
        .no-print, [data-no-print="true"] {
          display: none !important;
        }

        /* ------------------------------------------------------------- */
        /* CAPA EXECUTIVA                                                */
        /* ------------------------------------------------------------- */
        .unified-report-cover {
          box-sizing: border-box;
          width: 100%;
          min-height: 180mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 20mm 15mm;
          border: 1.5pt solid #cbd5e1;
          border-radius: 6pt;
          background: #f8fafc;
          page-break-after: always;
          break-after: page;
        }

        .cover-inner {
          width: 100%;
          max-width: 220mm;
          margin: 0 auto;
        }

        .cover-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12pt;
          margin-bottom: 16pt;
          padding-bottom: 12pt;
          border-bottom: 1pt solid #e2e8f0;
        }

        .cover-logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38pt;
          height: 38pt;
          background: #e0e7ff;
          border-radius: 8pt;
          color: #3730a3;
        }

        .cover-title-group h1 {
          font-size: 18pt;
          font-weight: 800;
          letter-spacing: 0.5pt;
          color: #0f172a;
          line-height: 1.1;
        }

        .cover-title-group .sub-razao {
          font-size: 9.5pt;
          font-weight: 700;
          color: #1e293b;
          margin-top: 2pt;
        }

        .cover-title-group p {
          font-size: 8pt;
          font-weight: 500;
          color: #64748b;
          margin-top: 3pt;
        }

        .cover-company-badge {
          display: flex;
          flex-direction: column;
          gap: 2pt;
          margin-top: 6pt;
          font-size: 7.5pt;
          color: #64748b;
        }

        .cover-main-badge {
          margin: 14pt 0 6pt 0;
          font-size: 16pt;
          font-weight: 800;
          color: #1e293b;
        }

        .cover-competence {
          font-size: 11pt;
          color: #475569;
          margin-bottom: 20pt;
        }

        .cover-competence strong {
          color: #0f172a;
        }

        .cover-manifest-box {
          background: #ffffff;
          border: 1pt solid #cbd5e1;
          border-radius: 6pt;
          padding: 12pt 16pt;
          text-align: left;
          margin: 16pt 0;
        }

        .cover-manifest-box h3 {
          font-size: 8.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8pt;
          color: #334155;
          margin-bottom: 8pt;
        }

        .cover-manifest-list {
          list-style: none;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6pt 14pt;
        }

        .cover-manifest-list li {
          font-size: 8pt;
          color: #334155;
          display: flex;
          align-items: flex-start;
          gap: 4pt;
        }

        .cover-footer {
          margin-top: 20pt;
          padding-top: 10pt;
          border-top: 1pt solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          color: #64748b;
        }

        /* ------------------------------------------------------------- */
        /* QUEBRAS DE PÁGINA DE SEÇÃO                                    */
        /* ------------------------------------------------------------- */
        .unified-section-break {
          page-break-before: always;
          break-before: page;
          margin-top: 0;
          padding-top: 2mm;
        }

        /* Seção sem quebra na primeira se não houver capa */
        .unified-section-break:first-child {
          page-break-before: avoid;
          break-before: avoid;
        }

        /* ------------------------------------------------------------- */
        /* CARDS E CONTAINERS                                            */
        /* ------------------------------------------------------------- */
        .card, [class*="rounded-xl"], [class*="rounded-lg"] {
          border: 1pt solid #e2e8f0 !important;
          background: #ffffff !important;
          border-radius: 4pt !important;
          box-shadow: none !important;
          margin-bottom: 8pt;
          overflow: visible !important;
        }

        .card-header, [class*="CardHeader"] {
          padding: 8pt 10pt !important;
          border-bottom: 1pt solid #e2e8f0 !important;
          background: #f8fafc !important;
        }

        .card-content, [class*="CardContent"] {
          padding: 8pt 10pt !important;
          overflow: visible !important;
        }

        /* Quebra de página controlada: evita que cards de resumo quebrem ao meio */
        .print-break-inside-avoid,
        .print-avoid-break,
        [class*="CardTitle"],
        [class*="CardHeader"] {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /* Grid flexível de cards de métricas no topo de cada seção */
        .grid {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6pt !important;
          margin-bottom: 8pt !important;
        }

        .grid > * {
          flex: 1 1 18% !important;
          min-width: 45mm !important;
          margin-bottom: 0 !important;
          box-sizing: border-box !important;
        }

        /* Subseções em duas colunas */
        .grid-cols-2 > * {
          flex: 1 1 45% !important;
        }

        .grid-cols-3 > * {
          flex: 1 1 30% !important;
        }

        .grid-cols-4 > * {
          flex: 1 1 22% !important;
        }

        .grid-cols-5 > * {
          flex: 1 1 18% !important;
        }

        /* Tipografia de métricas */
        .text-2xl, .text-xl {
          font-size: 13pt !important;
          font-weight: 700 !important;
          line-height: 1.15 !important;
        }

        .text-lg {
          font-size: 10pt !important;
          font-weight: 700 !important;
        }

        .text-xs {
          font-size: 7.5pt !important;
        }

        .text-\\[11px\\] {
          font-size: 7pt !important;
        }

        .text-\\[10px\\] {
          font-size: 6.5pt !important;
        }

        /* ------------------------------------------------------------- */
        /* TABELAS LARGAS E PAGINAÇÃO NATIVA                             */
        /* ------------------------------------------------------------- */
        .overflow-x-auto,
        .overflow-y-auto,
        .overflow-hidden,
        .overflow-auto,
        div:has(> table) {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          width: 100% !important;
          display: block !important;
        }

        table {
          width: 100% !important;
          table-layout: auto !important;
          border-collapse: collapse !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
          font-size: 7.5pt !important;
        }

        thead {
          display: table-header-group !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        tbody {
          display: table-row-group !important;
        }

        tfoot {
          display: table-footer-group !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          border-bottom: 0.5pt solid #e2e8f0 !important;
        }

        th {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: 700 !important;
          text-align: left !important;
          padding: 4pt 5pt !important;
          border-bottom: 1pt solid #cbd5e1 !important;
          white-space: nowrap !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        td {
          padding: 3.5pt 5pt !important;
          vertical-align: middle !important;
          word-break: normal !important;
          white-space: normal !important;
        }

        th.text-right, td.text-right {
          text-align: right !important;
        }

        th.text-center, td.text-center {
          text-align: center !important;
        }

        /* Destaque das linhas de sub-aportes de investidor */
        tr.investor-detail-row {
          display: table-row !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #f8fafc !important;
        }

        tr.investor-detail-row > td {
          padding: 4pt 8pt 6pt 8pt !important;
        }

        tr.investor-detail-row table {
          font-size: 7pt !important;
          background: #ffffff !important;
          border: 0.5pt solid #cbd5e1 !important;
        }

        tr.investor-detail-row th {
          background-color: #f8fafc !important;
          padding: 2.5pt 4pt !important;
        }

        tr.investor-detail-row td {
          padding: 2.5pt 4pt !important;
        }

        /* Cores semânticas mantidas na impressão */
        .text-emerald-600, .text-emerald-700 {
          color: #047857 !important;
        }

        .text-rose-600, .text-rose-700 {
          color: #b91c1c !important;
        }

        .text-blue-600, .text-blue-700 {
          color: #1d4ed8 !important;
        }

        .text-indigo-600, .text-indigo-700, .text-indigo-900 {
          color: #4338ca !important;
        }

        .text-amber-700, .text-amber-800, .text-amber-900 {
          color: #b45309 !important;
        }

        /* Badges */
        .badge, [class*="Badge"] {
          display: inline-block !important;
          padding: 1.5pt 4pt !important;
          border-radius: 3pt !important;
          font-size: 6.5pt !important;
          font-weight: 600 !important;
          border: 0.5pt solid #cbd5e1 !important;
          background: #f1f5f9 !important;
          color: #1e293b !important;
        }

        /* Rodapés de notas explicativas */
        .notes-box, [class*="border-dashed"] {
          border: 0.5pt dashed #94a3b8 !important;
          background: #f8fafc !important;
          padding: 6pt 8pt !important;
          border-radius: 4pt !important;
          margin-top: 8pt !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          font-size: 7pt !important;
          line-height: 1.3 !important;
        }

        .notes-box ul, [class*="border-dashed"] ul {
          padding-left: 12pt !important;
        }

        .notes-box li, [class*="border-dashed"] li {
          margin-bottom: 2pt !important;
        }
      `

      // Estrutura HTML completa do documento isolado
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${options.title || 'Relatório Financeiro & Operacional Unificado — Nexum Security 360º'}</title>
          <style>${styles}</style>
        </head>
        <body>
          <div class="print-root">
            ${clonedContent.outerHTML}
          </div>
        </body>
        </html>
      `

      iframeDoc.open()
      iframeDoc.write(htmlContent)
      iframeDoc.close()

      // Aguarda renderização completa e fontes antes de disparar o print
      const triggerPrint = () => {
        const cw = iframe.contentWindow
        if (!cw) {
          iframe.remove()
          reject(new Error('Janela do documento isolado não disponível.'))
          return
        }

        const cleanup = () => {
          setTimeout(() => {
            try {
              iframe.remove()
            } catch {
              // ignore
            }
            resolve()
          }, 1000)
        }

        cw.addEventListener('afterprint', cleanup, { once: true })

        // Foco e acionamento no contexto isolado do iframe
        cw.focus()
        try {
          cw.print()
        } catch (err) {
          cleanup()
          reject(err)
        }
      }

      // Pequeno timeout para o layout tree estabilizar no iframe
      setTimeout(() => {
        triggerPrint()
      }, 300)
    } catch (error) {
      reject(error)
    }
  })
}
