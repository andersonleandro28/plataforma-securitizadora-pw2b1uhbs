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

/**
 * Identifica se um lançamento em treasury_transactions representa uma PROVISÃO
 * de IRRF retido na fonte sobre resgate de investidor (e NÃO uma saída real de caixa).
 *
 * Tais lançamentos são gerados na liquidação do resgate (passivo de imposto a recolher)
 * e o desembolso efetivo de caixa só ocorrerá quando a DARF for paga via `expenses`
 * (categoria 'Imposto'). Incluí-los como saída de caixa/resultado distorce o fluxo
 * e gera duplicação futura.
 *
 * Critérios robustos combinados:
 * 1. external_ref começando com "tax-redemption-"
 * 2. OU descrição começando/contendo "imposto a recolher" com referência a IRRF/resgate
 * 3. OU categoria "Impostos e Taxas" associada a resgate de investidor
 */
/**
 * Identifica se uma movimentação representa uma transferência interna entre contas bancárias.
 * Transferências internas não devem gerar impacto no DRE (nem receita nem despesa)
 * nem no DFC (não constituem fluxo de caixa externo da empresa).
 */
export function isBankTransferTransaction(tx: {
  categoria?: string | null
  referencia_tipo?: string | null
  descricao?: string | null
  transfer_pair_id?: string | null
}): boolean {
  if (tx.transfer_pair_id) return true

  const refTipo = (tx.referencia_tipo || '').toLowerCase().trim()
  if (refTipo === 'transferencia_entre_contas' || refTipo === 'transferência_entre_contas') {
    return true
  }

  const cat = normalizeType(tx.categoria)
  if (cat.includes('transferencia entre contas') || cat === 'transferencia') {
    return true
  }

  const desc = (tx.descricao || '').toLowerCase().trim()
  if (
    desc.startsWith('transferência entre contas') ||
    desc.startsWith('transferencia entre contas')
  ) {
    return true
  }

  return false
}

export function isTaxProvisionTransaction(tx: {
  external_ref?: string | null
  description?: string | null
  category?: string | null
}): boolean {
  const extRef = (tx.external_ref || '').toLowerCase().trim()
  if (extRef.startsWith('tax-redemption-') || extRef.startsWith('tax-redemption')) {
    return true
  }

  const desc = (tx.description || '').toLowerCase().trim()
  if (desc.includes('imposto a recolher') && (desc.includes('irrf') || desc.includes('resgate'))) {
    return true
  }

  const cat = (tx.category || '').toLowerCase().trim()
  if (
    cat.includes('impostos e taxas') &&
    (desc.includes('resgate') || extRef.includes('redemption'))
  ) {
    return true
  }

  return false
}
