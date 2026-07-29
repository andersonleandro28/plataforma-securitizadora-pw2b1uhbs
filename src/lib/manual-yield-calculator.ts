import type { ManualYieldEntry } from '@/services/manual-yield'

export function calculateManualYieldAmount(
  totalValue: number,
  entries: ManualYieldEntry[],
  investmentStartDate: Date | null,
): number {
  if (!entries || entries.length === 0 || !totalValue) return 0

  let eligibleEntries = entries

  if (investmentStartDate) {
    eligibleEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.period + 'T12:00:00Z')
      return entryDate >= investmentStartDate
    })
  }

  const totalClientPct = eligibleEntries.reduce(
    (sum, entry) => sum + Number(entry.client_percentage),
    0,
  )

  return (totalValue * totalClientPct) / 100
}

export function generateManualYieldChartData(
  totalValue: number,
  entries: ManualYieldEntry[],
  investmentStartDate: Date | null,
  referenceDate: Date = new Date(),
): { date: string; value: number }[] {
  if (!entries || entries.length === 0 || !totalValue) return []

  let eligibleEntries = entries

  if (investmentStartDate) {
    eligibleEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.period + 'T12:00:00Z')
      return entryDate >= investmentStartDate
    })
  }

  if (eligibleEntries.length === 0) return []

  const sorted = [...eligibleEntries].sort(
    (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime(),
  )

  const MONTH_LABELS = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]

  const dataPoints: { date: string; value: number }[] = []
  let cumulativePct = 0

  for (const entry of sorted) {
    const entryDate = new Date(entry.period + 'T12:00:00Z')
    if (entryDate > referenceDate) continue

    cumulativePct += Number(entry.client_percentage)
    const monthLabel = `${MONTH_LABELS[entryDate.getUTCMonth()]} ${entryDate.getUTCFullYear()}`
    dataPoints.push({
      date: monthLabel,
      value: (totalValue * cumulativePct) / 100,
    })
  }

  return dataPoints
}
