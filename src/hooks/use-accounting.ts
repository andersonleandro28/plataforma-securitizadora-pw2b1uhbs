import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  classifyMovimentacaoCaixaAccounting,
  isTaxProvisionTransaction,
} from '@/lib/financial-classification'

export type Transaction = {
  id: string
  date: string
  type: 'in' | 'out'
  category: string
  description: string
  value: number
  accumulated_balance: number
  bank_account_id?: string | null
  bank_account_info?: {
    bank_name: string
    branch?: string | null
    account_number: string
  } | null
}

/**
 * Normaliza uma data para o formato YYYY-MM-DD evitando o deslocamento de fuso
 * horário (especialmente em UTC-3, Brasil). Caso o valor já seja uma data no
 * formato ISO (YYYY-MM-DD), apenas extrai a parte da data. Para timestamps, é
 * construído um Date com horário de meio-dia no horário local e então
 * convertido para ISO, garantindo que o dia informado pelo usuário seja o
 * mesmo que aparecerá no Livro Caixa.
 */
function normalizeAccountingDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split('T')[0]

  const str = String(value)

  // Já está no formato "YYYY-MM-DD" — apenas devolve.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // Contém informação de horário (timestamp ISO). Constrói um Date e força o
  // meio-dia no horário local para evitar que o arredondamento de fuso empurre
  // a data para o dia anterior.
  const d = new Date(str)
  if (isNaN(d.getTime())) return str.split('T')[0]

  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  return local.toISOString().split('T')[0]
}

