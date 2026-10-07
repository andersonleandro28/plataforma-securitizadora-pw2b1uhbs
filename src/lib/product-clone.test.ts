import { describe, it, expect } from 'vitest'
import { buildClonedProductTitle, cloneProductData } from './product-clone'

describe('product-clone utility', () => {
  it('buildClonedProductTitle appends (Cópia) to title', () => {
    expect(buildClonedProductTitle('Debênture Série Ouro')).toBe('Debênture Série Ouro (Cópia)')
    expect(buildClonedProductTitle('')).toBe('Novo Produto (Cópia)')
    expect(buildClonedProductTitle(null)).toBe('Novo Produto (Cópia)')
    expect(buildClonedProductTitle(undefined)).toBe('Novo Produto (Cópia)')
  })

  it('cloneProductData preserves financial rules and clears product id & quotas sold', () => {
    const original = {
      id: 'prod-original-uuid-1234',
      title: 'Debênture Conservadora 2026',
      type: 'Debênture',
      rate: '14.5% a.a.',
      interest_type: 'composto',
      term: '24 meses',
      min_investment: 5000,
      risk: 'Baixo',
      rating: 'AAA',
      status: 'Ativo',
      series_id: 'series-uuid-999',
      currency: 'BRL',
      global_quotas: 2000,
      quota_value: 1000,
      min_quotas_per_investor: 5,
      max_quotas_per_investor: 200,
      is_active: true,
      is_highlighted: true,
      is_archived: false,
      description: 'Debênture sênior com garantia real.',
      target_audience: 'Investidores qualificados',
      manager: 'Nexum Gestão',
      management_policy: 'Crédito privado sênior',
      redemption_rules: 'Resgate permitido após carência com aviso de 30 dias',
      ir_rules: 'Tabela regressiva 22,5% a 15%',
      allow_early_redemption: true,
      early_redemption_penalty_pct: 2.5,
      early_redemption_discount_pct: 10,
      min_grace_period_months: 6,
      yield_payment_regime: 'monthly',
      monthly_payment_day: 15,
      yield_split_pct: 50,
      sold_quotas: 750,
      progress: 37.5,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-02-01T00:00:00.000Z',
      created_by: 'user-admin-1',
      updated_by: 'user-admin-2',
      debenture_series: { series_number: '1ª Série' },
    }

    const cloned = cloneProductData(original)

    // 1. O id deve ser estritamente undefined para forçar INSERT
    expect(cloned.id).toBeUndefined()

    // 2. Título deve refletir a cópia
    expect(cloned.title).toBe('Debênture Conservadora 2026 (Cópia)')

    // 3. Regras financeiras e comerciais devem ser preservadas
    expect(cloned.rate).toBe('14.5% a.a.')
    expect(cloned.interest_type).toBe('composto')
    expect(cloned.term).toBe('24 meses')
    expect(cloned.min_investment).toBe(5000)
    expect(cloned.risk).toBe('Baixo')
    expect(cloned.rating).toBe('AAA')
    expect(cloned.series_id).toBe('series-uuid-999')
    expect(cloned.currency).toBe('BRL')
    expect(cloned.global_quotas).toBe(2000)
    expect(cloned.quota_value).toBe(1000)
    expect(cloned.min_quotas_per_investor).toBe(5)
    expect(cloned.max_quotas_per_investor).toBe(200)

    // 4. Regime mensal e dia de liberação preservados
    expect(cloned.yield_payment_regime).toBe('monthly')
    expect(cloned.monthly_payment_day).toBe(15)

    // 5. Regras de resgate antecipado preservadas
    expect(cloned.allow_early_redemption).toBe(true)
    expect(cloned.early_redemption_penalty_pct).toBe(2.5)
    expect(cloned.early_redemption_discount_pct).toBe(10)
    expect(cloned.min_grace_period_months).toBe(6)

    // 6. Textos institucionais e regulatórios preservados
    expect(cloned.description).toBe('Debênture sênior com garantia real.')
    expect(cloned.target_audience).toBe('Investidores qualificados')
    expect(cloned.manager).toBe('Nexum Gestão')
    expect(cloned.management_policy).toBe('Crédito privado sênior')
    expect(cloned.redemption_rules).toBe('Resgate permitido após carência com aviso de 30 dias')
    expect(cloned.ir_rules).toBe('Tabela regressiva 22,5% a 15%')

    // 7. Auditoria e dados relacionais do original removidos/zerados
    expect(cloned.created_at).toBeUndefined()
    expect(cloned.updated_at).toBeUndefined()
    expect(cloned.created_by).toBeUndefined()
    expect(cloned.updated_by).toBeUndefined()
    expect(cloned.debenture_series).toBeUndefined()
    expect(cloned.sold_quotas).toBe(0)
    expect(cloned.progress).toBe(0)
    expect(cloned.is_archived).toBe(false)
  })

  it('nullifies series_id for Forex Manual product type', () => {
    const original = {
      title: 'Forex Multi-Estratégia',
      type: 'Rendimento Variável (Forex Manual)',
      rate: 'Variável',
      series_id: 'series-debenture-should-be-removed',
      yield_split_pct: 60,
    }

    const cloned = cloneProductData(original)
    expect(cloned.type).toBe('Rendimento Variável (Forex Manual)')
    expect(cloned.series_id).toBeNull()
    expect(cloned.yield_split_pct).toBe(60)
  })

  it('handles partial or empty product source gracefully with defaults', () => {
    const cloned = cloneProductData({})
    expect(cloned.id).toBeUndefined()
    expect(cloned.title).toBe('Novo Produto (Cópia)')
    expect(cloned.type).toBe('Debênture')
    expect(cloned.interest_type).toBe('simples')
    expect(cloned.yield_payment_regime).toBe('accumulated')
    expect(cloned.monthly_payment_day).toBe(1)
    expect(cloned.global_quotas).toBe(1000)
    expect(cloned.quota_value).toBe(1000)
    expect(cloned.sold_quotas).toBe(0)
    expect(cloned.progress).toBe(0)
    expect(cloned.is_archived).toBe(false)
  })
})
