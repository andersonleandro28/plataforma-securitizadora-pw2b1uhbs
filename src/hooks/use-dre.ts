import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  classifyMovimentacaoCaixaDre,
  isTaxProvisionTransaction,
} from '@/lib/financial-classification'

export type DreTipo = 'receita' | 'despesa'

export type DreLancamento = {
  id: string
  date: string // YYYY-MM-DD
  tipo: DreTipo
  categoriaOriginal: string
  categoria: string // rótulo exibido
  descricao: string
  valor: number
  origem: string // tabela/origem do dado
}

export type DreCategoria = {
  categoria: string
  tipo: DreTipo
  total: number
  lancamentos: DreLancamento[]
}

export type DreDados = {
  lancamentos: DreLancamento[]
  receitasPorCategoria: DreCategoria[]
  despesasPorCategoria: DreCategoria[]
  totalReceitas: number
  totalDespesas: number
  resultado: number
}

/**
 * Normaliza datas para YYYY-MM-DD evitando deslocamento de fuso (mesma
 * abordagem adotada em use-accounting.ts).
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

/** Traduz categorias brutas de `movimentacoes_caixa` para rótulos legíveis. */
const CATEGORIA_LABEL: Record<string, string> = {
  liquidação_recebível: 'Liquidação de Recebíveis',
  liquidacao_recebivel: 'Liquidação de Recebíveis',
  juros_entrada: 'Juros Recebidos',
  fornecedor: 'Pagamento Fornecedor',
  despesa: 'Despesa Operacional',
  'resgate de investidor': 'Resgate de Investidor',
  resgate_investimento: 'Resgate de Investidor',
  'resgates e rendimentos': 'Resgate de Investidor',
}

function labelCategoria(categoria: string | null | undefined): string {
  if (!categoria) return 'Outros'
  return CATEGORIA_LABEL[categoria.toLowerCase()] || categoria
}

/**
 * Hook que consolida os dados da DRE (Demonstração do Resultado do Exercício).
 * Busca receitas e despesas do Livro Caixa (movimentacoes_caixa), aportes de
 * investidores (debenture_subscriptions), despesas operacionais (expenses),
 * transações de tesouraria (treasury_transactions — ex.: recebimento de
 * parcelas de CCB) e desembolsos de crédito (credit_operations), com sua
 * própria lógica de agrupamento e totais.
 */