export function useAccounting() {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (inicio?: string, fim?: string) => {
    try {
      setLoading(true)
      setError(null)
      const transactions: Omit<Transaction, 'accumulated_balance'>[] = []

      const [
        { data: subs },
        { data: recs },
        { data: exps },
        { data: ops },
        { data: reds },
        { data: movs },
        { data: tt },
        { data: companyBanks },
        { data: mapMovs },
      ] = await Promise.all([
        supabase
          .from('debenture_subscriptions')
          .select(
            'id, investor_name, total_amount, unit_price, quantity, subscription_date, created_at, status, investments(quotas, redeemed_quotas, unit_price, transfer_value, transfer_date, status)',
          ),
        supabase
          .from('recebiveis_ccb')
          .select(
            'id, acquisition_value, created_at, boletos, ccb_id, profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
          ),
        supabase
          .from('expenses')
          .select(
            'id, amount, description, payment_date, due_date, status, bank_account_id, suppliers(company_name), supplier_id, category',
          ),
        supabase
          .from('credit_operations')
          .select(
            'id, requested_value, face_value, issue_date, created_at, updated_at, status, sacado, liquidation_date, liquidation_value, operation_calculations(net_value)',
          ),
        supabase
          .from('investment_redemptions')
          .select(
            'id, net_value, updated_at, created_at, status, profiles!investment_redemptions_user_id_fkey(full_name, pj_company_name)',
          ),
        // Movimentações de Caixa (liquidações, juros, etc.)
        // RLS já garante que admins veem tudo e usuários comuns só os próprios registros.
        supabase
          .from('movimentacoes_caixa')
          .select(
            'id, tipo, categoria, descricao, valor, user_id, created_at, referencia_id, referencia_tipo, referencia_numero, bank_account_id',
          ),
        // Transações do Tesourário — Recebimentos e Saídas Não Sincronizadas
        // O `treasury_transactions` contém recebimentos de parcelas de CCBs, parcelas de crédito, liquidações,
        // resgates e créditos manuais/receitas avulsas na conta.
        supabase
          .from('treasury_transactions')
          .select(
            'id, type, category, amount, description, date, external_ref, expense_id, bank_account_id',
          )
          .or('status.eq.Confirmado,status.is.null')
          .or(
            'category.in.("Recebimento de Parcelas - CCB","Recebimento de Parcelas - Operação","Liquidação de Recebível","Resgate de Investidor","Resgates e Rendimentos","Receita Avulsa","Crédito em Conta","Receitas Diversas","Aporte de Capital","Rendimento Financeiro","Reembolso"),external_ref.like.manual-credit-%',
          ),
        supabase
          .from('company_bank_accounts')
          .select('id, bank_name, branch, account_number, is_active'),
        // Mapeamentos para deduplicação entre movimentacoes_caixa e despesas oficiais
        supabase
          .from('mapeamento_movimentacoes')
          .select('movimentacao_caixa_id, origem_tabela, origem_id')
          .in('origem_tabela', ['fornecedores', 'despesas', 'investment_redemptions']),
      ])

      // Dicionário de despesas
      const expenseMap = new Map<
        string,
        { payment_date: string | null; due_date: string | null; status: string }
      >()
      ;(exps || []).forEach((e: any) => {
        expenseMap.set(e.id, {
          payment_date: e.payment_date,
          due_date: e.due_date,
          status: e.status,
        })
      })

      // Dicionário de resgates
      const redemptionMap = new Map<
        string,
        { updated_at: string; created_at: string; status: string }
      >()
      ;(reds || []).forEach((r: any) => {
        redemptionMap.set(r.id, {
          updated_at: r.updated_at,
          created_at: r.created_at,
          status: r.status,
        })
      })

      // Mapeamento de movimentacoes_caixa para despesas oficiais (expenses)
      const movIdToExpenseId = new Map<string, string>()
      ;(mapMovs || []).forEach((m: any) => {
        if (m.movimentacao_caixa_id && m.origem_id) {
          if (m.origem_tabela === 'fornecedores' || m.origem_tabela === 'despesas') {
            movIdToExpenseId.set(m.movimentacao_caixa_id, m.origem_id)
          }
        }
      })

      // Mapeamento de contas bancárias para lookup rápido e fallback de conta ativa
      const bankMap = new Map<
        string,
        { bank_name: string; branch: string | null; account_number: string }
      >()
      let activeBankId: string | null = null
      let activeBankInfo: {
        bank_name: string
        branch: string | null
        account_number: string
      } | null = null
      ;(companyBanks || []).forEach((b: any) => {
        const info = {
          bank_name: b.bank_name,
          branch: b.branch,
          account_number: b.account_number,
        }
        bankMap.set(b.id, info)
        if (b.is_active && !activeBankId) {
          activeBankId = b.id
          activeBankInfo = info
        }
      })
      if (!activeBankInfo && companyBanks && companyBanks.length > 0) {
        const first = companyBanks[0]
        activeBankId = first.id
        activeBankInfo = {
          bank_name: first.bank_name,
          branch: first.branch,
          account_number: first.account_number,
        }
      }

      const resolveBank = (id?: string | null) => {
        if (id && bankMap.has(id)) {
          return { id, info: bankMap.get(id)! }
        }
        return { id: activeBankId, info: activeBankInfo }
      }

      // 1. Subscrições
      ;(subs || []).forEach((sub: any) => {
        const st = (sub.status || '').toLowerCase()
        if (st === 'excluído' || st === 'excluido' || st === 'cancelado') return

        const inv = Array.isArray(sub.investments) ? sub.investments[0] : sub.investments
        const invStatus = (inv?.status || '').toLowerCase()
        if (invStatus === 'cancelado' || invStatus === 'rejeitado' || invStatus === 'rejected')
          return

        const subTotal = Number(sub.total_amount || 0)
        const transferVal = Number(inv?.transfer_value || 0)
        const unitP = Number(inv?.unit_price || sub.unit_price || 100)
        const totalQuotas = Number(inv?.quotas || 0) + Number(inv?.redeemed_quotas || 0)
        const calculatedByQuotas = totalQuotas * unitP

        let valorHistorico = 0
        if (subTotal > 0) {
          valorHistorico = subTotal
        } else if (transferVal > 0) {
          valorHistorico = transferVal
        } else if (calculatedByQuotas > 0) {
          valorHistorico = calculatedByQuotas
        }

        if (valorHistorico <= 0) return

        const dataCaptacao = sub.subscription_date || inv?.transfer_date || sub.created_at

        const bInfo = resolveBank(null)
        transactions.push({
          id: `sub-${sub.id}`,
          date: normalizeAccountingDate(dataCaptacao),
          type: 'in',
          category: 'Subscrição de Debênture',
          description: `Subscrição — ${sub.investor_name}`,
          value: valorHistorico,
          bank_account_id: bInfo.id,
          bank_account_info: bInfo.info,
        })
      })

      // 2. Aquisições de CCB (Desembolsos)
      ;(recs || []).forEach((rec) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
        const valAcq = Number(rec.acquisition_value || 0)
        const bInfo = resolveBank(null)
        transactions.push({
          id: `acq-${rec.id}`,
          date: normalizeAccountingDate(rec.created_at),
          type: 'out',
          category: 'Aquisição de CCB',
          description: `Aquisição de CCB — ${tomador} — R$ ${valAcq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          value: valAcq,
          bank_account_id: bInfo.id,
          bank_account_info: bInfo.info,
        })
      })

      // Coleta referências já presentes em movimentações de caixa para evitar duplicação com treasury_transactions
      const movsExternalRefs = new Set<string>()
      const redemptionsInMovs = new Set<string>()
      ;(movs || []).forEach((m: any) => {
        if (m.referencia_id) {
          movsExternalRefs.add(`op-liq-${m.referencia_id}`)
          movsExternalRefs.add(`redemption-${m.referencia_id}`)
          if (m.referencia_tipo === 'resgate_investimento') {
            redemptionsInMovs.add(String(m.referencia_id))
          }
          if (m.referencia_numero) {
            movsExternalRefs.add(`op-bol-${m.referencia_id}-${m.referencia_numero}`)
            movsExternalRefs.add(String(m.referencia_numero))
          }
        }
      })

      // 3. Transações do Tesourário (incluindo Recebimento de Parcelas - CCB com external_ref ccb-bol-...)
      // Segue o padrão do DRE: treasury_transactions é a fonte prioritária para recebimentos de CCB.
      // Coleta os external_ref processados para posterior deduplicação com os boletos pagos de recebiveis_ccb.
      const treasuryExternalRefs = new Set<string>()
      ;(tt || []).forEach((tx: any) => {
        // Exclui provisões de IRRF retido sobre resgate (não são saídas de caixa).
        // Evita distorcer o Livro Caixa / Contabilidade e mantém conciliação com DFC e DRE.
        if (isTaxProvisionTransaction(tx)) return

        const ref = tx.external_ref ? String(tx.external_ref) : null
        if (ref && movsExternalRefs.has(ref)) return
        if (ref && treasuryExternalRefs.has(ref)) return
        if (ref) treasuryExternalRefs.add(ref)

        const txType: 'in' | 'out' = tx.type === 'out' ? 'out' : 'in'
        const bInfo = resolveBank(tx.bank_account_id)
        transactions.push({
          id: `tt-${tx.id}`,
          type: txType,
          category:
            tx.category ||
            (txType === 'out' ? 'Resgate de Investidor' : 'Recebimento de Parcelas - CCB'),
          description: tx.description,
          value: Number(tx.amount || 0),
          date: normalizeAccountingDate(tx.date),
          bank_account_id: bInfo.id,
          bank_account_info: bInfo.info,
        })
      })

      // 4. Recebíveis CCB (boletos pagos via JSONB de recebiveis_ccb)
      // Fonte secundária de segurança: boletos que possam não ter sido sincronizados para treasury_transactions.
      // DEDUP PADRÃO DRE: se o external_ref já existe em treasuryExternalRefs, o boleto NÃO é adicionado,
      // garantindo que cada recebimento de parcela de CCB apareça EXATAMENTE UMA VEZ.
      ;(recs || []).forEach((rec: any) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const tomador = prof?.pj_company_name || prof?.full_name || 'Desconhecido'

        const boletos = Array.isArray(rec.boletos) ? rec.boletos : []
        boletos.forEach((bol: any, i: number) => {
          const bolStatus = (bol.status || '').toLowerCase()
          if (bolStatus !== 'pago' && bolStatus !== 'liquidado') return

          const pDate =
            bol.data_pagamento ||
            bol.payment_date ||
            bol.data_liquidacao ||
            bol.data_vencimento ||
            bol.due_date
          if (!pDate) return

          const parcela = i + 1
          const extRef = bol.external_ref
            ? String(bol.external_ref)
            : `ccb-bol-${rec.id}-${parcela}`

          if (treasuryExternalRefs.has(extRef)) return
          treasuryExternalRefs.add(extRef)

          const val =
            Number(bol.valor || bol.unit_value || 0) +
            Number(bol.interest_applied || 0) +
            Number(bol.penalty_applied || 0)
          if (!val) return

          const bInfo = resolveBank(bol.bank_account_id)
          transactions.push({
            id: `ccb-bol-${rec.id}-${parcela}`,
            date: normalizeAccountingDate(pDate),
            type: 'in',
            category: 'Recebimento de Parcelas - CCB',
            description: `Recebimento Parcela ${bol.numero || bol.number || parcela} - CCB nº ${rec.ccb_id ? String(rec.ccb_id).substring(0, 8) : String(rec.id).substring(0, 8)} - Tomador: ${tomador}`,
            value: val,
            bank_account_id: bInfo.id,
            bank_account_info: bInfo.info,
          })
        })
      })

      // 4. Despesas
      ;(exps || []).forEach((exp) => {
        if (exp.status === 'paid') {
          const sup = Array.isArray(exp.suppliers) ? exp.suppliers[0] : exp.suppliers
          const fornecedor = sup?.company_name
          const bInfo = resolveBank(exp.bank_account_id)
          transactions.push({
            id: `exp-${exp.id}`,
            date: normalizeAccountingDate(exp.payment_date || exp.due_date),
            type: 'out',
            category: fornecedor ? 'Pagamento Fornecedor' : 'Despesa',
            description: fornecedor ? `Fornecedor — ${fornecedor}` : `Despesa — ${exp.description}`,
            value: Number(exp.amount || 0),
            bank_account_id: bInfo.id,
            bank_account_info: bInfo.info,
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
          const bInfo = resolveBank(null)
          transactions.push({
            id: `op-out-${op.id}`,
            date: normalizeAccountingDate(op.issue_date),
            type: 'out',
            category: 'Desembolso de Crédito',
            description: `Operação de Crédito — Sacado: ${op.sacado}`,
            value: Number(val || 0),
            bank_account_id: bInfo.id,
            bank_account_info: bInfo.info,
          })
        }
      })

      // 6. Resgates (tabela investment_redemptions direta)
      // Tabela oficial para resgates de investidores.
      ;(reds || []).forEach((red) => {
        if (red.status === 'paid') {
          if (treasuryExternalRefs.has(`redemption-${red.id}`)) {
            return
          }
          const prof = Array.isArray(red.profiles) ? red.profiles[0] : red.profiles
          const investor = prof?.pj_company_name || prof?.full_name || 'Desconhecido'
          const bInfo = resolveBank(null)
          transactions.push({
            id: `red-${red.id}`,
            date: normalizeAccountingDate(red.updated_at || red.created_at),
            type: 'out',
            category: 'Resgate de Investimento',
            description: `Resgate — Investidor: ${investor}`,
            value: Number(red.net_value || 0),
            bank_account_id: bInfo.id,
            bank_account_info: bInfo.info,
          })
        }
      })

      // 7. Movimentações de Caixa
      // Tradução das categorias para rótulos legíveis no Livro Caixa.
      const categoriaLabel: Record<string, string> = {
        liquidação_recebível: 'Liquidação de Recebível',
        liquidacao_recebivel: 'Liquidação de Recebível',
        juros_entrada: 'Juros Recebidos',
        fornecedor: 'Pagamento Fornecedor',
        despesa: 'Despesa Operacional',
      }
      // DEDUP DE DESPESAS/FORNECEDORES:
      // Se um pagamento de fornecedor já existe no Livro Caixa e também foi lançado
      // via tabela `expenses` (status 'paid'), prioriza a tabela `expenses` (que contém
      // os dados detalhados e fornecedor vinculado) e evita duplicar no Livro Caixa.

      ;(movs || []).forEach((mov) => {
        const catLower = (mov.categoria || '').toLowerCase()
        const refTipo = (mov.referencia_tipo || '').toLowerCase()

        // Deduplicação: se vinculada a uma despesa existente em expenses, ignora a duplicata do caixa
        // pois a despesa oficial em expenses é quem fornece a data real de competência e detalhes.
        const linkedExpenseId =
          movIdToExpenseId.get(mov.id) || (refTipo === 'despesa' ? mov.referencia_id : null)
        if (linkedExpenseId && expenseMap.has(linkedExpenseId)) {
          return
        }
        if (catLower === 'fornecedor' || catLower === 'despesa') {
          if (linkedExpenseId || (mov.referencia_id && expenseMap.has(mov.referencia_id))) {
            return
          }
        }

        // Se for resgate, ignora no caixa pois a tabela oficial investment_redemptions (passo 6)
        // já processa com a data real
        if (refTipo === 'resgate_investimento' && mov.referencia_id) {
          const redId = String(mov.referencia_id)
          const redMatch = redemptionMap.get(redId)
          if (redMatch && redMatch.status === 'paid') {
            return
          }
        }

        // Determina data real
        let effectiveDate = normalizeAccountingDate(mov.created_at)
        if (
          refTipo === 'resgate_investimento' &&
          mov.referencia_id &&
          redemptionMap.has(mov.referencia_id)
        ) {
          const red = redemptionMap.get(mov.referencia_id)!
          effectiveDate = normalizeAccountingDate(red.updated_at || red.created_at)
        }

        // Classificação à prova de falha: somente 'entrada' normalizado vira 'in';
        // qualquer outro valor (saída, saida, unknown) vira 'out'
        const type: 'in' | 'out' = classifyMovimentacaoCaixaAccounting(mov.tipo)
        const category =
          categoriaLabel[(mov.categoria || '').toLowerCase()] ||
          mov.categoria ||
          'Movimentação de Caixa'
        const bInfo = resolveBank(mov.bank_account_id)
        transactions.push({
          id: `mov-${mov.id}`,
          date: effectiveDate,
          type,
          category,
          description: mov.descricao || category,
          value: Number(mov.valor || 0),
          bank_account_id: bInfo.id,
          bank_account_info: bInfo.info,
        })
      })

      // Sort and accumulate
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let bal = 0
      const finalData: Transaction[] = transactions.map((t) => {
        bal += t.type === 'in' ? t.value : -t.value
        return { ...t, accumulated_balance: bal }
      })

      // O saldo acumulado é calculado sobre TODOS os registros (saldo global
      // corrido), e só então o período [inicio, fim] é aplicado em memória —
      // preservando o saldo acumulado correto por linha e o saldo global no
      // primeiro registro. A filtragem em memória (em vez de `.gte/.lte` no
      // Supabase) é necessária porque várias fontes (boletos em JSONB de
      // `recebiveis_ccb`, parcelas em JSONB de `operacoes_antecipacao`) não
      // podem ser filtradas pela data de pagamento no nível da API.
      let result = finalData
      if (inicio || fim) {
        result = finalData.filter((t) => {
          if (inicio && t.date < inicio) return false
          if (fim && t.date > fim) return false
          return true
        })
      }

      setData(result.reverse())
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao consolidar dados da contabilidade.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, refetch: fetchData }
}
