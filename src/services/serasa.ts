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

export const getSerasaScore = async (document: string): Promise<SerasaScoreResponse> => {
  const { data, error } = await supabase.functions.invoke<{ data: SerasaScoreResponse }>(
    'serasa-integration',
    {
      body: { document },
    },
  )

  if (error) {
    throw new Error(error.message || 'Erro ao comunicar com o servidor (Serasa)')
  }

  if (!data?.data) {
    throw new Error('Resposta inválida ou não encontrada na integração Serasa')
  }

  return data.data
}
