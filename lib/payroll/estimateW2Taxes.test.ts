import { describe, expect, it } from 'vitest'
import {
  estimateW2EmployeeDeductions,
  estimatedW2DeductionTotal,
} from '@/lib/payroll/estimateW2Taxes'

describe('estimateW2Taxes', () => {
  it('applies FICA + estimated FIT/NYIT to gross', () => {
    const rows = estimateW2EmployeeDeductions(1000)
    expect(rows.map((r) => r.code)).toEqual([
      'FED_INCOME',
      'SS',
      'MEDICARE',
      'NY_STATE',
    ])
    expect(rows.find((r) => r.code === 'SS')?.amount).toBe(62)
    expect(rows.find((r) => r.code === 'MEDICARE')?.amount).toBe(14.5)
    expect(rows.find((r) => r.code === 'FED_INCOME')?.amount).toBe(12)
    expect(rows.find((r) => r.code === 'NY_STATE')?.amount).toBe(23)
    expect(estimatedW2DeductionTotal(1000)).toBe(111.5)
    expect(rows.every((r) => r.label.includes('(est.)'))).toBe(true)
  })

  it('returns empty for zero gross', () => {
    expect(estimateW2EmployeeDeductions(0)).toEqual([])
  })
})
