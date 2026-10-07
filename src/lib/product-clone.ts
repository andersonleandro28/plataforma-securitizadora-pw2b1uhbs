/**
 * Utilitário de clonagem de produtos de investimento (Debêntures / Renda Fixa)
 * Permite instanciar um novo rascunho de produto a partir de um existente,
 * preservando todas as parametrizações comerciais e técnicas sem vincular IDs ou dados do original.
 */

export interface ProductCloneSource {
  id?: string
  title?: string | null
  type?: string | null
  rate?: string | null
  interest_type?: string | null
  term?: string | null
  min_investment?: number | null
  risk?: string | null
  rating?: string | null
  status?: string | null
  series_id?: string | null
  currency?: string | null
  global_quotas?: number | null
  quota_value?: number | null
  is_active?: boolean | null
  is_highlighted?: boolean | null
  description?: string | null
  target_audience?: string | null
  manager?: string | null
  management_policy?: string | null
  redemption_rules?: string | null
  ir_rules?: string | null
  allow_early_redemption?: boolean | null
  early_redemption_penalty_pct?: number | null
  early_redemption_discount_pct?: number | null
  min_grace_period_months?: number | null
  min_quotas_per_investor?: number | null
  max_quotas_per_investor?: number | null
  yield_payment_regime?: string | null
  monthly_payment_day?: number | null
  yield_split_pct?: number | null
  application_cotization_months?: number | null
  redemption_cotization_months?: number | null
  financial_settlement?: string | null
  // Propriedades relacionais ou calculadas que NÃO devem ser clonadas
  debenture_series?: any
  created_at?: any
  updated_at?: any
  created_by?: any
  updated_by?: any
  sold_quotas?: any
  progress?: any
  [key: string]: any
}

/**
 * Gera o nome sugerido para a cópia do produto.
 * Ex: "Debênture Nexum 2026" -> "Debênture Nexum 2026 (Cópia)"
 */
export function buildClonedProductTitle(originalTitle?: string | null): string {
  const base = (originalTitle || '').trim()
  if (!base) return 'Novo Produto (Cópia)'
  return `${base} (Cópia)`
}

/**
 * Clona os dados de um produto existente para um novo payload de criação (INSERT).
 * Garante que:
 * 1. O id seja explicitamente indefinido (ou null), evitando UPDATE do original.
 * 2. Nenhum campo de auditoria (created_at, updated_at, created_by, updated_by) persista.
 * 3. Campos de cotas vendidas/progresso sejam zerados (sold_quotas: 0, progress: 0).
 * 4. O título receba o sufixo "(Cópia)".
 * 5. Campos essenciais e opcionais (como regime mensal e dia de liberação) sejam copiados fielmente.
 */
export function cloneProductData(source: ProductCloneSource): Record<string, any> {
  const cloned: Record<string, any> = {
    // Título ajustado com sufixo
    title: buildClonedProductTitle(source.title),

    // Parâmetros de rentabilidade e indexador
    type: source.type ?? 'Debênture',
    rate: source.rate ?? '',
    interest_type: source.interest_type ?? 'simples',
    term: source.term ?? '',
    min_investment: source.min_investment ?? 1000,
    risk: source.risk ?? 'Médio',
    rating: source.rating ?? '',
    status: source.status ?? 'Ativo',
    series_id: source.series_id ?? null,
    currency: source.currency ?? 'BRL',

    // Cotas e valores
    global_quotas: source.global_quotas ?? 1000,
    quota_value: source.quota_value ?? 1000,
    min_quotas_per_investor: source.min_quotas_per_investor ?? 1,
    max_quotas_per_investor: source.max_quotas_per_investor ?? 100,

    // Visibilidade e destaques (por padrão produto clonado pode começar ativo ou manter o estado)
    is_active: source.is_active ?? true,
    is_highlighted: false, // Não sobrecarrega destaque por padrão
    is_archived: false, // Produto novo nunca nasce arquivado

    // Textos descritivos e políticas
    description: source.description ?? '',
    target_audience: source.target_audience ?? '',
    manager: source.manager ?? '',
    management_policy: source.management_policy ?? '',
    redemption_rules: source.redemption_rules ?? '',
    ir_rules: source.ir_rules ?? '',

    // Regras de resgate antecipado e carência
    allow_early_redemption: Boolean(source.allow_early_redemption),
    early_redemption_penalty_pct: source.early_redemption_penalty_pct ?? 0,
    early_redemption_discount_pct: source.early_redemption_discount_pct ?? 0,
    min_grace_period_months: source.min_grace_period_months ?? 0,

    // Regime de rendimentos (acumulado vs mensal com dia)
    yield_payment_regime: source.yield_payment_regime ?? 'accumulated',
    monthly_payment_day: source.monthly_payment_day ?? 1,
    yield_split_pct: source.yield_split_pct ?? 50,

    // Campos de cotização adicionais se existirem
    application_cotization_months: source.application_cotization_months ?? null,
    redemption_cotization_months: source.redemption_cotization_months ?? null,
    financial_settlement: source.financial_settlement ?? '',

    // Zerados para novo produto
    sold_quotas: 0,
    progress: 0,
  }

  // Se o tipo for Forex Manual, não vincula série
  if (cloned.type === 'Rendimento Variável (Forex Manual)') {
    cloned.series_id = null
  }

  return cloned
}
