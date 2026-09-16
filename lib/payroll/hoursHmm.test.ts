import { describe, expect, it } from 'vitest'
import {
  amountForHours,
  clockToMinutes,
  hoursBetween,
  recomputeStatementTotals,
  round2,
} from '@/lib/payroll/hoursHmm'

describe('payroll hoursHmm', () => {
  it('treats .30 as 30 minutes (not decimal hours)', () => {
    expect(clockToMinutes('4.30')).toBe(4 * 60 + 30)
    expect(clockToMinutes('4.3')).toBe(4 * 60 + 30)
    expect(hoursBetween('4.30', '6.30')).toBe(2)
    expect(hoursBetween('9.00', '10.30')).toBe(1.5)
    expect(hoursBetween('13.15', '15.45')).toBe(2.5)
  })

  it('rejects end ≤ start (no overnight / midnight-free spans)', () => {
    expect(hoursBetween('6.30', '4.30')).toBe(0)
    expect(hoursBetween('4.30', '4.30')).toBe(0)
    expect(hoursBetween('23.00', '1.00')).toBe(0)
  })

  it('computes amount = round2(hours * rate)', () => {
    expect(amountForHours(2, 105)).toBe(210)
    expect(amountForHours(1.5, 105)).toBe(157.5)
    expect(amountForHours(hoursBetween('4.30', '6.00'), 105)).toBe(157.5)
  })

  it('recomputes totals from line items as source of truth', () => {
    const totals = recomputeStatementTotals([
      { hours: 2, amount: 210 },
      { hours: 1.5, amount: 157.5 },
    ])
    expect(totals.totalHours).toBe(3.5)
    expect(totals.grossPay).toBe(367.5)
    expect(totals.netPay).toBe(367.5)
    expect(totals.deductions).toBe(0)
    expect(totals.reconciled).toBe(true)
  })

  it('sets reconciled=false when gross override breaks Σ amount', () => {
    const totals = recomputeStatementTotals(
      [
        { hours: 15.5, amount: 1627.5 },
        { hours: 3, amount: 315 },
      ],
      { grossOverride: 1627.5 }
    )
    expect(totals.lineAmountSum).toBe(1942.5)
    expect(totals.grossPay).toBe(1627.5)
    expect(totals.reconciled).toBe(false)
    expect(totals.netPay).toBe(1627.5)
  })

  it('round2 is stable for money', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(1.005 * 105)).toBe(amountForHours(1.005, 105))
  })
})
