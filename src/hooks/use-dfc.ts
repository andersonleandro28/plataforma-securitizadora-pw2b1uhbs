import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { classifyMovimentacaoCaixaDfc } from '@/lib/financial-classification'

/**
 * Seções da Demonstração do Fluxo de Caixa (FASB Statement No. 95) - Método Direto:
 * 1. Atividades Operacionais: recebimentos de clientes (parcelas CCB, liquidação de duplicatas/crédito, juros/taxas),
 *    pagamento a fornecedores, salários, tributos e outras despesas operacionais.
 * 2. Atividades de Investimento: desembolsos líquidos de concessão de crédito / antecipação (saídas de capital para tomadores),
 *    aquisições de CCBs e resgates/aplicações financeiras da empresa.
 * 3. Atividades de Financiamento: captação de recursos com investidores (aportes via debêntures/mútuos/capital),
 *    resgates/devolução de capital pagos aos investidores e distribuições.
 */
export type DfcSecao = 'operacional' | 'investimento' | 'financiamento'

export type DfcLancamento = {
  id: string
  date: string // YYYY-MM-DD
  secao: DfcSecao
  sinal: 'entrada' | 'saida'
  categoriaOriginal: string
  categoria: string
  descricao: string
  valor: number
  origem: string
}

export type DfcSubcategoria = {
  categoria: string
  sinal: 'entrada' | 'saida'
  total: number
  lancamentos: DfcLancamento[]
}

export type DfcSecaoDados = {
  secao: DfcSecao
  titulo: string
  descricao: string
  entradas: DfcSubcategoria[]
  saidas: DfcSubcategoria[]
  totalEntradas: number
  totalSaidas: number
  liquido: number // entradas - saidas
}

export type DfcDados = {
  periodoInicio: string
  periodoFim: string
  lancamentosPeriodo: DfcLancamento[]
  operacional: DfcSecaoDados
  investimento: DfcSecaoDados
  financiamento: DfcSecaoDados
  variacaoLiquidaPeriodo: number // soma dos líquidos das 3 seções
  saldoInicialCaixa: number // saldo acumulado de caixa até dia anterior ao período
  saldoFinalCalculado: number // saldoInicialCaixa + variacaoLiquidaPeriodo
  saldoFinalLivroCaixa: number // saldo acumulado efetivo do Livro Caixa até o fim do período
  divergencia: number // saldoFinalCalculado - saldoFinalLivroCaixa
  temDivergencia: boolean
  saldoGlobalAtual: number // saldo atual de todo o livro caixa
}

/**
 * Normaliza datas para YYYY-MM-DD sem deslocamento por fuso (mesma regra do use-dre e use-accounting).
 */
function normalizeDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0]
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

/**
 * Mapeia rótulo amigável para categorias vindas do banco de dados.
 */
export function labelCategoriaDfc(categoria: string | null | undefined): string {
  if (!categoria) return 'Outros'
  const map: Record<string, string> = {
    liquidação_recebível: 'Liquidação de Recebíveis',
    liquidacao_recebivel: 'Liquidação de Recebíveis',
    juros_entrada: 'Juros Recebidos',
    fornecedor: 'Pagamento Fornecedor',
    despesa: 'Despesa Operacional',
    'resgate de investidor': 'Resgate de Investidor',
    resgate_investimento: 'Resgate de Investidor',
    'resgates e rendimentos': 'Resgate de Investidor',
    'subscrição de debênture': 'Subscrição de Debêntures',
    'desembolso de crédito': 'Desembolso de Crédito',
    'aquisição de ccb': 'Aquisição de CCB',
  }
  return map[categoria.toLowerCase()] || categoria
}

/**
 * Classificação FASB 95 (Método Direto):
 * Determina para qual das três seções a transação pertence.
 *
 * Regras:
 * 1. Financiamento:
 *    - Entradas: Aporte de investidor / Subscrição de debênture, Aporte de Capital.
 *    - Saídas: Resgate de Investidor / Resgate de Investimento / Resgates e Rendimentos.
 * 2. Investimento:
 *    - Saídas: Desembolso de crédito / Aquisição de CCB (empréstimos concedidos a tomadores e compra de carteira).
 *    - Entradas/Saídas: Aplicação financeira / Rendimento de investimentos próprios.
 * 3. Operacional:
 *    - Entradas: Recebimento de Parcelas - CCB, Recebimento de Parcelas - Operação, Liquidação de Recebível,
 *      Juros Recebidos, Receita Avulsa, Crédito em Conta, Receitas Diversas, Reembolso.
 *    - Saídas: Despesas operacionais, Fornecedores, Tecnologia, Aluguel, Impostos, Tarifas bancárias, etc.
 *    - Fallback: Operacional.
 */
