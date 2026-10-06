/**
 * Definição centralizada e canônica dos Tipos de Recebíveis da plataforma.
 *
 * Fonte da verdade compartilhada entre:
 * - Tela de Lançamento de Antecipação (Administrativo e Tomador)
 * - Parâmetros Financeiros -> Parâmetros Gerais (/admin/parameters)
 * - Telas de Acompanhamento, Operações, Extratos e Relatórios do Período
 */

export interface ReceivableTypeOption {
  value: string
  label: string
  description?: string
}

/**
 * Os 6 tipos canônicos homologados:
 * 1. Cheque
 * 2. Nota Promissória
 * 3. Contrato de Mútuo
 * 4. Confissão de Dívida
 * 5. Recebível Contratual
 * 6. Outros
 */
export const RECEIVABLE_TYPES: readonly ReceivableTypeOption[] = [
  { value: 'cheque', label: 'Cheque', description: 'Cheques pré-datados e à vista' },
  {
    value: 'promissoria',
    label: 'Nota Promissória',
    description: 'Títulos de crédito emitidos como promessa de pagamento',
  },
  {
    value: 'mutuo',
    label: 'Contrato de Mútuo',
    description: 'Mútuo financeiro com garantia ou prazo determinado',
  },
  {
    value: 'confissao_divida',
    label: 'Confissão de Dívida',
    description: 'Instrumentos particulares ou públicos de confissão de dívida',
  },
  {
    value: 'contratual',
    label: 'Recebível Contratual',
    description: 'Contratos de prestação de serviços, fornecimento ou locação',
  },
  {
    value: 'outro',
    label: 'Outros',
    description: 'Outros tipos de recebíveis com descrição personalizada',
  },
] as const

export type ReceivableTypeValue = (typeof RECEIVABLE_TYPES)[number]['value']

/**
 * Opções para a tela de Parâmetros Financeiros Gerais:
 * Inclui "Padrão / Global" como fallback mais os 6 tipos canônicos de recebíveis.
 */
export const FINANCIAL_PARAMETER_RECEIVABLE_TYPES: readonly ReceivableTypeOption[] = [
  {
    value: 'global',
    label: 'Padrão / Global',
    description: 'Taxas padrão aplicadas quando não houver regra específica',
  },
  ...RECEIVABLE_TYPES,
] as const

/**
 * Retorna o rótulo canônico amigável em português para qualquer código de tipo de recebível.
 * Lida também com códigos legados ('contrato' -> 'Recebível Contratual', 'duplicata' -> 'Duplicata', etc.)
 * e respeita o campo `receivable_type_other` se informado.
 */
export function getReceivableTypeLabel(
  type: string | null | undefined,
  otherDescription?: string | null,
): string {
  if (!type) return 'Recebível'

  const normalized = String(type).trim().toLowerCase()

  if (normalized === 'outro' || normalized === 'outros') {
    return otherDescription?.trim() ? otherDescription.trim() : 'Outros'
  }

  // Mapeamento canônico e aliases legados
  switch (normalized) {
    case 'cheque':
      return 'Cheque'
    case 'promissoria':
    case 'nota_promissoria':
    case 'nota promissória':
      return 'Nota Promissória'
    case 'mutuo':
    case 'contrato_mutuo':
    case 'contrato de mútuo':
    case 'contrato de mutuo':
      return 'Contrato de Mútuo'
    case 'confissao_divida':
    case 'confissao de divida':
    case 'confissão de dívida':
      return 'Confissão de Dívida'
    case 'contratual':
    case 'recebivel_contratual':
    case 'recebível contratual':
    case 'contrato':
    case 'contratos':
      return 'Recebível Contratual'
    case 'duplicata':
    case 'duplicatas':
      return 'Duplicata'
    case 'global':
      return 'Padrão / Global'
    default:
      // Se não mapeado, formata removendo underlines e capitalizando
      return normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
