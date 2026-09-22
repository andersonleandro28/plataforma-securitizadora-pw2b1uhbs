import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface CompanyBankAccount {
  id: string
  bank_code: string | null
  bank_name: string
  branch: string | null
  account_number: string
  pix_key: string | null
  owner_name: string
  owner_document: string
  is_active: boolean
  notes: string | null
  created_at: string
}

export function formatBankAccountLabel(acc: Partial<CompanyBankAccount>): string {
  const parts: string[] = []
  if (acc.bank_name) parts.push(acc.bank_name)
  const agConta: string[] = []
  if (acc.branch) agConta.push(`Ag. ${acc.branch}`)
  if (acc.account_number) agConta.push(`CC ${acc.account_number}`)
  if (agConta.length > 0) parts.push(agConta.join(' - '))
  if (acc.is_active) parts.push('(Principal)')
  return parts.join(' — ') || 'Conta bancária'
}

export function useCompanyBankAccounts() {
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([])
  const [activeAccount, setActiveAccount] = useState<CompanyBankAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true })

      if (err) throw err

      const list: CompanyBankAccount[] = (data || []) as CompanyBankAccount[]
      setAccounts(list)
      const active = list.find((a) => a.is_active) || (list.length > 0 ? list[0] : null)
      setActiveAccount(active)
    } catch (e: any) {
      console.error('Erro ao carregar contas bancárias da empresa:', e)
      setError(e.message || 'Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  return {
    accounts,
    activeAccount,
    loading,
    error,
    refetch: fetchAccounts,
    hasAccounts: accounts.length > 0,
  }
}