export function classificarFasb95(
  categoria: string,
  tipo: 'entrada' | 'saida',
): { secao: DfcSecao; label: string } {
  const catNorm = (categoria || '').toLowerCase().trim()
  const label = labelCategoriaDfc(categoria)

  // 1. Financiamento
  if (
    catNorm.includes('subscrição de debênture') ||
    catNorm.includes('subscricao') ||
    catNorm.includes('aporte de investidor') ||
    catNorm.includes('aporte de capital') ||
    catNorm.includes('aporte')
  ) {
    return { secao: 'financiamento', label }
  }
  if (
    catNorm.includes('resgate de investidor') ||
    catNorm.includes('resgate de investimento') ||
    catNorm.includes('resgates e rendimentos') ||
    catNorm.includes('resgate')
  ) {
    return { secao: 'financiamento', label }
  }

  // 2. Investimento
  if (
    catNorm.includes('desembolso de crédito') ||
    catNorm.includes('desembolso') ||
    catNorm.includes('aquisição de ccb') ||
    catNorm.includes('aquisicao de ccb') ||
    catNorm.includes('compra de ccb')
  ) {
    return { secao: 'investimento', label }
  }

  // 3. Operacional (Recebimentos de clientes / juros / despesas normais de giro / fallback)
  return { secao: 'operacional', label }
}

