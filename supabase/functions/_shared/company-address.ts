export interface CompanySettingsData {
  id?: string
  razao_social?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
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
  debenture_numero_escritura_padrao?: string | null
  debenture_serie_padrao?: string | null
  debenture_orgao_registro_padrao?: string | null
  debenture_data_registro_padrao?: string | null
  debenture_numero_arquivamento_padrao?: string | null
}

export function formatCompanyCityState(settings?: Partial<CompanySettingsData> | null): string {
  if (!settings) return 'Criciúma/SC'
  const cidade = (settings.endereco_cidade || '').trim()
  const uf = (settings.endereco_uf || '').trim()
  if (cidade && uf) return `${cidade}/${uf}`
  return cidade || uf || 'Criciúma/SC'
}

export function formatCompanyCep(cepRaw?: string | null): string {
  if (!cepRaw) return ''
  const digits = cepRaw.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }
  return cepRaw.trim()
}

/**
 * Retorna o endereço formatado em uma única linha (para cabeçalhos e notas de rodapé).
 * Ex: Rua Antonio Justi, 2470 - Sala 501 - Sangão - Criciúma/SC - CEP: 88807-460
 */
export function formatCompanyAddressLine(settings?: Partial<CompanySettingsData> | null): string {
  if (!settings) return ''
  const parts: string[] = []
  if (settings.endereco_logradouro) {
    let log = settings.endereco_logradouro.trim()
    if (settings.endereco_numero) log += `, ${settings.endereco_numero.trim()}`
    if (settings.endereco_complemento) log += ` - ${settings.endereco_complemento.trim()}`
    parts.push(log)
  }
  if (settings.endereco_bairro) parts.push(settings.endereco_bairro.trim())
  const cityState = formatCompanyCityState(settings)
  if (cityState) parts.push(cityState)
  if (settings.endereco_cep) {
    parts.push(`CEP: ${formatCompanyCep(settings.endereco_cep)}`)
  }
  return parts.join(' - ')
}

/**
 * Retorna o endereço detalhado para cláusulas e preâmbulos:
 * "Rua ANTONIO JUSTI, nº 2470, Sala 501, Bairro SANGÃO, CEP 88807-460"
 */
export function formatCompanyDetailedAddress(
  settings?: Partial<CompanySettingsData> | null,
): string {
  if (!settings) return ''
  const parts: string[] = []
  if (settings.endereco_logradouro) {
    let log = settings.endereco_logradouro.trim()
    if (!/^rua|^av|^alameda|^rodovia|^travessa/i.test(log)) {
      log = `Rua ${log}`
    }
    if (settings.endereco_numero) log += `, nº ${settings.endereco_numero.trim()}`
    if (settings.endereco_complemento) log += `, ${settings.endereco_complemento.trim()}`
    parts.push(log)
  }
  if (settings.endereco_bairro) {
    parts.push(`Bairro ${settings.endereco_bairro.trim()}`)
  }
  if (settings.endereco_cep) {
    parts.push(`CEP ${formatCompanyCep(settings.endereco_cep)}`)
  }
  return parts.join(', ')
}

/**
 * Monta a qualificação oficial da Securitizadora para uso em documentos PDF (Deno).
 * Garante que a frase de sede e foro use estritamente CIDADE/UF, e o endereço completo seja
 * descrito em trecho separado ("com endereço na ...").
 */
export function buildSecuritizadoraPreambleText(
  settings: Partial<CompanySettingsData> | null | undefined,
  papel: 'EMISSORA' | 'CESSIONÁRIA' | 'SECURITIZADORA' = 'EMISSORA',
): string {
  const razao = (settings?.razao_social || 'SEA CONNECTION INVESTIMENTOS S/A').trim().toUpperCase()
  const cnpj = (settings?.cnpj || '60.703.936/0001-00').trim()
  const cidadeUf = formatCompanyCityState(settings)
  const enderecoDetalhado =
    formatCompanyDetailedAddress(settings) || formatCompanyAddressLine(settings)
  const repNome = (settings?.representante_nome || 'Anderson Cardozo Leandro').trim()
  const repCargo = (settings?.representante_cargo || 'Diretor Presidente').trim()
  const repCpf = (settings?.representante_cpf || '020.936.129-84').trim()

  const tipoSociedade =
    papel === 'EMISSORA' ? 'sociedade anônima fechada' : 'pessoa jurídica de direito privado'

  let text = `DE UM LADO, na qualidade de ${papel}, ${razao}, ${tipoSociedade}, inscrita no CNPJ sob o nº ${cnpj}, com sede e foro na cidade de ${cidadeUf}`

  if (enderecoDetalhado) {
    text += `, com endereço na ${enderecoDetalhado}`
  }

  text += `, neste ato representada por seu ${repCargo}, Sr. ${repNome}`
  if (repCpf) {
    text += `, inscrito no CPF sob o nº ${repCpf}`
  }

  text += `, doravante denominada simplesmente "${papel}"; e,`

  return text
}
