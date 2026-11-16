/**
 * Serviço de quitação de CCB (solicitações em /admin/ccb-requests).
 * Delega os efeitos (baixa, caixa, tarifa PIX, auditoria) à RPC SECURITY DEFINER
 * `quit_ccb_solicitacao`, garantindo atomicidade. O cálculo item a item do diálogo
 * é espelhado aqui e parte do SALDO EM ABERTO: parcelas já pagas (no vencimento ou
 * antecipadas) NÃO entram no total a pagar — apenas as parcelas com status
 * diferente de "Pago"/"Liquidado" no array `boletos` de public.recebiveis_ccb.
 */
import { supabase } from '@/lib/supabase/client'

export interface QuitacaoTaxasDetalhe {
  taxa_emissao_ccb: number
  taxa_analise: number
  taxa_abertura_credito: number
}

export interface QuitacaoParcelasResumo {
  total: number
  pagas: number
  abertas: number
  valor_total: number
  valor_pago: number
  valor_aberto: number
}

export interface QuitacaoCalculo {
  principal_total: number
  parcelas: QuitacaoParcelasResumo
  principal: number // saldo em aberto (base do cálculo)
  juros_periodo: number
  taxa_mensal_aplicada: number
  dias_decorridos: number
  desconto: number
  desconto_pct: number
  taxas_integrais: number
  taxas_detalhe: QuitacaoTaxasDetalhe
  total_quitacao: number
  payment_date: string
  new_status: string
}

export interface QuitCcbParams {
  ccbId: string
  paymentDate?: string // YYYY-MM-DD
  bankAccountId?: string
  notes?: string
  /** % de desconto sobre (saldo em aberto + juros). Omitido = automático pela taxa do contrato */
  discountPct?: number
}

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

/** Taxas de emissão/análise/abertura — INTEGRAIS, nunca recebem desconto */
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

/**
 * Lê o array `boletos` do recebível vinculado (embutido no objeto ccb como
 * ccb._recebivel ou buscado pelo chamador) e resume parcelas pagas × em aberto.
 */
export function resumirParcelas(ccb: any): QuitacaoParcelasResumo {
  const boletos: any[] = Array.isArray(ccb?._recebivel?.boletos)
    ? ccb._recebivel.boletos
    : Array.isArray(ccb?.boletos)
      ? ccb.boletos
      : []

  const resumo: QuitacaoParcelasResumo = {
    total: 0,
    pagas: 0,
    abertas: 0,
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
 * Calcula (sem persistir) a decomposição da quitação a partir do SALDO EM ABERTO:
 * juros proporcionais do período pela taxa do contrato, desconto proporcional e
 * taxas integrais. Espelha exatamente a fórmula da RPC quit_ccb_solicitacao.
 */
export function calcularQuitacaoCcb(
  ccb: any,
  paymentDate: string,
  discountPct?: number,
): QuitacaoCalculo {
  const parcelas = resumirParcelas(ccb)
  const temBoletos = parcelas.total > 0

  // Base do cálculo: saldo em aberto. Sem boletos (fluxo antigo), usa o valor total.
  const principal = temBoletos
    ? parcelas.valor_aberto
    : Number(ccb?.requested_value ?? ccb?.operation_data?.simulation?.requestedValue ?? 0)
  const principalTotal = temBoletos ? parcelas.valor_total : principal

  const taxaMensal = extrairTaxaMensalContrato(ccb) ?? 0
  const emissao = getDataEmissaoCcb(ccb)

  const emissaoDate = new Date(emissao + 'T00:00:00')
  const payDate = new Date(paymentDate + 'T00:00:00')
  const dias = Math.max(0, Math.round((payDate.getTime() - emissaoDate.getTime()) / 86400000))
  const prazoDias = Math.max(30, (Number(ccb?.term_months) || 1) * 30)
  const diasAplicados = Math.min(dias, prazoDias)

  const juros = round2(principal * taxaMensal * (diasAplicados / 30))
  const base = principal + juros

  let descontoPct: number
  let desconto: number
  if (discountPct != null) {
    descontoPct = Math.min(Math.max(discountPct, 0), 100)
    desconto = round2(base * (descontoPct / 100))
  } else {
    // Desconto automático: juros proporcionais do prazo RESTANTE sobre (saldo + juros)
    descontoPct =
      Math.round(taxaMensal * (Math.max(0, prazoDias - diasAplicados) / 30) * 100 * 1e6) / 1e6
    desconto = round2(base * (descontoPct / 100))
  }
  desconto = Math.min(desconto, base)

  const taxas = extrairTaxasIntegrais(ccb)
  const taxasIntegrais = round2(
    taxas.taxa_emissao_ccb + taxas.taxa_analise + taxas.taxa_abertura_credito,
  )

  const total = round2(base - desconto + taxasIntegrais)

  return {
    principal_total: round2(principalTotal),
    parcelas,
    principal: round2(principal),
    juros_periodo: juros,
    taxa_mensal_aplicada: taxaMensal,
    dias_decorridos: dias,
    desconto,
    desconto_pct: descontoPct,
    taxas_integrais: taxasIntegrais,
    taxas_detalhe: taxas,
    total_quitacao: total,
    payment_date: paymentDate,
    new_status: 'liquidado',
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
  })
  if (error) throw error
  return data as { success: boolean; quitacao_id: string; total_quitacao: number; [k: string]: any }
}