export function useDfc() {
  const [dados, setDados] = useState<DfcDados | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (inicio: string, fim: string) => {
    try {
      setLoading(true)
      setError(null)

      // Carrega todo o universo de transações históricas usando a MESMA deduplicação
      // e consistência do Livro Caixa e DRE.
      // Desta forma, podemos calcular com exatidão matemática:
      // 1. O saldo acumulado até o dia anterior a `inicio` (Saldo Inicial de Caixa)
      // 2. Todas as movimentações dentro do período `[inicio, fim]`
      // 3. O saldo acumulado até `fim` (Saldo Final do Livro Caixa)
      // 4. A conciliação direta FASB 95
      const [subsRes, recsRes, expsRes, credRes, redsRes, movsRes, tresRes, mapRes] =
        await Promise.all([
          supabase
            .from('debenture_subscriptions')
            .select('id, investor_name, total_amount, subscription_date, created_at, status'),
          supabase
            .from('recebiveis_ccb')
            .select(
              'id, acquisition_value, created_at, boletos, ccb_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
            ),
          supabase
            .from('expenses')
            .select(
              'id, amount, description, payment_date, due_date, status, suppliers(company_name), category',
            ),
          supabase
            .from('credit_operations')
            .select(
              'id, requested_value, face_value, issue_date, created_at, updated_at, status, sacado, liquidation_date, liquidation_value, operation_calculations(net_value)',
            ),
          supabase
            .from('investment_redemptions')
            .select(
              'id, net_value, updated_at, status, profiles!investment_redemptions_user_id_fkey(full_name, pj_company_name)',
            ),
          supabase
            .from('movimentacoes_caixa')
            .select(
              'id, tipo, categoria, descricao, valor, user_id, created_at, referencia_id, referencia_tipo, referencia_numero',
            ),
          supabase
            .from('treasury_transactions')
            .select(
              'id, type, category, amount, description, date, external_ref, expense_id, reference_id, status',
            )
            .or('status.eq.Confirmado,status.is.null'),
          supabase
            .from('mapeamento_movimentacoes')
            .select('movimentacao_caixa_id, origem_tabela, origem_id')
            .in('origem_tabela', ['fornecedores', 'despesas']),
        ])

      type ItemBruto = {
        id: string
        date: string
        sinal: 'entrada' | 'saida'
        categoriaOriginal: string
        descricao: string
        valor: number
        origem: string
      }

      const rawItems: ItemBruto[] = []

      // --- Deduplicações padrão DRE / Livro Caixa ---
      const creditOpIdsNoCaixa = new Set<string>()
      const movsExternalRefs = new Set<string>()
      const redemptionsInMovs = new Set<string>()

      // Mapeamento de movimentacoes_caixa para despesas oficiais (expenses)
      const movIdToExpenseId = new Map<string, string>()
      ;(mapRes.data || []).forEach((m: any) => {
        if (m.movimentacao_caixa_id && m.origem_id) {
          movIdToExpenseId.set(m.movimentacao_caixa_id, m.origem_id)
        }
      })
      const paidExpenseIds = new Set(
        (expsRes.data || []).filter((e: any) => e.status === 'paid').map((e: any) => e.id),
      )

      ;(movsRes.data || []).forEach((mov: any) => {
        // Normalização fail-safe: SOMENTE 'entrada' normalizado vira 'entrada'; qualquer outro vira 'saida'
        const sinal: 'entrada' | 'saida' = classifyMovimentacaoCaixaDfc(mov.tipo)
        const refTipo = (mov.referencia_tipo || '').toLowerCase()

        if (
          sinal === 'saida' &&
          (refTipo === 'recebível' || refTipo === 'recebivel') &&
          mov.referencia_id
        ) {
          creditOpIdsNoCaixa.add(mov.referencia_id)
        }

        if (mov.referencia_id) {
          movsExternalRefs.add(`op-liq-${mov.referencia_id}`)
          movsExternalRefs.add(`redemption-${mov.referencia_id}`)
          if (mov.referencia_tipo === 'resgate_investimento') {
            redemptionsInMovs.add(String(mov.referencia_id))
          }
          if (mov.referencia_numero) {
            movsExternalRefs.add(`op-bol-${mov.referencia_id}-${mov.referencia_numero}`)
            movsExternalRefs.add(String(mov.referencia_numero))
          }
        }

        // Deduplicação: se a despesa vinculada já foi computada via expenses, ignora a duplicata do caixa
        const linkedExpenseId =
          movIdToExpenseId.get(mov.id) ||
          (mov.referencia_tipo === 'despesa' ? mov.referencia_id : null)
        if (linkedExpenseId && paidExpenseIds.has(linkedExpenseId)) {
          return
        }

        const catOriginal = mov.categoria || 'Outros'
        rawItems.push({
          id: `mov-${mov.id}`,
          date: normalizeDate(mov.created_at),
          sinal,
          categoriaOriginal: catOriginal,
          descricao: mov.descricao || labelCategoriaDfc(catOriginal),
          valor: Number(mov.valor || 0),
          origem: 'movimentacoes_caixa',
        })
      })

      // 2. Subscrições de Debêntures (Aportes de Investidores - Financiamento)
      ;(subsRes.data || []).forEach((sub) => {
        const st = (sub.status || '').toLowerCase()
        if (st === 'excluído' || st === 'cancelado') return
        // No DRE considera 'approved' ou 'ativo'
        if (st !== 'approved' && st !== 'ativo' && st !== 'confirmado') return
        rawItems.push({
          id: `sub-${sub.id}`,
          date: normalizeDate(sub.subscription_date || sub.created_at),
          sinal: 'entrada',
          categoriaOriginal: 'Aporte de Investidor',
          descricao: `Aporte — ${sub.investor_name || 'Investidor'}`,
          valor: Number(sub.total_amount || 0),
          origem: 'debenture_subscriptions',
        })
      })

      // 3. Despesas pagas (expenses)
      const expenseIdsInCaixa = new Set<string>()
      ;(expsRes.data || []).forEach((exp) => {
        if (exp.status !== 'paid') return
        expenseIdsInCaixa.add(exp.id)
        const sup = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
        const fornecedor = sup?.company_name
        const cat = exp.category || 'Despesa Operacional'
        rawItems.push({
          id: `exp-${exp.id}`,
          date: normalizeDate(exp.payment_date || exp.due_date),
          sinal: 'saida',
          categoriaOriginal: cat,
          descricao:
            exp.description || (fornecedor ? `Fornecedor — ${fornecedor}` : 'Despesa operacional'),
          valor: Number(exp.amount || 0),
          origem: 'expenses',
        })
      })

      // 4. Operações de Crédito (desembolso concedido ao tomador - Investimento)
      ;(credRes.data || []).forEach((op) => {
        const st = (op.status || '').toLowerCase()
        if (st !== 'liquidado' && st !== 'pago') return
        if (creditOpIdsNoCaixa.has(op.id)) return

        const calc = Array.isArray(op.operation_calculations)
          ? op.operation_calculations[0]
          : op.operation_calculations
        const valor = Number(calc?.net_value ?? op.requested_value ?? 0)
        if (!valor) return

        rawItems.push({
          id: `cre-${op.id}`,
          date: normalizeDate(op.issue_date || op.created_at),
          sinal: 'saida',
          categoriaOriginal: 'Desembolso de Crédito',
          descricao: `Desembolso de Crédito — ${op.sacado || 'Sacado'}`,
          valor,
          origem: 'credit_operations',
        })
      })

      // 5. Transações de Tesouraria (treasury_transactions) - Prioritária
      const treasuryExternalRefs = new Set<string>()
      ;(tresRes.data || []).forEach((t) => {
        const sinal: 'entrada' | 'saida' = t.type === 'out' ? 'saida' : 'entrada'

        // Deduplicação: se a saída já foi computada via expenses, ignora
        if (sinal === 'saida' && t.expense_id && expenseIdsInCaixa.has(t.expense_id)) return

        const extRef = t.external_ref ? String(t.external_ref) : null
        if (extRef && movsExternalRefs.has(extRef)) return
        if (extRef && treasuryExternalRefs.has(extRef)) return
        if (extRef) treasuryExternalRefs.add(extRef)

        const catOriginal =
          t.category || (sinal === 'entrada' ? 'Recebimento de Parcelas - CCB' : 'Tesouraria')
        rawItems.push({
          id: `tre-${t.id}`,
          date: normalizeDate(t.date),
          sinal,
          categoriaOriginal: catOriginal,
          descricao: t.description || catOriginal,
          valor: Number(t.amount || 0),
          origem: 'treasury_transactions',
        })
      })

      // 6. Recebíveis CCB (boletos pagos via JSONB de recebiveis_ccb) - Fallback
      ;(recsRes.data || []).forEach((rec: any) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

        const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
        boletos.forEach((bol: any, i: number) => {
          const bolStatus = (bol.status || '').toLowerCase()
          if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return

          const dataPgto =
            bol.data_pagamento ||
            bol.payment_date ||
            bol.data_liquidacao ||
            bol.data_vencimento ||
            bol.due_date
          if (!dataPgto) return

          const parcela = i + 1
          const extRef = bol.external_ref
            ? String(bol.external_ref)
            : `ccb-bol-${rec.id}-${parcela}`

          if (treasuryExternalRefs.has(extRef)) return
          treasuryExternalRefs.add(extRef)

          const valor =
            Number(bol.valor || bol.unit_value || 0) +
            Number(bol.interest_applied || 0) +
            Number(bol.penalty_applied || 0)
          if (!valor) return

          rawItems.push({
            id: `ccb-${rec.id}-${parcela}`,
            date: normalizeDate(dataPgto),
            sinal: 'entrada',
            categoriaOriginal: 'Recebimento de Parcelas - CCB',
            descricao: `Recebível liquidado — Boleto ${bol.numero || bol.number || parcela} - Tomador: ${tomador}`,
            valor,
            origem: 'recebiveis_ccb',
          })
        })
      })

      // 7. Resgates de Investidores via tabela investment_redemptions (Financiamento - Saída)
      ;(redsRes.data || []).forEach((red) => {
        if (red.status === 'paid') {
          if (redemptionsInMovs.has(red.id) || treasuryExternalRefs.has(`redemption-${red.id}`)) {
            return
          }
          const prof = Array.isArray(red.profiles) ? red.profiles[0] : red.profiles
          const investor = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
          rawItems.push({
            id: `red-${red.id}`,
            date: normalizeDate(red.updated_at),
            sinal: 'saida',
            categoriaOriginal: 'Resgate de Investidor',
            descricao: `Resgate — Investidor: ${investor}`,
            valor: Number(red.net_value || 0),
            origem: 'investment_redemptions',
          })
        }
      })

      // Ordena cronologicamente todos os itens para cálculo de saldo acumulado de caixa
      rawItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let saldoAcumulado = 0
      let saldoInicialCaixa = 0
      let saldoFinalLivroCaixa = 0

      // Converte itens e classifica FASB 95
      const allClassified: DfcLancamento[] = rawItems.map((item) => {
        const { secao, label } = classificarFasb95(item.categoriaOriginal, item.sinal)
        return {
          id: item.id,
          date: item.date,
          secao,
          sinal: item.sinal,
          categoriaOriginal: item.categoriaOriginal,
          categoria: label,
          descricao: item.descricao,
          valor: item.valor,
          origem: item.origem,
        }
      })

      // Calcula saldos acumulados:
      // Saldo inicial: acumulado de tudo com date < inicio
      // Saldo final: acumulado de tudo com date <= fim
      allClassified.forEach((item) => {
        const delta = item.sinal === 'entrada' ? item.valor : -item.valor
        if (item.date < inicio) {
          saldoInicialCaixa += delta
        }
        if (item.date <= fim) {
          saldoFinalLivroCaixa += delta
        }
        saldoAcumulado += delta
      })

      // Filtra os lançamentos do período selecionado
      const lancamentosPeriodo = allClassified.filter((l) => l.date >= inicio && l.date <= fim)

      // Monta as 3 seções do FASB 95
      const montarSecao = (secao: DfcSecao, titulo: string, descricao: string): DfcSecaoDados => {
        const items = lancamentosPeriodo.filter((l) => l.secao === secao)

        const agrupar = (sinal: 'entrada' | 'saida') => {
          const map = new Map<string, DfcSubcategoria>()
          items
            .filter((l) => l.sinal === sinal)
            .forEach((l) => {
              const existing = map.get(l.categoria)
              if (existing) {
                existing.total += l.valor
                existing.lancamentos.push(l)
              } else {
                map.set(l.categoria, {
                  categoria: l.categoria,
                  sinal,
                  total: l.valor,
                  lancamentos: [l],
                })
              }
            })
          return Array.from(map.values()).sort((a, b) => b.total - a.total)
        }

        const entradas = agrupar('entrada')
        const saidas = agrupar('saida')
        const totalEntradas = entradas.reduce((s, c) => s + c.total, 0)
        const totalSaidas = saidas.reduce((s, c) => s + c.total, 0)

        return {
          secao,
          titulo,
          descricao,
          entradas,
          saidas,
          totalEntradas,
          totalSaidas,
          liquido: totalEntradas - totalSaidas,
        }
      }

      const operacional = montarSecao(
        'operacional',
        'Atividades Operacionais',
        'Recebimentos de clientes e parcelas de CCB, liquidações, juros e pagamentos operacionais/fornecedores.',
      )

      const investimento = montarSecao(
        'investimento',
        'Atividades de Investimento',
        'Desembolsos de crédito concedidos aos tomadores e compras de carteiras/CCBs.',
      )

      const financiamento = montarSecao(
        'financiamento',
        'Atividades de Financiamento',
        'Aportes de investidores (captação via debêntures/mútuos) e resgates pagos aos investidores.',
      )

      const variacaoLiquidaPeriodo =
        operacional.liquido + investimento.liquido + financiamento.liquido

      const saldoFinalCalculado = saldoInicialCaixa + variacaoLiquidaPeriodo
      const divergencia = Math.abs(saldoFinalCalculado - saldoFinalLivroCaixa)
      const temDivergencia = divergencia > 0.01 // tolerância de centavos

      setDados({
        periodoInicio: inicio,
        periodoFim: fim,
        lancamentosPeriodo: lancamentosPeriodo.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
        operacional,
        investimento,
        financiamento,
        variacaoLiquidaPeriodo,
        saldoInicialCaixa,
        saldoFinalCalculado,
        saldoFinalLivroCaixa,
        divergencia: saldoFinalCalculado - saldoFinalLivroCaixa,
        temDivergencia,
        saldoGlobalAtual: saldoAcumulado,
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados do DFC.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { dados, loading, error, refetch: fetchData }
}
