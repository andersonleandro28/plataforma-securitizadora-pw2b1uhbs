import { supabase } from '@/lib/supabase/client'

export type BankTransferParams = {
  sourceAccountId: string
  destinationAccountId: string
  amount: number
  date: string // YYYY-MM-DD
  notes?: string
}

export type BankTransferResult = {
  success: boolean
  message?: string
  error?: string
  pair_id?: string
  out_id?: string
  in_id?: string
}

/**
 * Executa uma transferência atômica entre contas bancárias com validação de saldo
 * e gravação de dois lançamentos espelhados no Livro Caixa (movimentacoes_caixa).
 */
export async function executeBankTransfer(params: BankTransferParams): Promise<BankTransferResult> {
  try {
    if (params.sourceAccountId === params.destinationAccountId) {
      return {
        success: false,
        error: 'A conta de origem e a conta de destino não podem ser iguais.',
      }
    }

    if (!params.amount || params.amount <= 0) {
      return {
        success: false,
        error: 'O valor da transferência deve ser maior que zero.',
      }
    }

    if (!params.date) {
      return {
        success: false,
        error: 'A data da transferência é obrigatória.',
      }
    }

    const { data, error } = await (supabase.rpc as any)('execute_bank_transfer', {
      p_source_account_id: params.sourceAccountId,
      p_destination_account_id: params.destinationAccountId,
      p_amount: params.amount,
      p_date: params.date,
      p_notes: params.notes || null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    const res = data as any
    if (res && res.success === false) {
      return { success: false, error: res.error || 'Erro ao realizar transferência.' }
    }

    return {
      success: true,
      message: res?.message || 'Transferência realizada com sucesso!',
      pair_id: res?.pair_id,
      out_id: res?.out_id,
      in_id: res?.in_id,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha de comunicação ao processar transferência.',
    }
  }
}

/**
 * Consulta o saldo atual de uma conta bancária em tempo real pelo Livro Caixa (entradas - saídas).
 */
export async function fetchBankAccountBalance(accountId: string): Promise<number> {
  try {
    const { data, error } = await (supabase.rpc as any)('get_bank_account_balance', {
      p_bank_account_id: accountId,
    })

    if (error) {
      console.error('Erro ao buscar saldo da conta:', error)
      return 0
    }

    return Number(data || 0)
  } catch (err) {
    console.error('Falha ao consultar saldo da conta:', err)
    return 0
  }
}
