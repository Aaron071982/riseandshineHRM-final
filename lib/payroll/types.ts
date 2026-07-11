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

/** Employee-safe stub fields — never include employer taxes / total cost */
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
  netPay: true,
  payrollRun: {
    select: {
      id: true,
      label: true,
      payDate: true,
      periodStart: true,
      periodEnd: true,
      status: true,
    },
  },
} as const
