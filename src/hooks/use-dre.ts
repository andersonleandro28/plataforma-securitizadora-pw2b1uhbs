import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

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
}

function labelCategoria(categoria: string | null | undefined): string {
  if (!categoria) return 'Outros'
  return CATEGORIA_LABEL[categoria.toLowerCase()] || categoria
}

/**
 * Hook que consolida os dados da DRE (Demonstração do Resultado do Exercício).
 * Busca receitas e despesas do Livro Caixa (movimentacoes_caixa), aportes de
 * investidores (debenture_subscriptions), despesas operacionais (expenses) e
 * transações de tesouraria (treasury_transactions — ex.: recebimento de
 * parcelas de CCB), com sua própria lógica de agrupamento e totais.
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

      const [movsRes, subsRes, expsRes, tresRes] = await Promise.all([
        supabase
          .from('movimentacoes_caixa')
          .select('id, tipo, categoria, descricao, valor, created_at')
          .gte('created_at', inicioTs)
          .lte('created_at', fimTs),
        supabase
          .from('debenture_subscriptions')
          .select('id, investor_name, total_amount, subscription_date, created_at, status')
          .gte('subscription_date', inicio)
          .lte('subscription_date', fim),
        supabase
          .from('expenses')
          .select(
            'id, amount, description, payment_date, due_date, status, category, suppliers(company_name)',
          )
          .or(
            `and(payment_date.gte.${inicio},payment_date.lte.${fim}),and(payment_date.is.null,and(due_date.gte.${inicio},due_date.lte.${fim}))`,
          ),
        supabase
          .from('treasury_transactions')
          .select(
            'id, type, category, amount, description, date, external_ref, expense_id, reference_id',
          )
          .eq('status', 'Confirmado')
          .gte('date', inicio)
          .lte('date', fim),
      ])

      const lancamentos: DreLancamento[] = []

      // 1. Movimentações de Caixa (Livro Caixa)
      ;(movsRes.data || []).forEach((mov) => {
        const tipoLower = (mov.tipo || '').toLowerCase()
        const tipo: DreTipo = tipoLower === 'saida' ? 'despesa' : 'receita'
        const catOriginal = mov.categoria || 'Outros'
        lancamentos.push({
          id: `mov-${mov.id}`,
          date: normalizeDate(mov.created_at),
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

      // 4. Transações de Tesouraria (treasury_transactions).
      // Entradas (type='in') entram como receita (ex.: recebimento de parcelas
      // de CCB). Saídas (type='out') entram como despesa, mas são deduplicadas
      // contra o expenses quando vinculadas via expense_id, para evitar dupla
      // contagem.
      ;(tresRes.data || []).forEach((t) => {
        const tipo: DreTipo = t.type === 'out' ? 'despesa' : 'receita'
        // Deduplicação: se a saída já está refletida em expenses, ignora.
        if (tipo === 'despesa' && t.expense_id && expenseIdsInDre.has(t.expense_id)) return

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

      // Agrupamento por categoria
      const groupBy = (tipo: DreTipo) => {
        const map = new Map<string, DreCategoria>()
        lancamentos
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
        lancamentos: lancamentos.sort(
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
