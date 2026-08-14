// Utilitários de máscara e validação de CPF/CNPJ

/** Remove tudo que não for dígito. */
export const onlyDigits = (v: string): string => (v || '').replace(/\D/g, '')

/** Aplica a máscara de CPF: 000.000.000-00 */
export const maskCpf = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** Aplica a máscara de CNPJ: 00.000.000/0001-00 */
export const maskCnpj = (v: string): string => {
  const d = onlyDigits(v).slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Aplica a máscara adequada conforme o tipo de entidade (pf/pj). */
export const maskDocument = (v: string, type: 'pf' | 'pj' | null | undefined): string =>
  type === 'pj' ? maskCnpj(v) : maskCpf(v)

/** Valida os dígitos verificadores de um CPF (algoritmo oficial). */
export const validateCpf = (v: string): boolean => {
  const d = onlyDigits(v)
  if (d.length !== 11) return false
  // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(d)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i)
  let rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  if (rev !== parseInt(d[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i)
  rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  if (rev !== parseInt(d[10], 10)) return false

  return true
}

/** Valida os dígitos verificadores de um CNPJ (algoritmo oficial). */
export const validateCnpj = (v: string): boolean => {
  const d = onlyDigits(v)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const calc = (len: number): number => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(d[i], 10) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  if (calc(12) !== parseInt(d[12], 10)) return false
  if (calc(13) !== parseInt(d[13], 10)) return false

  return true
}

/** Valida o documento conforme o tipo de entidade (pf/pj). */
export const validateDocument = (v: string, type: 'pf' | 'pj' | null | undefined): boolean =>
  type === 'pj' ? validateCnpj(v) : validateCpf(v)
