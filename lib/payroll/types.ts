export type ParsedPayrollEmployeeRow = {
  payrollName: string
  payDate: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  timePeriodRaw: string | null
  totalHours: number
  grossPay: number
  adjustedGross: number
  empTaxTotal: number
  empTaxFIT: number
  empTaxSS: number
  empTaxMed: number
  empTaxNYIT: number
  netPay: number
  employerTaxTotal: number
  totalPayrollCost: number
}

export type PayrollParseResult = {
  rows: ParsedPayrollEmployeeRow[]
  totalsRow: ParsedPayrollEmployeeRow | null
  payDate: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  label: string
  sourceMeta: { sheetName: string; dataRowCount: number }
}

export type PayrollMatchCandidate = {
  id: string
  firstName: string
  lastName: string
  payrollName: string | null
}

export type PayrollMatchResult = {
  matchStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED'
  matchConfidence: number
  rbtProfileId: string | null
  suggestedRbtProfileId: string | null
}

/**
 * Employee-safe stub fields.
 * NEVER include: employerTaxTotal, totalPayrollCost, earningsLines,
 * employerTaxLines, employerDeductionLines, empTaxLines (admin detail only).
 */
export const EMPLOYEE_STUB_SELECT = {
  id: true,
  payrollRunId: true,
  rbtProfileId: true,
  payrollName: true,
  totalHours: true,
  grossPay: true,
  adjustedGross: true,
  empTaxTotal: true,
  empTaxFIT: true,
  empTaxSS: true,
  empTaxMed: true,
  empTaxNYIT: true,
  empDeductionTotal: true,
  netPay: true,
  payrollRun: {
    select: {
      id: true,
      label: true,
      payDate: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      sourceFormat: true,
      isDerived: true,
    },
  },
} as const

/** Zero / noise threshold for hiding non-pay delta stubs from employees */
export const EMPLOYEE_PAY_EPS = 0.02

export function stubHasEmployeePay(stub: {
  grossPay: number
  netPay: number
  totalHours: number
}): boolean {
  return (
    stub.grossPay > EMPLOYEE_PAY_EPS ||
    stub.netPay > EMPLOYEE_PAY_EPS ||
    stub.totalHours > EMPLOYEE_PAY_EPS
  )
}
