import { describe, it, expect } from 'vitest'
import {
  getLastDayOfMonth,
  addMonthsPreservingDay,
  generateRecurringInstallments,
} from './recurring-expenses'

describe('recurring-expenses utility', () => {
  it('getLastDayOfMonth returns correct last day for leap and standard years', () => {
    expect(getLastDayOfMonth(2026, 1)).toBe(31) // Janeiro 2026
    expect(getLastDayOfMonth(2026, 2)).toBe(28) // Fev não-bissexto
    expect(getLastDayOfMonth(2028, 2)).toBe(29) // Fev bissexto
    expect(getLastDayOfMonth(2026, 4)).toBe(30) // Abril
  })

  it('addMonthsPreservingDay increments months and preserves the same day', () => {
    expect(addMonthsPreservingDay('2026-03-15', 1)).toBe('2026-04-15')
    expect(addMonthsPreservingDay('2026-03-15', 11)).toBe('2027-02-15')
    expect(addMonthsPreservingDay('2026-03-15', 12)).toBe('2027-03-15')
  })

  it('addMonthsPreservingDay clamps to month end when target month has fewer days', () => {
    // 31 de janeiro + 1 mês -> 28 de fevereiro em 2027 (não bissexto)
    expect(addMonthsPreservingDay('2027-01-31', 1)).toBe('2027-02-28')
    // 31 de janeiro + 1 mês -> 29 de fevereiro em 2028 (bissexto)
    expect(addMonthsPreservingDay('2028-01-31', 1)).toBe('2028-02-29')
    // 31 de março + 1 mês -> 30 de abril
    expect(addMonthsPreservingDay('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('generateRecurringInstallments with per_installment mode produces equal amounts and correct descriptions', () => {
    const result = generateRecurringInstallments({
      baseDescription: 'Aluguel do Galpão',
      startDate: '2026-03-15',
      installmentsCount: 3,
      amountMode: 'per_installment',
      amount: 1500.5,
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      installmentNumber: 1,
      totalInstallments: 3,
      dueDate: '2026-03-15',
      amount: 1500.5,
      descriptionSuffix: 'Parcela 1/3',
      fullDescription: 'Aluguel do Galpão — Parcela 1/3',
    })
    expect(result[1].dueDate).toBe('2026-04-15')
    expect(result[1].amount).toBe(1500.5)
    expect(result[2].dueDate).toBe('2026-05-15')
    expect(result[2].amount).toBe(1500.5)
  })

  it('generateRecurringInstallments with total mode handles remainder cents gracefully', () => {
    // 1000 reais dividido em 3 parcelas: 333.33 + 333.33 + 333.34 = 1000.00
    const result = generateRecurringInstallments({
      baseDescription: 'Seguro Empresarial',
      startDate: '2026-01-31',
      installmentsCount: 3,
      amountMode: 'total',
      amount: 1000,
    })

    expect(result).toHaveLength(3)
    expect(result[0].amount).toBe(333.33)
    expect(result[1].amount).toBe(333.33)
    expect(result[2].amount).toBe(333.34)
    expect(result.reduce((s, p) => s + p.amount, 0)).toBe(1000)

    // Ajuste de datas de 31 de janeiro
    expect(result[0].dueDate).toBe('2026-01-31')
    expect(result[1].dueDate).toBe('2026-02-28')
    expect(result[2].dueDate).toBe('2026-03-31')
  })
})
