import { supabase } from '@/lib/supabase/client'
import { maskCnpj, maskCpf } from '@/lib/cpf-cnpj'

export interface CompanySettings {
  id: string
  razao_social: string
  nome_fantasia?: string | null
  cnpj: string
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  endereco_cidade?: string | null
  endereco_uf?: string | null
  endereco_cep?: string | null
  telefone?: string | null
  email?: string | null
  representante_nome?: string | null
  representante_cargo?: string | null
  representante_cpf?: string | null
  capital_social?: number | null
  registro_regulador?: string | null
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export type CompanySettingsFormData = Omit<
  CompanySettings,
  'id' | 'created_at' | 'updated_at' | 'updated_by'
>

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: '00000000-0000-0000-0000-000000000001',
  razao_social: 'Nexum Securitizadora S.A.',
  nome_fantasia: 'Nexum Security 360º',
  cnpj: '00.000.000/0001-00',
  inscricao_estadual: '',
  inscricao_municipal: '',
  endereco_logradouro: 'Avenida Principal',
  endereco_numero: '1000',
  endereco_complemento: 'Sala 501',
  endereco_bairro: 'Centro',
  endereco_cidade: 'Criciúma',
  endereco_uf: 'SC',
  endereco_cep: '88800-000',
  telefone: '(48) 3433-0000',
  email: 'contato@nexumsecurity.com.br',
  representante_nome: 'Anderson Leandro',
  representante_cargo: 'Diretor Presidente',
  representante_cpf: '000.000.000-00',
  capital_social: 1000000.0,
  registro_regulador: 'Resolução CVM nº 60/2021',
}

// Cache em memória compartilhado na sessão do browser
let memoryCache: CompanySettings | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minuto

/**
 * Busca os dados cadastrais da securitizadora com cache em memória e fallback seguro.
 */
export async function getCompanySettings(forceRefresh = false): Promise<CompanySettings> {
  const now = Date.now()
  if (!forceRefresh && memoryCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return memoryCache
  }

  try {
    const { data, error } = await (supabase.from('company_settings') as any)
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('Erro ao consultar company_settings do banco:', error)
      return memoryCache || DEFAULT_COMPANY_SETTINGS
    }

    if (data) {
      memoryCache = data as CompanySettings
      cacheTimestamp = now
      return memoryCache
    }

    return memoryCache || DEFAULT_COMPANY_SETTINGS
  } catch (err) {
    console.warn('Falha inesperada ao consultar company_settings:', err)
    return memoryCache || DEFAULT_COMPANY_SETTINGS
  }
}

/**
 * Salva ou atualiza os dados da securitizadora (singleton).
 */
