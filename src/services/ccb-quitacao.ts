/**
 * Serviço de quitação de CCB (solicitações em /admin/ccb-requests).
 * Delega o cálculo e os efeitos (baixa, caixa, tarifa PIX, auditoria) à RPC
 * SECURITY DEFINER `quit_ccb_solicitacao`, garantindo atomicidade.
 */
import { supabase } from '@/lib/supabase/client'

export interface QuitacaoTaxasDetalhe {
  taxa_emissao_ccb: number
  taxa_analise: number
  taxa_abertura_credito: number
}

export interface QuitacaoCalculo {
  principal: number
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
  /** % de desconto sobre (principal + juros). Omitido = automático pela taxa do contrato */
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

/**
 * Calcula (sem persistir) a decomposição da quitação: principal, juros proporcionais
 * do período pela taxa do contrato, desconto proporcional e taxas integrais.
 * Espelha exatamente a fórmula da RPC quit_ccb_solicitacao.
 */
export function calcularQuitacaoCcb(
  ccb: any,
  paymentDate: string,
  discountPct?: number,
): QuitacaoCalculo {
  const principal = Number(
    ccb?.requested_value ?? ccb?.operation_data?.simulation?.requestedValue ?? 0,
  )
  const taxaMensal = extrairTaxaMensalContrato(ccb) ?? 0
  const emissao = getDataEmissaoCcb(ccb)

  const emissaoDate = new Date(emissao + 'T00:00:00')
  const payDate = new Date(paymentDate + 'T00:00:00')
  const dias = Math.max(0, Math.round((payDate.getTime() - emissaoDate.getTime()) / 86400000))
  const prazoDias = Math.max(30, (Number(ccb?.term_months) || 1) * 30)
  const diasAplicados = Math.min(dias, prazoDias)

  const juros = Math.round(principal * taxaMensal * (diasAplicados / 30) * 100) / 100
  const base = principal + juros

  let descontoPct: number
  let desconto: number
  if (discountPct != null) {
    descontoPct = Math.min(Math.max(discountPct, 0), 100)
    desconto = Math.round(base * (descontoPct / 100) * 100) / 100
  } else {
    // Desconto automático: juros proporcionais do prazo RESTANTE sobre (principal + juros)
    descontoPct =
      Math.round(taxaMensal * (Math.max(0, prazoDias - diasAplicados) / 30) * 100 * 1e6) / 1e6
    desconto = Math.round(base * (descontoPct / 100) * 100) / 100
  }
  desconto = Math.min(desconto, base)

  const taxas = extrairTaxasIntegrais(ccb)
  const taxasIntegrais =
    Math.round((taxas.taxa_emissao_ccb + taxas.taxa_analise + taxas.taxa_abertura_credito) * 100) /
    100

  const total = Math.round((base - desconto + taxasIntegrais) * 100) / 100

  return {
    principal: Math.round(principal * 100) / 100,
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
