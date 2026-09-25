// Utilitários de máscara e validação de CPF/CNPJ

/** Remove tudo que não for dígito. */
export const onlyDigits = (v: string): string => (v || '').replace(/\D/g, '')

/** Aplica a máscara de CPF: 000.000.000-00 */
export const maskCpf = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11)
  if (!d) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1.$2')
  if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3')
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
}

/** Aplica a máscara de CNPJ: 00.000.000/0001-00 */
export const maskCnpj = (v: string): string => {
  const d = onlyDigits(v).slice(0, 14)
  if (!d) return ''
  if (d.length <= 2) return d
  if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, '$1.$2')
  if (d.length <= 8) return d.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3')
  if (d.length <= 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4')
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
}

/** Aplica a máscara de Telefone: (00) 0000-0000 (fixo, 10 dígitos) ou (00) 00000-0000 (celular, 11 dígitos) */
export const maskPhone = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) {
    // Telefone fixo (ex: (48) 3433-0000)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  // Celular (11 dígitos: (48) 99999-0000)
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}

/** Aplica a máscara de CEP: 00000-000 */
export const maskCep = (v: string): string => {
  const d = onlyDigits(v).slice(0, 8)
  if (!d) return ''
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** Aplica a máscara adequada conforme o tipo de entidade (pf/pj). */
export const maskDocument = (v: string, type: 'pf' | 'pj' | null | undefined): string =>
  type === 'pj' ? maskCnpj(v) : maskCpf(v)

/** Valida os dígitos verificadores de um CPF (algoritmo oficial). */
export const validateCpf = (v: string | null | undefined): boolean => {
  if (!v) return false
  const d = onlyDigits(v)
  if (d.length !== 11) return false
  // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11, 000.000.000-00)
  if (/^(\d)\1{10}$/.test(d)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(d.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(d.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(d.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(d.charAt(10), 10)) return false

  return true
}

/** Valida os dígitos verificadores de um CNPJ (algoritmo oficial módulo 11). */
export const validateCnpj = (v: string | null | undefined): boolean => {
  if (!v) return false
  const d = onlyDigits(v)
  if (d.length !== 14) return false
  // Rejeita sequências repetidas (ex: 00000000000000, 11111111111111)
  if (/^(\d)\1{13}$/.test(d)) return false

  const calc = (len: number): number => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) {
      sum += parseInt(d.charAt(i), 10) * weights[i]
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  if (calc(12) !== parseInt(d.charAt(12), 10)) return false
  if (calc(13) !== parseInt(d.charAt(13), 10)) return false

  return true
}

/** Valida o documento conforme o tipo de entidade (pf/pj). */
export const validateDocument = (v: string, type: 'pf' | 'pj' | null | undefined): boolean =>
  type === 'pj' ? validateCnpj(v) : validateCpf(v)