export async function saveCompanySettings(
  formData: CompanySettingsFormData,
): Promise<CompanySettings> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  // Busca se já existe um registro
  const existing = await getCompanySettings(true)

  const payload: any = {
    razao_social: formData.razao_social?.trim() || '[RAZÃO SOCIAL DA SECURITIZADORA]',
    nome_fantasia: formData.nome_fantasia?.trim() || null,
    cnpj: formData.cnpj?.trim() || '00.000.000/0001-00',
    inscricao_estadual: formData.inscricao_estadual?.trim() || null,
    inscricao_municipal: formData.inscricao_municipal?.trim() || null,
    endereco_logradouro: formData.endereco_logradouro?.trim() || null,
    endereco_numero: formData.endereco_numero?.trim() || null,
    endereco_complemento: formData.endereco_complemento?.trim() || null,
    endereco_bairro: formData.endereco_bairro?.trim() || null,
    endereco_cidade: formData.endereco_cidade?.trim() || null,
    endereco_uf: formData.endereco_uf?.trim() || null,
    endereco_cep: formData.endereco_cep?.trim() || null,
    telefone: formData.telefone?.trim() || null,
    email: formData.email?.trim() || null,
    representante_nome: formData.representante_nome?.trim() || null,
    representante_cargo: formData.representante_cargo?.trim() || 'Sócio-Administrador',
    representante_cpf: formData.representante_cpf?.trim() || null,
    capital_social: Number(formData.capital_social) || 0,
    registro_regulador: formData.registro_regulador?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }

  let savedRecord: CompanySettings

  if (existing?.id) {
    const { data, error } = await (supabase.from('company_settings') as any)
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar company_settings:', error)
      throw error
    }
    savedRecord = data as CompanySettings
  } else {
    const { data, error } = await (supabase.from('company_settings') as any)
      .insert({ ...payload })
      .select()
      .single()

    if (error) {
      console.error('Erro ao inserir company_settings:', error)
      throw error
    }
    savedRecord = data as CompanySettings
  }

  // Atualiza cache em memória
  memoryCache = savedRecord
  cacheTimestamp = Date.now()

  // Auditoria
  try {
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      action: 'UPDATE_COMPANY_SETTINGS',
      entity_type: 'company_settings',
      entity_id: savedRecord.id,
      details: {
        razao_social: savedRecord.razao_social,
        cnpj: savedRecord.cnpj,
        updated_at: savedRecord.updated_at,
      },
    })
  } catch (auditErr) {
    console.warn('Falha ao registrar auditoria em company_settings:', auditErr)
  }

  return savedRecord
}

/**
 * Retorna o endereço formatado em uma única linha.
 */
export function formatCompanyAddress(settings?: Partial<CompanySettings> | null): string {
  if (!settings) return ''
  const parts: string[] = []
  if (settings.endereco_logradouro) {
    let log = settings.endereco_logradouro
    if (settings.endereco_numero) log += `, ${settings.endereco_numero}`
    if (settings.endereco_complemento) log += ` - ${settings.endereco_complemento}`
    parts.push(log)
  }
  if (settings.endereco_bairro) parts.push(settings.endereco_bairro)
  if (settings.endereco_cidade || settings.endereco_uf) {
    parts.push(`${settings.endereco_cidade || ''}/${settings.endereco_uf || ''}`)
  }
  if (settings.endereco_cep) parts.push(`CEP: ${settings.endereco_cep}`)
  return parts.join(' - ')
}

/**
 * Monta o preâmbulo contratual oficial da Securitizadora para uso em instrumentos contratuais, aditivos, termos e recibos.
 */
export function buildSecuritizadoraPreambulo(
  settings?: Partial<CompanySettings> | null,
  papel: 'CESSIONÁRIA' | 'EMISSORA' | 'SECURITIZADORA' | 'CREDORA' = 'CESSIONÁRIA',
): string {
  const s = settings || DEFAULT_COMPANY_SETTINGS
  const razao = s.razao_social || '[RAZÃO SOCIAL DA SECURITIZADORA]'
  const cnpjFmt = s.cnpj ? maskCnpj(s.cnpj) : '[CNPJ DA SECURITIZADORA]'
  const enderecoFmt = formatCompanyAddress(s) || '[ENDEREÇO DA SECURITIZADORA]'

  let text = `${razao.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpjFmt}, com sede em ${enderecoFmt}`

  if (s.inscricao_estadual) {
    text += `, Inscrição Estadual nº ${s.inscricao_estadual}`
  }

  if (s.registro_regulador) {
    text += `, devidamente registrada e autorizada nos termos do marco regulatório (${s.registro_regulador})`
  }

  if (s.representante_nome) {
    const cargo = s.representante_cargo || 'Representante Legal'
    const cpfFmt = s.representante_cpf
      ? `, inscrito no CPF sob o nº ${maskCpf(s.representante_cpf)}`
      : ''
    text += `, neste ato representada por seu ${cargo}, Sr(a). ${s.representante_nome}${cpfFmt}`
  }

  text += `, doravante denominada simplesmente "${papel}"`

  return text
}
