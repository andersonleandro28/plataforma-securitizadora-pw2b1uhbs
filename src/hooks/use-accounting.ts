import { useState, useCallback } from 'react'
import {
  fetchConsolidatedAccountingLedger,
  type AccountingTransaction as Transaction,
} from '@/lib/accounting-ledger'

export type { Transaction }

export function useAccounting() {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (inicio?: string, fim?: string) => {
    try {
      setLoading(true)
      setError(null)

      const result = await fetchConsolidatedAccountingLedger({ inicio, fim })
      setData(result.transactions)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados da contabilidade.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, refetch: fetchData }
}
