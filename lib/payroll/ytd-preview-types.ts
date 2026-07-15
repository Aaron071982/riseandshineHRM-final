/** Client-safe preview shapes for the YTD import wizard (no Prisma imports). */

export type YtdParsePreview = {
  snapshots: {
    fileName: string
    periodStart: string
    periodEnd: string
    employeeCount: number
    ytdGross: number
    ok: boolean
    error?: string
    warnings: string[]
  }[]
  runs: {
    label: string
    payDate: string
    periodStart: string
    periodEnd: string
    sourceSnapshot: string
    employeeCount: number
    hours: number
    values: number
    gross: number
    net: number
    employerTax: number
    checksumOk: boolean
    warnings: string[]
    entries: {
      rawName: string
      totalHours: number
      totalGross: number
      netPay: number
      isContractor: boolean
      totalEmployeeTax: number
      totalEmployerTax: number
    }[]
  }[]
  nameMatches: {
    payrollName: string
    matchStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED'
    matchConfidence: number
    rbtProfileId: string | null
    suggestedRbtProfileId: string | null
    suggestedName: string | null
  }[]
  candidates: { id: string; name: string }[]
  overlaps: string[]
  blockingError: string | null
}
