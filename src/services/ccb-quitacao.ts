/**
 * Serviço de quitação de CCB (solicitações em /admin/ccb-requests).
 *
 * MÉTODO: valor presente parcela a parcela — o mesmo critério usado pelos
 * bancos em liquidação antecipada (Resolução BCB 3.919/2010, art. 8º).
 *
 *     VP_k = parcela_k / (1 + i)^(dias_k / 30)
 *
 * i      = taxa mensal do contrato
 * dias_k = dias entre o pagamento e o vencimento da parcela k
 *
 * Antes, o sistema somava "juros do período decorrido" sobre o saldo em aberto
 * e descontava "juros do prazo restante" de forma linear. Os dois passos estão
 * errados: o saldo do boleto já é a soma das parcelas contratadas (o
 * interest_applied só existe quando há mora), e juros não são lineares.
 * Numa CCB de 10.000 em 12x a 2% a.m. quitada no 2º mês, a fórmula antiga
 * cobrava R$ 8.320 e a bancária cobra R$ 9.152 — o sistema estava devolvendo
 * R$ 832 a mais de desconto do que o contrato permite.
 *
 * Este arquivo espelha EXATAMENTE a RPC quit_ccb_solicitacao. Se divergir, a
 * tela mostra um número e o banco grava outro.
 */
import { supabase } from '@/lib/supabase/client'

export interface QuitacaoTaxasDetalhe {
  taxa_emissao_ccb: number
  taxa_analise: number
  taxa_abertura_credito: number
  modo?: string
}

export interface QuitacaoParcelasResumo {
  total: number
  pagas: number
  abertas: number
  vencidas: number
  valor_total: number
  valor_pago: number
  valor_aberto: number
}

/** Linha do demonstrativo, uma por parcela em aberto. */
export interface QuitacaoParcelaLinha {
  vencimento: string
  valor_face: number
  dias_ate_vencimento: number
  valor_presente: number
  vencida: boolean
}

export interface QuitacaoCalculo {
  principal_total: number
  parcelas: QuitacaoParcelasResumo
  principal: number // soma do valor de face das parcelas em aberto
  valor_presente: number // total a pagar antes de desconto comercial e taxas
  desagio: number // juros futuros não devidos (informativo)
  mora: number // multa + juros de mora de parcelas vencidas
  taxa_mensal_aplicada: number
  dias_decorridos: number
  desconto: number // desconto concedido
  desconto_pct: number
  taxas_integrais: number
  taxas_detalhe: QuitacaoTaxasDetalhe
  total_quitacao: number
  payment_date: string
  new_status: string
  linhas: QuitacaoParcelaLinha[]
}

export interface QuitCcbParams {
  ccbId: string
  paymentDate?: string // YYYY-MM-DD
  bankAccountId?: string
  notes?: string
  /** % de desconto COMERCIAL adicional sobre o valor presente. Omitido = nenhum */
  discountPct?: number
  /** 'cobrar' (padrão) | 'nao_cobrar' — ver comentário na migration */
  taxasModo?: 'cobrar' | 'nao_cobrar'
}

/** Multa e mora padrão aplicadas a parcela vencida (espelha a RPC) */
const MULTA_PCT = 2.0
const MORA_MENSAL_PCT = 1.0

/** Extrai a taxa mensal (decimal) da simulação da CCB, com os mesmos fallbacks da RPC */
export function extrairTaxaMensalContrato(ccb: any): number | null {
  const sim = ccb?.operation_data?.simulation || {}
  if (sim.rate_used != null && Number(sim.rate_used) > 0) return Number(sim.rate_used)
  if (sim.interest_rate_monthly != null && Number(sim.interest_rate_monthly) > 0)
    return Number(sim.interest_rate_monthly) / 100
  if (ccb?.operation_data?.proposedRate != null && Number(ccb.operation_data.proposedRate) > 0)
    return Number(ccb.operation_data.proposedRate) / 100
  return null
}

