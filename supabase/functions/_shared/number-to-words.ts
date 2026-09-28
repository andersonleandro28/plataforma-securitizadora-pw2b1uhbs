/**
 * Helper utilitário para converter valores monetários em reais para texto por extenso (pt-BR).
 * Deno compatible module for Edge Functions.
 */

const UNIDADES = [
  '',
  'Um',
  'Dois',
  'Três',
  'Quatro',
  'Cinco',
  'Seis',
  'Sete',
  'Oito',
  'Nove',
  'Dez',
  'Onze',
  'Doze',
  'Treze',
  'Quatorze',
  'Quinze',
  'Dezesseis',
  'Dezessete',
  'Dezoito',
  'Dezenove',
]

const DEZENAS = [
  '',
  '',
  'Vinte',
  'Trinta',
  'Quarenta',
  'Cinquenta',
  'Sessenta',
  'Setenta',
  'Oitenta',
  'Noventa',
]

const CENTENAS = [
  '',
  'Cento',
  'Duzentos',
  'Trezentos',
  'Quatrocentos',
  'Quinhentos',
  'Seiscentos',
  'Setecentos',
  'Oitocentos',
  'Novecentos',
]

function converterGrupoAte999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'Cem'

  const c = Math.floor(n / 100)
  const resto = n % 100
  const d = Math.floor(resto / 10)
  const u = resto % 10

  const partes: string[] = []

  if (c > 0) {
    partes.push(CENTENAS[c])
  }

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto])
    } else {
      partes.push(DEZENAS[d])
      if (u > 0) {
        partes.push(UNIDADES[u])
      }
    }
  }

  return partes.join(' e ')
}

export function valorPorExtenso(valor: number): string {
  if (isNaN(valor) || valor === 0) return 'Zero Reais'

  const valorAbs = Math.abs(valor)
  const inteira = Math.floor(valorAbs)
  const centavos = Math.round((valorAbs - inteira) * 100)

  const bilhoes = Math.floor(inteira / 1000000000)
  const milhoes = Math.floor((inteira % 1000000000) / 1000000)
  const milhares = Math.floor((inteira % 1000000) / 1000)
  const unidades = inteira % 1000

  const partesReais: string[] = []

  if (bilhoes > 0) {
    partesReais.push(`${converterGrupoAte999(bilhoes)} ${bilhoes === 1 ? 'Bilhão' : 'Bilhões'}`)
  }

  if (milhoes > 0) {
    partesReais.push(`${converterGrupoAte999(milhoes)} ${milhoes === 1 ? 'Milhão' : 'Milhões'}`)
  }

  if (milhares > 0) {
    if (milhares === 1) {
      partesReais.push('Mil')
    } else {
      partesReais.push(`${converterGrupoAte999(milhares)} Mil`)
    }
  }

  if (unidades > 0) {
    partesReais.push(converterGrupoAte999(unidades))
  }

  let textoReais = ''
  if (inteira > 0) {
    textoReais = partesReais.join(' e ')
    textoReais += inteira === 1 ? ' Real' : ' Reais'
  }

  let textoCentavos = ''
  if (centavos > 0) {
    const centavosStr = converterGrupoAte999(centavos)
    textoCentavos = `${centavosStr} ${centavos === 1 ? 'Centavo' : 'Centavos'}`
  }

  if (textoReais && textoCentavos) {
    return `${textoReais} e ${textoCentavos}`
  }
  if (textoReais) {
    return textoReais
  }
  return textoCentavos || 'Zero Reais'
}
