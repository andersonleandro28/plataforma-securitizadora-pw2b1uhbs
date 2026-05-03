import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export type Transaction = {
  id: string
  date: string
  type: 'in' | 'out'
  category: string
  description: string
  value: number
  accumulated_balance: number
}

export function useAccounting() {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const transactions: Omit<Transaction, 'accumulated_balance'>[] = []

      const [
        { data: subs },
        { data: recs },
        { data: ants },
        { data: exps },
        { data: ops },
        { data: reds },
      ] = await Promise.all([
        supabase
          .from('debenture_subscriptions')
          .select('id, investor_name, total_amount, subscription_date, created_at, status'),
        supabase
          .from('recebiveis_ccb')
          .select(
            'id, acquisition_value, created_at, boletos, ccb_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
          ),
        supabase
          .from('operacoes_antecipacao')
          .select(
            'id, net_value, created_at, updated_at, installments, ccb_id, ccb_solicitacoes(profiles(full_name, pj_company_name))',
          ),
        supabase
          .from('expenses')
          .select(
            'id, amount, description, payment_date, due_date, status, suppliers(company_name)',
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
      ])

      // 1. Subscrições
      ;(subs || []).forEach((sub) => {
        if (sub.status !== 'Excluído' && sub.status !== 'Cancelado') {
          transactions.push({
            id: `sub-${sub.id}`,
            date: sub.subscription_date || sub.created_at,
            type: 'in',
            category: 'Subscrição de Debênture',
            description: `Subscrição — ${sub.investor_name}`,
            value: Number(sub.total_amount || 0),
          })
        }
      })

      // 2. Recebíveis CCB
      ;(recs || []).forEach((rec) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

        const valAcq = Number(rec.acquisition_value || 0)
        transactions.push({
          id: `acq-${rec.id}`,
          date: rec.created_at,
          type: 'out',
          category: 'Aquisição de CCB',
          description: `Aquisição de CCB — ${tomador} — R$ ${valAcq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          value: valAcq,
        })

        const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
        boletos.forEach((bol: any, i: number) => {
          const pDate = bol.data_pagamento || bol.payment_date || bol.data_liquidacao
          if (
            (bol.status === 'Pago' || bol.status === 'pago' || bol.status === 'liquidado') &&
            pDate
          ) {
            const val =
              Number(bol.valor || bol.unit_value || 0) +
              Number(bol.interest_applied || 0) +
              Number(bol.penalty_applied || 0)
            transactions.push({
              id: `bol-${rec.id}-${i}`,
              date: pDate,
              type: 'in',
              category: 'Liquidação de Recebível',
              description: `Recebível liquidado — Boleto ${bol.numero || bol.number || i + 1} - Tomador: ${tomador}`,
              value: val,
            })
          }
        })
      })

      // 3. Antecipações CCB
      ;(ants || []).forEach((ant: any) => {
        const ccb = Array.isArray(ant.ccb_solicitacoes)
          ? ant.ccb_solicitacoes[0]
          : ant.ccb_solicitacoes
        const prof = ccb?.profiles
          ? Array.isArray(ccb.profiles)
            ? ccb.profiles[0]
            : ccb.profiles
          : null
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

        const installments = Array.isArray(ant.installments) ? ant.installments : []
        installments.forEach((inst: any, i: number) => {
          const pDate = inst.data_pagamento || inst.payment_date
          if (
            (inst.status === 'paga' || inst.status === 'Pago' || inst.status === 'pago') &&
            pDate
          ) {
            transactions.push({
              id: `inst-${ant.id}-${i}`,
              date: pDate,
              type: 'in',
              category: 'Pagamento de Parcela CCB',
              description: `Parcela ${inst.numero || inst.number || i + 1} — ${tomador} — CCB ${ant.ccb_id ? ant.ccb_id.substring(0, 8) : ant.id.substring(0, 8)}`,
              value: Number(inst.valor || inst.value || 0),
            })
          }
        })
      })

      // 4. Despesas
      ;(exps || []).forEach((exp) => {
        if (exp.status === 'paid') {
          const sup = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
          const fornecedor = sup?.company_name
          transactions.push({
            id: `exp-${exp.id}`,
            date: exp.payment_date || exp.due_date || new Date().toISOString(),
            type: 'out',
            category: fornecedor ? 'Pagamento Fornecedor' : 'Despesa',
            description: fornecedor ? `Fornecedor — ${fornecedor}` : `Despesa — ${exp.description}`,
            value: Number(exp.amount || 0),
          })
        }
      })

      // 5. Operações de Crédito
      ;(ops || []).forEach((op) => {
        if (['pago', 'liquidado'].includes(op.status || '')) {
          const calc = Array.isArray(op.operation_calculations)
            ? op.operation_calculations[0]
            : op.operation_calculations
          const val = calc?.net_value || op.requested_value
          transactions.push({
            id: `op-out-${op.id}`,
            date: op.issue_date || op.created_at,
            type: 'out',
            category: 'Desembolso de Crédito',
            description: `Operação de Crédito — Sacado: ${op.sacado}`,
            value: Number(val || 0),
          })
        }

        if (op.status === 'liquidado') {
          transactions.push({
            id: `op-in-${op.id}`,
            date: op.liquidation_date || op.updated_at || op.created_at,
            type: 'in',
            category: 'Liquidação de Recebível',
            description: `Recebível liquidado — Operação de Crédito — Sacado: ${op.sacado}`,
            value: Number(op.liquidation_value || op.face_value || 0),
          })
        }
      })

      // 6. Resgates
      ;(reds || []).forEach((red) => {
        if (red.status === 'paid') {
          const prof = Array.isArray(red.profiles) ? red.profiles[0] : red.profiles
          const investor = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
          transactions.push({
            id: `red-${red.id}`,
            date: red.updated_at || new Date().toISOString(),
            type: 'out',
            category: 'Resgate de Investimento',
            description: `Resgate — Investidor: ${investor}`,
            value: Number(red.net_value || 0),
          })
        }
      })

      // Sort and accumulate
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let bal = 0
      const finalData: Transaction[] = transactions.map((t) => {
        bal += t.type === 'in' ? t.value : -t.value
        return { ...t, accumulated_balance: bal }
      })

      setData(finalData.reverse())
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados da contabilidade.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, refetch: fetchData }
}
