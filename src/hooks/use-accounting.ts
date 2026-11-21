import { useState, useCallback } from 'react'
import {
  fetchConsolidatedAccountingLedger,
  type AccountingTransaction as Transaction,
} from '@/lib/accounting-ledger'

export type { Transaction }

export function useAccounting() {
  const [data, setData] = useState<Transaction[]>([])
  // Caixa real consolidado (soma dos saldos por conta do motor contábil único —
  // accountSummaries), não o acumulado bruto do livro.
  const [totalCashBalance, setTotalCashBalance] = useState(0)
  // Saldo acumulado OFICIAL por lançamento (mesma chave de data), calculado no
  // mesmo loop dos saldos por conta do motor — é o que o extrato de contas
  // bancárias exibe na coluna "Saldo Acumulado", garantindo reconciliação com
  // os totais do topo.
  const [runningBalances, setRunningBalances] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (inicio?: string, fim?: string) => {
    try {
      setLoading(true)
      setError(null)

      const result = await fetchConsolidatedAccountingLedger({ inicio, fim })
      setData(result.transactions)
      setTotalCashBalance(result.totalCashBalance)
      setRunningBalances(result.runningBalances || new Map())
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados da contabilidade.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, totalCashBalance, runningBalances, refetch: fetchData }
}
