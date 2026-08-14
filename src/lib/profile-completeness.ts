// Cálculo de completude do perfil do investidor.

export interface ProfileForCompleteness {
  full_name?: string | null
  phone?: string | null
  document_number?: string | null
  entity_type?: 'pf' | 'pj' | null
  // PF
  pf_rg?: string | null
  pf_birth_date?: string | null
  pf_marital_status?: string | null
  pf_occupation?: string | null
  // PJ
  pj_company_name?: string | null
  pj_cnae?: string | null
  pj_tax_regime?: string | null
  // Endereço
  address_zip?: string | null
  address_street?: string | null
  address_number?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
}

export interface ProfileCompleteness {
  percentage: number
  filled: number
  total: number
  missing: string[]
}

const isFilled = (v: any): boolean => v !== null && v !== undefined && String(v).trim() !== ''

/**
 * Calcula a completude do perfil.
 *
 * Os campos cadastrais representam até 90% da barra. O envio de pelo menos
 * 1 documento KYC adiciona os 10% restantes — conforme regra de negócio.
 */
export const getProfileCompleteness = (
  profile: ProfileForCompleteness | null,
  hasDocs: boolean,
): ProfileCompleteness => {
  if (!profile) {
    return { percentage: 0, filled: 0, total: 0, missing: [] }
  }

  const isPj = profile.entity_type === 'pj'

  const baseFields: { key: keyof ProfileForCompleteness; label: string }[] = [
    { key: 'full_name', label: 'Nome' },
    { key: 'phone', label: 'Telefone' },
    { key: 'document_number', label: 'CPF/CNPJ' },
    ...(isPj
      ? [
          { key: 'pj_company_name' as const, label: 'Razão Social' },
          { key: 'pj_cnae' as const, label: 'CNAE' },
          { key: 'pj_tax_regime' as const, label: 'Regime Tributário' },
        ]
      : [
          { key: 'pf_rg' as const, label: 'RG' },
          { key: 'pf_birth_date' as const, label: 'Data de Nascimento' },
          { key: 'pf_marital_status' as const, label: 'Estado Civil' },
          { key: 'pf_occupation' as const, label: 'Ocupação' },
        ]),
    { key: 'address_zip', label: 'CEP' },
    { key: 'address_street', label: 'Rua' },
    { key: 'address_number', label: 'Número' },
    { key: 'address_neighborhood', label: 'Bairro' },
    { key: 'address_city', label: 'Cidade' },
    { key: 'address_state', label: 'Estado' },
  ]

  let filled = 0
  const missing: string[] = []

  baseFields.forEach((f) => {
    if (isFilled((profile as any)[f.key])) {
      filled++
    } else {
      missing.push(f.label)
    }
  })

  const fieldPct = (filled / baseFields.length) * 90
  const percentage = Math.min(100, Math.round(fieldPct) + (hasDocs ? 10 : 0))

  return { percentage, filled, total: baseFields.length, missing }
}
