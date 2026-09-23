/**
 * Utilitários para normalização e classificação financeira à prova de falha
 * para movimentações do Livro Caixa (movimentacoes_caixa), DRE, DFC e Contabilidade.
 */

/**
 * Normaliza uma string de tipo (remove acentos, espaços e converte para minúsculas).
 * Exemplo: "Saída" -> "saida", " entrada " -> "entrada", "SAIDA" -> "saida".
 */
export function normalizeType(type: string | null | undefined): string {
  if (!type) return ''
  return String(type)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Classifica uma movimentação do Livro Caixa de forma estritamente à prova de falha:
 * - SOMENTE se o tipo normalizado for 'entrada', classifica como receita ('receita').
 * - QUALQUER outro valor ('saida', 'saída', nulo, vazio, desconhecido) classifica como despesa ('despesa').
 * Garante que pagamentos (ex.: fornecedores) JAMAIS entrem acidentalmente como receita.
 */
export function classifyMovimentacaoCaixaDre(
  type: string | null | undefined,
): 'receita' | 'despesa' {
  const norm = normalizeType(type)
  return norm === 'entrada' ? 'receita' : 'despesa'
}

/**
 * Classifica uma movimentação do Livro Caixa para o Livro Caixa / Contabilidade ('in' | 'out'):
 * - SOMENTE se o tipo normalizado for 'entrada', classifica como entrada ('in').
 * - QUALQUER outro valor classifica como saída ('out').
 */
export function classifyMovimentacaoCaixaAccounting(type: string | null | undefined): 'in' | 'out' {
  const norm = normalizeType(type)
  return norm === 'entrada' ? 'in' : 'out'
}

/**
 * Classifica uma movimentação do Livro Caixa para o DFC ('entrada' | 'saida'):
 * - SOMENTE se o tipo normalizado for 'entrada', classifica como 'entrada'.
 * - QUALQUER outro valor classifica como 'saida'.
 */
export function classifyMovimentacaoCaixaDfc(type: string | null | undefined): 'entrada' | 'saida' {
  const norm = normalizeType(type)
  return norm === 'entrada' ? 'entrada' : 'saida'
}

/**
 * Verifica se um tipo corresponde a uma saída/despesa (útil para somas de saldo).
 */
export function isSaidaType(type: string | null | undefined): boolean {
  const norm = normalizeType(type)
  return norm !== 'entrada'
}
