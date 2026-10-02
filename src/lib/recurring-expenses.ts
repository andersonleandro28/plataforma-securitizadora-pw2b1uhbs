/**
 * Utilitários para geração de datas e parcelas de despesas recorrentes mensais.
 */

/**
 * Retorna o último dia de um determinado mês e ano.
 * Ex: mês 2 em 2027 -> 28; mês 2 em 2028 (bissexto) -> 29.
 * @param year ano completo (ex: 2026)
 * @param month mês 1-based (1 = Janeiro, 12 = Dezembro)
 */
export function getLastDayOfMonth(year: number, month: number): number {
  // new Date(year, month, 0) retorna o último dia do mês informado
  return new Date(year, month, 0).getDate()
}

/**
 * Calcula a data no mesmo dia (ou último dia do mês se o mês não contiver o dia original)
 * adicionando N meses à data base YYYY-MM-DD.
 *
 * Exemplo:
 * - base "2026-03-15", +1 mês -> "2026-04-15"
 * - base "2026-01-31", +1 mês -> "2026-02-28" (ou 29 em bissexto)
 * - base "2026-08-31", +1 mês -> "2026-09-30"
 */
export function addMonthsPreservingDay(baseIsoDate: string, monthsToAdd: number): string {
  const parts = baseIsoDate.split('-')
  if (parts.length !== 3) {
    return baseIsoDate
  }
  const baseYear = parseInt(parts[0], 10)
  const baseMonth = parseInt(parts[1], 10) // 1-12
  const targetDay = parseInt(parts[2], 10) // 1-31

  // Calcula novo ano e mês
  const totalMonths = baseYear * 12 + (baseMonth - 1) + monthsToAdd
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1

  const maxDaysInTargetMonth = getLastDayOfMonth(targetYear, targetMonth)
  const resolvedDay = Math.min(targetDay, maxDaysInTargetMonth)

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth)}-${pad(resolvedDay)}`
}

export interface RecurrenceInstallmentPreview {
  installmentNumber: number
  totalInstallments: number
  dueDate: string
  amount: number
  descriptionSuffix: string
  fullDescription: string
}

/**
 * Gera o cronograma de parcelas com ajuste de centavos se necessário na última parcela.
 */
export function generateRecurringInstallments(params: {
  baseDescription: string
  startDate: string
  installmentsCount: number
  amountMode: 'per_installment' | 'total'
  amount: number
}): RecurrenceInstallmentPreview[] {
  const { baseDescription, startDate, installmentsCount, amountMode, amount } = params
  const count = Math.max(1, Math.floor(installmentsCount))
  const cleanDescription = baseDescription.trim()

  let installmentValue: number
  let lastInstallmentAdjustment = 0

  if (amountMode === 'per_installment') {
    installmentValue = Math.round(amount * 100) / 100
  } else {
    // Total dividido igualmente
    const totalCents = Math.round(amount * 100)
    const baseCents = Math.floor(totalCents / count)
    const remainderCents = totalCents - baseCents * count
    installmentValue = baseCents / 100
    lastInstallmentAdjustment = remainderCents / 100
  }

  const items: RecurrenceInstallmentPreview[] = []

  for (let i = 1; i <= count; i++) {
    const dueDate = addMonthsPreservingDay(startDate, i - 1)
    const currentAmount =
      i === count && amountMode === 'total'
        ? Number((installmentValue + lastInstallmentAdjustment).toFixed(2))
        : Number(installmentValue.toFixed(2))

    const suffix = `Parcela ${i}/${count}`
    const fullDescription = cleanDescription ? `${cleanDescription} — ${suffix}` : suffix

    items.push({
      installmentNumber: i,
      totalInstallments: count,
      dueDate,
      amount: currentAmount,
      descriptionSuffix: suffix,
      fullDescription,
    })
  }

  return items
}
