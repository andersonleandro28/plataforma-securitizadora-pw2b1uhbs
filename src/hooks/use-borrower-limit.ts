import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useBorrowerLimit(userId?: string) {
  const [limit, setLimit] = useState(0)
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchLimit = async () => {
      setLoading(true)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credit_limit')
          .eq('id', userId)
          .single()

        const { data: ops } = await supabase
          .from('credit_operations')
          .select('requested_value, status')
          .eq('borrower_id', userId)
          .not('status', 'in', '("liquidado","reprovado","cancelado","excluido")')

        const { data: ccbs } = await supabase
          .from('ccb_solicitacoes')
          .select('requested_value, status')
          .eq('user_id', userId)
          .not('status', 'in', '("liquidado","reprovado","cancelado","excluido")')

        const usedOps = (ops || []).reduce((acc, op) => acc + Number(op.requested_value || 0), 0)
        const usedCcbs = (ccbs || []).reduce((acc, c) => acc + Number(c.requested_value || 0), 0)

        setLimit(Number(profile?.credit_limit || 0))
        setUsed(usedOps + usedCcbs)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchLimit()
  }, [userId])

  return { limit, used, available: Math.max(0, limit - used), loading }
}
