import { supabase } from '@/lib/supabase/client'

export interface SerasaScoreResponse {
  document: string
  score: number
  riskClassification: 'Baixo' | 'Médio' | 'Alto'
  probabilityOfDefault: string
  lastConsultation: string
  negativeRecords: number
  financialCommitment: string
}

export interface SerasaConsultationRecord {
  id: string
  user_id: string
  document_number: string
  score: number
  risk_level: string
  raw_response: any
  created_at: string
}

export const getSerasaScore = async (document: string): Promise<SerasaScoreResponse> => {
  const { data, error } = await supabase.functions.invoke<{ data: SerasaScoreResponse }>(
    'serasa-integration',
    { body: { document } },
  )

  if (error) {
    throw new Error(error.message || 'Erro ao comunicar com o servidor (Serasa)')
  }

  if (!data?.data) {
    throw new Error('Resposta inválida ou não encontrada na integração Serasa')
  }

  return data.data
}

export const saveSerasaConsultation = async (
  userId: string,
  response: SerasaScoreResponse,
): Promise<void> => {
  const { error } = await supabase.from('serasa_consultations').insert({
    user_id: userId,
    document_number: response.document,
    score: response.score,
    risk_level: response.riskClassification,
    raw_response: response as any,
  })

  if (error) {
    console.error('Falha ao salvar consulta no histórico:', error)
    throw new Error('Erro ao salvar histórico de consulta')
  }
}

export const getSerasaHistory = async (): Promise<SerasaConsultationRecord[]> => {
  const { data, error } = await supabase
    .from('serasa_consultations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data as SerasaConsultationRecord[]
}