/** Taxas de emissão/análise/abertura */
export function extrairTaxasIntegrais(ccb: any): QuitacaoTaxasDetalhe {
  const sim = ccb?.operation_data?.simulation || {}
  const num = (v: any) => (v != null && Number(v) > 0 ? Number(v) : 0)
  return {
    taxa_emissao_ccb: num(
      sim.fixed_cost ?? sim.fixedCost ?? sim.taxa_emissao ?? sim.valorTarifas ?? 0,
    ),
    taxa_analise: num(sim.taxa_analise ?? sim.taxaAnalise ?? sim.analysis_fee ?? 0),
    taxa_abertura_credito: num(sim.taxa_abertura ?? sim.taxaAbertura ?? sim.opening_fee ?? 0),
  }
}

export function getDataEmissaoCcb(ccb: any): string {
  const sim = ccb?.operation_data?.simulation || {}
  return (
    sim.first_due_date ||
    sim.dataEmissao ||
    (ccb?.created_at ? String(ccb.created_at).slice(0, 10) : '') ||
    new Date().toISOString().slice(0, 10)
  )
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Status que indicam parcela quitada (paga no vencimento ou antecipada) */
export function isParcelaPaga(status: any): boolean {
  const st = String(status ?? '').toLowerCase()
  return st === 'pago' || st === 'paga' || st === 'liquidado' || st === 'liquidada'
}

function extrairBoletos(ccb: any): any[] {
  if (Array.isArray(ccb?._recebivel?.boletos)) return ccb._recebivel.boletos
  if (Array.isArray(ccb?.boletos)) return ccb.boletos
  return []
}

/** Diferença em dias inteiros entre duas datas YYYY-MM-DD (b - a) */
function diasEntre(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

export function resumirParcelas(ccb: any): QuitacaoParcelasResumo {
  const boletos = extrairBoletos(ccb)
  const resumo: QuitacaoParcelasResumo = {
    total: 0,
    pagas: 0,
    abertas: 0,
    vencidas: 0,
    valor_total: 0,
    valor_pago: 0,
    valor_aberto: 0,
  }
  for (const b of boletos) {
    const valor = Number(b?.unit_value ?? 0)
    resumo.total += 1
    resumo.valor_total = round2(resumo.valor_total + valor)
    if (isParcelaPaga(b?.status)) {
      resumo.pagas += 1
      resumo.valor_pago = round2(resumo.valor_pago + valor)
    } else {
      resumo.abertas += 1
      resumo.valor_aberto = round2(resumo.valor_aberto + valor)
    }
  }
  return resumo
}

/**
 * Calcula (sem persistir) a quitação pelo método de valor presente.
 * Espelha exatamente a RPC quit_ccb_solicitacao.
 */
export function calcularQuitacaoCcb(
  ccb: any,
  paymentDate: string,
  discountPct?: number,
  taxasModo: 'cobrar' | 'nao_cobrar' = 'cobrar',
): QuitacaoCalculo | null {
  const taxaMensal = extrairTaxaMensalContrato(ccb)
  // Sem taxa não há valor presente: quem chama mostra o aviso de taxa ausente.
  if (taxaMensal == null || taxaMensal <= 0) return null

  const boletos = extrairBoletos(ccb)
  const parcelas = resumirParcelas(ccb)
  const linhas: QuitacaoParcelaLinha[] = []

  let principal = 0
  let principalTotal = 0
  let totalPago = 0
  let vp = 0
  let desagio = 0
  let mora = 0
  let vencidas = 0
  let abertas = 0

  if (boletos.length === 0) {
    // Fluxo antigo: parcela única no fim do prazo do contrato.
    principal = Number(ccb?.requested_value ?? ccb?.operation_data?.simulation?.requestedValue ?? 0)
    if (principal <= 0) return null
    principalTotal = principal
    abertas = 1

    const emissao = getDataEmissaoCcb(ccb)
    const prazoMeses = Math.max(1, Number(ccb?.term_months) || 1)
    const decorridos = Math.max(0, diasEntre(emissao, paymentDate)) / 30
    const restantes = Math.max(0, prazoMeses - decorridos)
    vp = round2(principal / Math.pow(1 + taxaMensal, restantes))
    desagio = round2(principal - vp)

    linhas.push({
      vencimento: emissao,
      valor_face: round2(principal),
      dias_ate_vencimento: Math.round(restantes * 30),
      valor_presente: vp,
      vencida: false,
    })
  } else {
    for (const b of boletos) {
      const face = Number(b?.unit_value ?? 0)
      principalTotal = round2(principalTotal + face)

      if (isParcelaPaga(b?.status)) {
        totalPago = round2(totalPago + face)
        continue
      }

      abertas += 1
      principal = round2(principal + face)

      const venc = b?.due_date ? String(b.due_date).slice(0, 10) : ''
      if (!venc) {
        vp = round2(vp + face)
        linhas.push({
          vencimento: '—',
          valor_face: round2(face),
          dias_ate_vencimento: 0,
          valor_presente: round2(face),
          vencida: false,
        })
        continue
      }

      const dias = diasEntre(paymentDate, venc)
      let vpItem = 0

      if (dias >= 0) {
        vpItem = round2(face / Math.pow(1 + taxaMensal, dias / 30))
        desagio = round2(desagio + (face - vpItem))
      } else {
        vencidas += 1
        const atraso = Math.abs(dias)
        const moraItem = round2(
          face * (MULTA_PCT / 100) + face * (MORA_MENSAL_PCT / 100) * (atraso / 30),
        )
        mora = round2(mora + moraItem)
        vpItem = round2(face + moraItem)
      }

      vp = round2(vp + vpItem)
      linhas.push({
        vencimento: venc,
        valor_face: round2(face),
        dias_ate_vencimento: dias,
        valor_presente: vpItem,
        vencida: dias < 0,
      })
    }
  }

  const parcelasResumo: QuitacaoParcelasResumo = {
    ...parcelas,
    total: parcelas.total || abertas,
    abertas,
    vencidas,
    valor_pago: totalPago,
    valor_aberto: principal,
    valor_total: principalTotal,
  }

  // Desconto comercial opcional sobre o valor presente
  let desconto = 0
  let descontoPct = 0
  if (discountPct != null && !isNaN(discountPct)) {
    descontoPct = Math.min(Math.max(discountPct, 0), 100)
    desconto = round2(vp * (descontoPct / 100))
  } else {
    desconto = desagio
    descontoPct = principal + mora > 0 ? round2((desagio / (principal + mora)) * 100) : 0
  }

  const taxas = extrairTaxasIntegrais(ccb)
  const taxasIntegrais =
    taxasModo === 'nao_cobrar'
      ? 0
      : round2(taxas.taxa_emissao_ccb + taxas.taxa_analise + taxas.taxa_abertura_credito)

  const total = round2(vp - desconto + taxasIntegrais)

  const emissao = getDataEmissaoCcb(ccb)

  return {
    principal_total: principalTotal,
    parcelas: parcelasResumo,
    principal,
    valor_presente: vp,
    desagio,
    mora,
    taxa_mensal_aplicada: taxaMensal,
    dias_decorridos: Math.max(0, diasEntre(emissao, paymentDate)),
    desconto,
    desconto_pct: descontoPct,
    taxas_integrais: taxasIntegrais,
    taxas_detalhe: { ...taxas, modo: taxasModo },
    total_quitacao: total,
    payment_date: paymentDate,
    new_status: 'liquidado',
    linhas,
  }
}

/** Executa a quitação atômica no backend (baixa + caixa + PIX + auditoria) */
export async function confirmarQuitacaoCcb(params: QuitCcbParams) {
  const { data, error } = await supabase.rpc('quit_ccb_solicitacao', {
    p_ccb_id: params.ccbId,
    p_payment_date: params.paymentDate ?? null,
    p_bank_account_id: params.bankAccountId ?? null,
    p_notes: params.notes ?? null,
    p_discount_pct: params.discountPct ?? null,
    p_taxas_modo: params.taxasModo ?? null,
  })
  if (error) throw error
  return data as { success: boolean; quitacao_id: string; total_quitacao: number; [k: string]: any }
}
