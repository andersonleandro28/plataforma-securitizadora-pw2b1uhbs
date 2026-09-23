import { supabase } from '@/lib/supabase/client'

export type FinancialDeletionTarget =
  | {
      canDelete: true
      targetTable: 'treasury_transactions' | 'movimentacoes_caixa' | 'expenses'
      recordId: string
      reason?: string
    }
  | {
      canDelete: false
      reason: string
    }

/**
 * Analisa o ID e a origem de um lançamento financeiro no Livro Caixa, DRE ou DFC
 * para verificar se ele é elegível para exclusão direta pelo administrador.
 *
 * Regras:
 * 1. Lançamentos manuais de tesouraria (`tt-{id}` ou `tre-{id}` com origem 'treasury_transactions'):
 *    - Se for crédito avulso manual (`external_ref` começa com manual-credit-) ou receita/despesa manual de tesouraria: EXCLUÍVEL.
 *    - Se veio gerado de uma despesa oficial (`expense_id` presente): NÃO excluir por aqui; avisar para excluir pela tela de Despesas (/admin/expenses).
 *    - Se for liquidação automática de CCB (`ccb-bol-`): NÃO excluir diretamente para não romper vínculo contábil com a CCB; se necessário alterar o boleto.
 *    - Se for liquidação de operação (`op-liq-`): NÃO excluir diretamente para preservar regras de limite de crédito.
 *    - Se for resgate de investidor (`redemption-`): NÃO excluir diretamente para preservar cotas de debêntures.
 * 2. Lançamentos de despesa direta (`exp-{id}`):
 *    - Despesas administrativas manuais podem ser deletadas diretamente da tabela `expenses`.
 * 3. Movimentações avulsas de caixa (`mov-{id}`):
 *    - Se for lançamento avulso não vinculado a resgate/fornecedor oficial: EXCLUÍVEL via soft delete.
 * 4. Subscrições de debêntures (`sub-{id}`), boletos diretos (`ccb-{id}`):
 *    - Devem ser gerenciados no módulo de Debêntures / Carteira CCB.
 */
export function evaluateTransactionDeletionEligibility(params: {
  id: string
  origem?: string
  categoria?: string
  descricao?: string
  type?: string
}): FinancialDeletionTarget {
  const { id, descricao = '' } = params
  const rawId = id.trim()

  // 1. Prefixos de tesouraria (Accounting usa tt-{uuid}, DRE usa tre-{uuid}, DFC usa tre-{uuid})
  if (rawId.startsWith('tt-') || rawId.startsWith('tre-')) {
    const uuid = rawId.replace(/^(tt-|tre-)/, '')

    // Se for liquidação ou boleto de CCB sincronizado
    if (
      descricao.includes('Recebimento Parcela') &&
      (descricao.includes('CCB') || rawId.includes('ccb-bol'))
    ) {
      return {
        canDelete: false,
        reason:
          'Lançamento automático de boleto de CCB. Para ajustar, altere o status do boleto no módulo de CCB.',
      }
    }

    if (descricao.includes('Liquidação de recebível') || rawId.includes('op-liq')) {
      return {
        canDelete: false,
        reason:
          'Lançamento gerado pela liquidação de operação de crédito. Para reverter, utilize o cancelamento/estorno no módulo de Operações.',
      }
    }

    if (descricao.includes('Resgate') || rawId.includes('redemption')) {
      return {
        canDelete: false,
        reason:
          'Lançamento vinculado a resgate de debênture. O estorno deve ser feito no módulo de Investimentos.',
      }
    }

    return {
      canDelete: true,
      targetTable: 'treasury_transactions',
      recordId: uuid,
    }
  }

  // 2. Prefixo de despesas (exp-{uuid})
  if (rawId.startsWith('exp-')) {
    const uuid = rawId.replace(/^exp-/, '')
    return {
      canDelete: true,
      targetTable: 'expenses',
      recordId: uuid,
    }
  }

  // 3. Prefixo de movimentações de caixa (mov-{uuid})
  if (rawId.startsWith('mov-')) {
    const uuid = rawId.replace(/^mov-/, '')

    if (
      descricao.toLowerCase().includes('resgate') ||
      descricao.toLowerCase().includes('fornecedor')
    ) {
      return {
        canDelete: false,
        reason:
          'Lançamento vinculado a fornecedor ou resgate de cotas. Ajuste pela tela de origem correspondente.',
      }
    }

    return {
      canDelete: true,
      targetTable: 'movimentacoes_caixa',
      recordId: uuid,
    }
  }

  // 4. Subscrições
  if (rawId.startsWith('sub-')) {
    return {
      canDelete: false,
      reason:
        'Aporte de investidor vinculado à subscrição de debênture. O cancelamento deve ser feito no módulo de Debêntures.',
    }
  }

  // 5. Boletos CCB direto de recebíveis (ccb-{id}-{parcela}) ou aquisições (acq-{id})
  if (
    rawId.startsWith('ccb-') ||
    rawId.startsWith('acq-') ||
    rawId.startsWith('cre-') ||
    rawId.startsWith('op-')
  ) {
    return {
      canDelete: false,
      reason:
        'Lançamento originado de contrato/operação de crédito oficial. Altere o status diretamente no contrato.',
    }
  }

  // 6. Resgates direto da tabela (red-{id})
  if (rawId.startsWith('red-')) {
    return {
      canDelete: false,
      reason: 'Resgate de investidor. Utilize o estorno na tela de Revisão de Investimentos.',
    }
  }

  return {
    canDelete: false,
    reason: 'Origem do lançamento não permite exclusão direta por esta visão.',
  }
}

/**
 * Chama a RPC delete_financial_transaction no backend
 */
export async function executeDeleteFinancialTransaction(params: {
  targetTable: 'treasury_transactions' | 'movimentacoes_caixa' | 'expenses'
  recordId: string
  justification?: string
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { data, error } = await (supabase.rpc as any)('delete_financial_transaction', {
      p_target_table: params.targetTable,
      p_record_id: params.recordId,
      p_justification: params.justification || 'Exclusão manual de lançamento incorreto',
    })

    if (error) {
      return { success: false, error: error.message }
    }

    const result = data as any
    if (result && result.success === false) {
      return { success: false, error: result.error || 'Erro ao excluir lançamento' }
    }

    return {
      success: true,
      message: result?.message || 'Lançamento excluído com sucesso.',
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha na comunicação com o servidor ao excluir lançamento.',
    }
  }
}
