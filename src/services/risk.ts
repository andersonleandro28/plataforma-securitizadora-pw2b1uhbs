import { supabase } from '@/lib/supabase/client'

export const calculateRisk = async (operationId: string, sacadoDocument?: string) => {
  const { data, error } = await supabase.functions.invoke('calculate-risk', {
    body: { operation_id: operationId, sacado_document: sacadoDocument },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao comunicar com o servidor (Motor de Risco)')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data.data
}

export const getRiskHistory = async (operationId: string) => {
  const { data, error } = await supabase
    .from('risk_analysis_history')
    .select('*')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}
