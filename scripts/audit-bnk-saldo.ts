/**
 * PROVA EM DADOS DO NOVO CÁLCULO DE SALDO (tela Admin → Contas Bancárias).
 *
 * Rodar com: npx vitest run scripts/audit-bnk-saldo.ts
 *
 * Reproduz, FONTE POR FONTE, a regra implementada em
 * src/lib/accounting-ledger.ts + src/pages/admin/BankAccounts.tsx:
 *
 *   saldo da conta = Σ (entradas − saídas) das transações NÃO-espelho
 *   (is_bank_mirror: parcela ccb-bol/op-bol, liquidação op-liq, resgate
 *   redemption/tax-redemption criados por trigger) atribuídas à conta.
 *
 *   REGRA NOVA (v0.0.1187): crédito manual de tesouraria SEM conta bancária
 *   (treasury_transactions com external_ref manual-credit-… e bank_account_id
 *   nulo) NÃO pertence a nenhuma conta real — deixa de cair na conta ativa.
 *
 * O teste NÃO altera nenhum registro: apenas SELECT.
 * Alvo: BNK Digital = R$ 10.650,77 (exibido antes: R$ 62.749,44).
 */
import { describe, it, expect } from 'vitest'
import { supabase } from '../src/lib/supabase/client'

const MIRROR_REF = /^(ccb-bol|op-bol|op-liq|redemption|tax-redemption)-/
const fmt = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

describe('Prova: saldo da BNK Digital fecha em R$ 10.650,77', () => {
  it('reproduz o novo cálculo fonte por fonte', async () => {
    // Contas cadastradas (e qual é a ativa)
    const { data: banks, error: banksErr } = await supabase
      .from('company_bank_accounts')
      .select('id, bank_name, is_active')
    expect(banksErr).toBeNull()
    expect(banks && banks.length > 0).toBe(true)

    const contas = (banks || []) as { id: string; bank_name: string; is_active: boolean }[]
    const bnk = contas.find((c) => (c.bank_name || '').toLowerCase().includes('bnk'))
    expect(bnk, 'conta BNK Digital não encontrada em company_bank_accounts').toBeTruthy()
    const bnkId = bnk!.id
    const active = contas.find((c) => c.is_active) || contas[0]

    // Fonte 1: transações de tesouraria confirmadas
    const { data: tt, error: ttErr } = await supabase
      .from('treasury_transactions')
      .select(
        'id, type, category, amount, external_ref, expense_id, bank_account_id, status, deleted_at',
      )
    expect(ttErr).toBeNull()
    const ttValidos = ((tt || []) as any[]).filter(
      (t) => !t.deleted_at && (!t.status || t.status === 'Confirmado'),
    )

    // Fonte 2: movimentações de caixa
    const { data: movs, error: movsErr } = await supabase
      .from('movimentacoes_caixa')
      .select('id, tipo, valor, referencia_id, referencia_tipo, bank_account_id, deleted_at')
    expect(movsErr).toBeNull()
    const movsValidos = ((movs || []) as any[]).filter((m) => !m.deleted_at)

    // Fonte 3: despesas pagas
    const { data: exps, error: expsErr } = await supabase
      .from('expenses')
      .select('id, amount, status, bank_account_id, deleted_at')
    expect(expsErr).toBeNull()
    const expsPagas = ((exps || []) as any[]).filter((e) => e.status === 'paid' && !e.deleted_at)

    // ——— Cálculo NÃO-espelho (novo saldo) e espelho (diagnóstico), por conta ———
    const novoSaldo: Record<string, number> = {}
    const espelho: Record<string, number> = {}
    const add = (map: Record<string, number>, accId: string, d: number) => {
      map[accId] = (map[accId] ?? 0) + d
    }
    // Lançamento com conta explícita pertence a essa conta; sem conta, NÃO
    // pertence a nenhuma conta real (não cai mais na conta ativa).
    const contaDe = (rawId: string | null | undefined) => rawId || null

    console.log('--- TESOURARIA (tt-) fonte por fonte ---')
    const porGrupo: Record<string, { qtde: number; liquido: number; espelho: number }> = {}
    ttValidos.forEach((t) => {
      const ref = t.external_ref ? String(t.external_ref) : null
      const isMirror = Boolean(ref && MIRROR_REF.test(ref))
      // Lançamento de despesa espelhado em expenses (despesas pagas somam à
      // parte no passo "exp-"): não entra duas vezes no saldo.
      const isDespesaEspelhada = !ref && Boolean(t.expense_id)
      const d = (t.type === 'in' ? 1 : -1) * Number(t.amount || 0)
      const accId = contaDe(t.bank_account_id)
      if (!accId) return
      add(isMirror || isDespesaEspelhada ? espelho : novoSaldo, accId, d)
      const grupo = !ref
        ? isDespesaEspelhada
          ? 'sem ref (despesa espelhada)'
          : 'sem ref (manual)'
        : isMirror
          ? ref.split('-').slice(0, 2).join('-')
          : ref.split('-')[0]
      porGrupo[grupo] = porGrupo[grupo] || { qtde: 0, liquido: 0, espelho: 0 }
      porGrupo[grupo].qtde++
      if (isMirror || isDespesaEspelhada) porGrupo[grupo].espelho += d
      else porGrupo[grupo].liquido += d
    })
    Object.entries(porGrupo).forEach(([g, s]) => {
      console.log(`  ${g}: ${s.qtde} lanç. | real ${fmt(s.liquido)} | espelho ${fmt(s.espelho)}`)
    })

    console.log('--- MOVIMENTAÇÕES DE CAIXA (mov-) — só espelho se referencia evento ---')
    movsValidos.forEach((m) => {
      const refTipo = (m.referencia_tipo || '').toLowerCase()
      const isMirror =
        Boolean(m.referencia_id) &&
        [
          'parcela_operacao',
          'recebivel',
          'liquidacao_recebivel',
          'parcela',
          'boleto',
          'resgate_investimento',
          'credit_operation',
        ].includes(refTipo)
      // sinal via tipo (receita/entrada = +)
      const tipo = (m.tipo || '').toLowerCase()
      const isIn = tipo.includes('receit') || tipo.includes('entrada') || tipo.includes('credito')
      const d = (isIn ? 1 : -1) * Number(m.valor || 0)
      const accId = contaDe(m.bank_account_id)
      if (!accId) return
      add(isMirror ? espelho : novoSaldo, accId, d)
    })

    console.log('--- DESPESAS PAGAS (exp-) — sempre fluxo real ---')
    expsPagas.forEach((e) => {
      const accId = contaDe(e.bank_account_id)
      if (!accId) return
      add(novoSaldo, accId, -Number(e.amount || 0))
    })

    console.log('--- RESULTADO POR CONTA (regra nova) ---')
    contas.forEach((c) => {
      console.log(
        `  ${c.bank_name}${c.is_active ? ' (ativa)' : ''}: novo saldo ${fmt(novoSaldo[c.id] ?? 0)} | espelho suprimido ${fmt(espelho[c.id] ?? 0)}`,
      )
    })

    const saldoBnk = novoSaldo[bnkId] ?? 0
    console.log(`ALVO: BNK Digital = ${fmt(saldoBnk)} (esperado R$ 10.650,77)`)

    // Aceitação: fecha em R$ 10.650,77 (tolerância de 1 centavo por arredondamento)
    expect(Math.abs(saldoBnk - 10650.77)).toBeLessThan(0.02)
  }, 120_000)
})
