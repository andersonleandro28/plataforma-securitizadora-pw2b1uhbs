import { supabase } from '@/lib/supabase/client'

export interface ManualYieldEntry {
  id: string
  product_id: string
  period: string
  gross_percentage: number
  client_percentage: number
  securitizadora_percentage: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface NewManualYieldEntry {
  product_id: string
  period: string
  gross_percentage: number
  client_percentage: number
  securitizadora_percentage: number
  created_by?: string
}

export async function fetchManualYieldEntries(productId: string): Promise<ManualYieldEntry[]> {
  const { data, error } = await supabase
    .from('manual_yield_entries')
    .select('*')
    .eq('product_id', productId)
    .order('period', { ascending: false })

  if (error) throw error
  return (data || []) as ManualYieldEntry[]
}

export async function createManualYieldEntry(
  entry: NewManualYieldEntry,
): Promise<ManualYieldEntry> {
  const { data, error } = await supabase
    .from('manual_yield_entries')
    .insert([entry])
    .select()
    .single()

  if (error) throw error
  return data as ManualYieldEntry
}

export async function updateManualYieldEntry(
  id: string,
  updates: Partial<NewManualYieldEntry>,
): Promise<ManualYieldEntry> {
  const { data, error } = await supabase
    .from('manual_yield_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ManualYieldEntry
}

export async function deleteManualYieldEntry(id: string): Promise<void> {
  const { error } = await supabase.from('manual_yield_entries').delete().eq('id', id)
  if (error) throw error
}

export async function fetchManualYieldsForInvestment(
  productId: string,
): Promise<ManualYieldEntry[]> {
  const { data, error } = await supabase
    .from('manual_yield_entries')
    .select('*')
    .eq('product_id', productId)
    .order('period', { ascending: true })

  if (error) throw error
  return (data || []) as ManualYieldEntry[]
}
