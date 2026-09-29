/**
 * Utilitário compartilhado para acionar a impressão com um título customizado do documento.
 *
 * Como navegadores usam `document.title` como nome sugerido de arquivo padrão
 * no diálogo "Salvar como PDF", esta função atualiza temporariamente o título
 * antes da chamada a `window.print()` e restaura o título original após a impressão
 * (via evento `afterprint` ou fallback com timeout de segurança).
 */

export interface PrintWithReportTitleOptions {
  /**
   * Título descritivo amigável do relatório/documento (ex.: "Operações do Período - Setembro/2026")
   */
  title: string
  /**
   * Função opcional de disparo customizado (se não fornecida, usa window.print)
   */
  printFn?: () => void
  /**
   * Tempo máximo em ms para fallback caso o navegador não dispare afterprint (padrão 1500ms)
   */
  timeoutMs?: number
}

/**
 * Sanitiza o título removendo caracteres inválidos para nomes de arquivos do sistema operacional.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Dispara a rotina de impressão atualizando o `document.title` da página para que o
 * diálogo nativo do navegador sugira o nome correto do relatório ao salvar como PDF.
 */
export function printWithReportTitle(
  titleOrOptions: string | PrintWithReportTitleOptions,
  legacyPrintFn?: () => void,
): void {
  if (typeof window === 'undefined') return

  const options: PrintWithReportTitleOptions =
    typeof titleOrOptions === 'string'
      ? { title: titleOrOptions, printFn: legacyPrintFn }
      : titleOrOptions

  const cleanTitle = sanitizeFileName(options.title || 'Relatório')
  const originalTitle = document.title

  let restored = false
  const restoreOriginalTitle = () => {
    if (restored) return
    restored = true
    try {
      document.title = originalTitle
    } catch (e) {
      console.warn('Falha ao restaurar document.title:', e)
    }
    window.removeEventListener('afterprint', restoreOriginalTitle)
  }

  // 1. Define o título com o nome limpo do relatório
  try {
    document.title = cleanTitle
  } catch (e) {
    console.warn('Falha ao definir document.title para impressão:', e)
  }

  // 2. Registra o listener do afterprint (disparado quando o diálogo fecha ou imprime)
  window.addEventListener('afterprint', restoreOriginalTitle, { once: true })

  // 3. Fallback de segurança com timeout para garantir restauração caso afterprint não dispare
  const timeoutMs = options.timeoutMs ?? 1500
  setTimeout(restoreOriginalTitle, timeoutMs)

  // 4. Executa a impressão
  try {
    if (typeof options.printFn === 'function') {
      options.printFn()
    } else {
      window.print()
    }
  } catch (err) {
    restoreOriginalTitle()
    throw err
  }
}