export function useDre() {
  const [dados, setDados] = useState<DreDados | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (inicio: string, fim: string) => {
    try {
      setLoading(true)
      setError(null)

      const inicioTs = `${inicio}T00:00:00`
      const fimTs = `${fim}T23:59:59`

      // Busca todas as despesas pagas (e mapeamentos) para ter a data real de pagamento/vencimento
      // e evitar que despesas de outros meses criadas no caixa caiam no período errado.
      const [
        movsRes,
        subsRes,
        expsRes,
        tresRes,
        credRes,
        ccbRes,
        mapRes,
        allPaidExpsRes,
        allRedemptionsRes,
      ] = await Promise.all([
        supabase
          .from('movimentacoes_caixa')
          .select(
            'id, tipo, categoria, descricao, valor, created_at, referencia_tipo, referencia_id, referencia_numero',
          )
          .is('deleted_at', null),
        supabase
          .from('debenture_subscriptions')
          .select('id, investor_name, total_amount, subscription_date, created_at, status')
          .gte('subscription_date', inicio)
          .lte('subscription_date', fim),
        supabase
          .from('expenses')
          .select(
            'id, amount, description, payment_date, due_date, status, category, supplier_id, suppliers(company_name)',
          )
          .or(
            `and(payment_date.gte.${inicio},payment_date.lte.${fim}),and(payment_date.is.null,and(due_date.gte.${inicio},due_date.lte.${fim}))`,
          ),
        supabase
          .from('treasury_transactions')
          .select(
            'id, type, category, amount, description, date, external_ref, expense_id, reference_id, status',
          )
          .is('deleted_at', null)
          .or('status.eq.Confirmado,status.is.null')
          .gte('date', inicio)
          .lte('date', fim),
        supabase
          .from('credit_operations')
          .select(
            'id, status, issue_date, sacado, requested_value, operation_calculations(net_value)',
          )
          .gte('issue_date', inicio)
          .lte('issue_date', fim),
        // 6. Recebíveis CCB (boletos pagos via JSONB).
        // Fonte de segurança: alguns boletos pagos no JSONB `recebiveis_ccb.boletos`
        // não foram sincronizados para `treasury_transactions` (falha do trigger),
        // mas precisam ser refletidos no DRE. A deduplicação por `external_ref`
        // (formato `ccb-bol-{recebivel_id}-{parcela}`) evita somar duas vezes os
        // boletos que já chegaram via treasury_transactions. Trazer todas as CCBs
        // ativas (não é possível filtrar por data de pagamento no nível da API,
        // pois ela vive dentro do JSONB) e filtrar em memória.
        supabase
          .from('recebiveis_ccb')
          .select(
            'id, ccb_id, boletos, status, tomador_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
          )
          .or(`status.eq.Ativo,boletos.neq.[]`),
        // Mapeamentos de movimentações para correlacionar despesas/fornecedores entre tabelas
        supabase
          .from('mapeamento_movimentacoes')
          .select('movimentacao_caixa_id, origem_tabela, origem_id')
          .in('origem_tabela', ['fornecedores', 'despesas', 'investment_redemptions']),
        // Catálogo global de despesas para consultar data efetiva de pagamento/vencimento
        supabase.from('expenses').select('id, payment_date, due_date, status'),
        // Catálogo de resgates para consultar data efetiva do resgate
        supabase.from('investment_redemptions').select('id, updated_at, created_at, status'),
      ])

      const lancamentos: DreLancamento[] = []

      // Dicionário de todas as despesas (para saber a data efetiva de competência/pagamento)
      const expenseMap = new Map<
        string,
        { payment_date: string | null; due_date: string | null; status: string }
      >()
      ;(allPaidExpsRes.data || []).forEach((e: any) => {
        expenseMap.set(e.id, {
          payment_date: e.payment_date,
          due_date: e.due_date,
          status: e.status,
        })
      })

      // Dicionário de resgates para saber data efetiva
      const redemptionMap = new Map<
        string,
        { updated_at: string; created_at: string; status: string }
      >()
      ;(allRedemptionsRes.data || []).forEach((r: any) => {
        redemptionMap.set(r.id, {
          updated_at: r.updated_at,
          created_at: r.created_at,
          status: r.status,
        })
      })

      // Mapeamento de movimentacoes_caixa para despesas oficiais (expenses) e resgates
      const movIdToExpenseId = new Map<string, string>()
      const expenseIdToMovId = new Map<string, string>()
      ;(mapRes.data || []).forEach((m: any) => {
        if (m.movimentacao_caixa_id && m.origem_id) {
          if (m.origem_tabela === 'fornecedores' || m.origem_tabela === 'despesas') {
            movIdToExpenseId.set(m.movimentacao_caixa_id, m.origem_id)
            expenseIdToMovId.set(m.origem_id, m.movimentacao_caixa_id)
          }
        }
      })

      // 1. Movimentações de Caixa (Livro Caixa)
      // DEDUPLICAÇÃO DE FORNECEDORES E DESPESAS:
      // Se um pagamento de fornecedor ou despesa já consta no Livro Caixa E também
      // na tabela de despesas pagas (expenses), a tabela `expenses` é a fonte oficial.
      // Para as movimentações vinculadas a despesas:
      //  - Se a despesa for paga ('paid'), sua data real é payment_date (ou due_date).
      //    Se essa data real NÃO estiver no período [inicio, fim], a despesa NÃO pertence ao mês atual!
      //  - Se estiver no período atual, ela será computada pela fonte oficial `expenses` (passo 3).
      //  - Em AMBOS os casos, suprimimos a movimentação duplicada do caixa para que ela NUNCA
      //    vaze para outro mês por causa do `created_at`.
      const creditOpIdsNoCaixa = new Set<string>()
      const movsExternalRefs = new Set<string>()
      const movsExpenseIdsLinked = new Set<string>()

      ;(movsRes.data || []).forEach((mov: any) => {
        const tipo: DreTipo = classifyMovimentacaoCaixaDre(mov.tipo)
        const catOriginal = mov.categoria || 'Outros'
        const refTipo = (mov.referencia_tipo || '').toLowerCase()

        if (
          tipo === 'despesa' &&
          (refTipo === 'recebível' || refTipo === 'recebivel') &&
          mov.referencia_id
        ) {
          creditOpIdsNoCaixa.add(mov.referencia_id)
        }
        if (mov.referencia_id) {
          movsExternalRefs.add(`op-liq-${mov.referencia_id}`)
          movsExternalRefs.add(`redemption-${mov.referencia_id}`)
          if (mov.referencia_numero) {
            movsExternalRefs.add(`op-bol-${mov.referencia_id}-${mov.referencia_numero}`)
            movsExternalRefs.add(String(mov.referencia_numero))
          }
        }

        // Se esta movimentação de caixa está vinculada a uma despesa (via mapeamento_movimentacoes ou referencia_id)
        const linkedExpenseId =
          movIdToExpenseId.get(mov.id) || (refTipo === 'despesa' ? mov.referencia_id : null)
        if (linkedExpenseId) {
          movsExpenseIdsLinked.add(linkedExpenseId)
        }

        // Se está vinculada a uma despesa em `expenses`:
        // A fonte oficial `expenses` já é lida no passo 3 com a data correta (payment_date / due_date).
        // Logo, suprimimos da fonte de movimentações de caixa para evitar duplicação ou vazamento de data.
        if (linkedExpenseId && expenseMap.has(linkedExpenseId)) {
          return
        }

        // Determina a data efetiva de competência/realização da movimentação:
        let effectiveDate = normalizeDate(mov.created_at)

        // Se for resgate de investimento, verifica a data de liquidação em investment_redemptions
        if (
          refTipo === 'resgate_investimento' &&
          mov.referencia_id &&
          redemptionMap.has(mov.referencia_id)
        ) {
          const red = redemptionMap.get(mov.referencia_id)!
          effectiveDate = normalizeDate(red.updated_at || red.created_at)
        }

        // Aplica o filtro estrito do período [inicio, fim] sobre a data efetiva
        if (effectiveDate < inicio || effectiveDate > fim) {
          return
        }

        lancamentos.push({
          id: `mov-${mov.id}`,
          date: effectiveDate,
          tipo,
          categoriaOriginal: catOriginal,
          categoria: labelCategoria(catOriginal),
          descricao: mov.descricao || labelCategoria(catOriginal),
          valor: Number(mov.valor || 0),
          origem: 'movimentacoes_caixa',
        })
      })

      // 2. Subscrições de Debêntures (aportes de investidores)
      // Considera status "approved" (especificado) e também "Ativo" (valor
      // realmente usado em produção pelo fluxo de subscrição).
      ;(subsRes.data || []).forEach((sub) => {
        const st = (sub.status || '').toLowerCase()
        if (st !== 'approved' && st !== 'ativo') return
        lancamentos.push({
          id: `sub-${sub.id}`,
          date: normalizeDate(sub.subscription_date || sub.created_at),
          tipo: 'receita',
          categoriaOriginal: 'aporte_investidor',
          categoria: 'Aporte de Investidor',
          descricao: `Aporte — ${sub.investor_name || 'Investidor'}`,
          valor: Number(sub.total_amount || 0),
          origem: 'debenture_subscriptions',
        })
      })

      // 3. Despesas operacionais (expenses) pagas no período.
      // Considera despesas com status "paid" (pagas); usa payment_date quando
      // houver, senão due_date.
      const expenseIdsInDre = new Set<string>()
      ;(expsRes.data || []).forEach((exp) => {
        if (exp.status !== 'paid') return
        expenseIdsInDre.add(exp.id)
        const sup = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
        const fornecedor = sup?.company_name
        const dataLanc = normalizeDate(exp.payment_date || exp.due_date)
        lancamentos.push({
          id: `exp-${exp.id}`,
          date: dataLanc,
          tipo: 'despesa',
          categoriaOriginal: exp.category || 'despesa',
          categoria: fornecedor
            ? `Pagamento Fornecedor — ${fornecedor}`
            : labelCategoria(exp.category) || 'Despesa Operacional',
          descricao:
            exp.description || (fornecedor ? `Fornecedor — ${fornecedor}` : 'Despesa operacional'),
          valor: Number(exp.amount || 0),
          origem: 'expenses',
        })
      })

      // 5. Operações de Crédito (credit_operations).
      // Operações liquidadas ou pagas geram um desembolso (saída do dinheiro
      // emprestado ao cliente). Considera os status 'liquidado' e 'pago'.
      // Usa issue_date como data e net_value (via operation_calculations)
      // como valor. Deduplica contra lançamentos já existentes no caixa
      // vinculados via referencia_tipo = 'recebível'.
      ;(credRes.data || []).forEach((op) => {
        const st = (op.status || '').toLowerCase()
        if (st !== 'liquidado' && st !== 'pago') return
        // Deduplicação: desembolso já refletido no Livro Caixa.
        if (creditOpIdsNoCaixa.has(op.id)) return

        const calc = Array.isArray(op.operation_calculations)
          ? op.operation_calculations[0]
          : op.operation_calculations
        const valor = Number(calc?.net_value ?? op.requested_value ?? 0)
        if (!valor) return

        lancamentos.push({
          id: `cre-${op.id}`,
          date: normalizeDate(op.issue_date),
          tipo: 'despesa',
          categoriaOriginal: 'desembolso_credito',
          categoria: 'Desembolso de Crédito',
          descricao: `Desembolso de Crédito — ${op.sacado || 'Sacado'}`,
          valor,
          origem: 'credit_operations',
        })
      })

      // 4. Transações de Tesouraria (treasury_transactions).
      // Entradas (type='in') entram como receita (ex.: recebimento de parcelas
      // de CCB). Saídas (type='out') entram como despesa, mas são deduplicadas
      // contra o expenses quando vinculadas via expense_id, para evitar dupla
      // contagem.
      // Também deduplica contra lançamentos de caixa já existentes usando movsExternalRefs
      // (ex.: op-liq-{id} ou op-bol-{id}-{numero}).
      // Coleta os `external_ref` já processados para deduplicar contra os
      // boletos pagos do `recebiveis_ccb` (fonte 6) — o trigger que popula a
      // tesouraria usa o formato `ccb-bol-{recebivel_id}-{parcela}`.
      const treasuryExternalRefs = new Set<string>()
      ;(tresRes.data || []).forEach((t) => {
        // Exclui provisões de IRRF retido sobre resgates de investidores:
        // São provisões de passivo (imposto a recolher), e não despesas da empresa.
        // O recolhimento de DARF entra oficialmente via `expenses` (categoria 'Imposto').
        if (isTaxProvisionTransaction(t)) return

        const tipo: DreTipo = t.type === 'out' ? 'despesa' : 'receita'
        // Deduplicação: se a saída já está refletida em expenses, ignora.
        if (tipo === 'despesa' && t.expense_id && expenseIdsInDre.has(t.expense_id)) return

        const extRef = t.external_ref ? String(t.external_ref) : null
        // Deduplicação: se o evento já foi lançado em movimentacoes_caixa, ignora.
        if (extRef && movsExternalRefs.has(extRef)) return

        if (extRef) treasuryExternalRefs.add(extRef)

        const catOriginal =
          t.category || (tipo === 'receita' ? 'Recebimento de Parcelas - CCB' : 'Tesouraria')
        lancamentos.push({
          id: `tre-${t.id}`,
          date: normalizeDate(t.date),
          tipo,
          categoriaOriginal: catOriginal,
          categoria: catOriginal,
          descricao: t.description || catOriginal,
          valor: Number(t.amount || 0),
          origem: 'treasury_transactions',
        })
      })

      // 6. Recebíveis CCB (boletos pagos via JSONB).
      // Alguns boletos pagos no JSONB `recebiveis_ccb.boletos` não foram
      // sincronizados para `treasury_transactions` (o trigger falhou para eles),
      // mas precisam constar no DRE. Itera sobre os boletos de cada CCB, filtra
      // os pagos cuja data de pagamento cai no período e os converte em
      // entradas `type: 'in'`. Pula qualquer boleto já processado pela
      // tesouraria (mesmo `external_ref`).
      ;(ccbRes.data || []).forEach((rec: any) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

        const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
        boletos.forEach((bol: any, i: number) => {
          const bolStatus = (bol.status || '').toLowerCase()
          if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return

          const dataPgto =
            bol.data_pagamento || bol.payment_date || bol.data_liquidacao || bol.data_vencimento
          if (!dataPgto) return

          const dataLanc = normalizeDate(dataPgto)
          // Filtra o período em memória (a data vive dentro do JSONB).
          if (dataLanc < inicio || dataLanc > fim) return

          // Deduplicação: external_ref no mesmo formato do trigger da tesouraria
          // (`ccb-bol-{recebivel_id}-{parcela}`, parcela = índice 1-based).
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

          lancamentos.push({
            id: `ccb-${rec.id}-${parcela}`,
            date: dataLanc,
            tipo: 'receita',
            categoriaOriginal: 'Recebimento de Parcelas - CCB',
            categoria: 'Recebimento de Parcelas - CCB',
            descricao: `Recebível liquidado — Boleto ${bol.numero || bol.number || parcela} - Tomador: ${tomador}`,
            valor,
            origem: 'recebiveis_ccb',
          })
        })
      })

      // Garantia final estrita: nenhum lançamento fora do período [inicio, fim] permanece no DRE
      const lancamentosFiltrados = lancamentos.filter((l) => l.date >= inicio && l.date <= fim)

      // Agrupamento por categoria sobre os lançamentos estritamente do período
      const groupBy = (tipo: DreTipo) => {
        const map = new Map<string, DreCategoria>()
        lancamentosFiltrados
          .filter((l) => l.tipo === tipo)
          .forEach((l) => {
            const existing = map.get(l.categoria)
            if (existing) {
              existing.total += l.valor
              existing.lancamentos.push(l)
            } else {
              map.set(l.categoria, {
                categoria: l.categoria,
                tipo,
                total: l.valor,
                lancamentos: [l],
              })
            }
          })
        return Array.from(map.values()).sort((a, b) => b.total - a.total)
      }

      const receitasPorCategoria = groupBy('receita')
      const despesasPorCategoria = groupBy('despesa')

      const totalReceitas = receitasPorCategoria.reduce((s, c) => s + c.total, 0)
      const totalDespesas = despesasPorCategoria.reduce((s, c) => s + c.total, 0)
      setDados({
        lancamentos: lancamentosFiltrados.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
        receitasPorCategoria,
        despesasPorCategoria,
        totalReceitas,
        totalDespesas,
        resultado: totalReceitas - totalDespesas,
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados da DRE.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { dados, loading, error, refetch: fetchData }
}
