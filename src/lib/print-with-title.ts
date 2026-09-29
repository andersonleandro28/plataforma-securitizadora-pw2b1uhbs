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
  // Substitui caracteres reservados do SO e caracteres de controle (ASCII 0 a 31)
  return name
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(char)) {
        return ' '
      }
      return char
    })
    .join('')
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
  // Se o título atual contiver "Skip" ou "ADAPTA", o título de fallback definitivo nunca deve reutilizá-lo
  const currentTitle = document.title
  const isBrandedTitle = /skip|adapta/i.test(currentTitle)
  const safeFallbackTitle = isBrandedTitle
    ? 'Nexum Security 360º'
    : currentTitle || 'Nexum Security 360º'

  let restored = false
  const restoreOriginalTitle = () => {
    if (restored) return
    restored = true
    try {
      document.title = safeFallbackTitle
    } catch (e) {
      console.warn('Falha ao restaurar document.title:', e)
    }
    window.removeEventListener('afterprint', restoreOriginalTitle)
    window.removeEventListener('beforeprint', ensureReportTitle)
  }

  const ensureReportTitle = () => {
    try {
      document.title = cleanTitle
    } catch (e) {
      console.warn('Falha ao garantir document.title no beforeprint:', e)
    }
  }

  // 1. Define imediatamente o título com o nome limpo do relatório
  ensureReportTitle()

  // 2. Registra listener de beforeprint para reafirmar o título caso o navegador/extensões o sobrescrevam
  window.addEventListener('beforeprint', ensureReportTitle)

  // 3. Registra listener do afterprint para restauração limpa
  window.addEventListener('afterprint', restoreOriginalTitle)

  // 4. Fallback de segurança com timeout mais generoso (5000ms) para não restaurar prematuramente enquanto o diálogo nativo do PDF ainda está inicializando
  const timeoutMs = options.timeoutMs ?? 5000
  const timeoutId = setTimeout(restoreOriginalTitle, timeoutMs)

  // 5. Executa a impressão
  try {
    if (typeof options.printFn === 'function') {
      options.printFn()
    } else {
      window.print()
    }
  } catch (err) {
    clearTimeout(timeoutId)
    restoreOriginalTitle()
    throw err
  }
}
