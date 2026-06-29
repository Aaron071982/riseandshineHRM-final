import type { BreakdownEntry } from '@/components/billing/PayrollStatusBreakdown'
import type { BillingMatchStatus } from '@prisma/client'

type ApiBreakdownEntry = {
  id: string
  providerNameRaw: string
  matchStatus: BillingMatchStatus
  isExcluded: boolean
  hourlyRate: number | null
  adjustment: number
  grossPay: number
  finalPay: number
  totalHours: number
  rbtProfile: { firstName: string; lastName: string; email?: string | null } | null
  payrollOnly: { fullName: string; email?: string | null } | null
  sessions: {
    sessionStatus: string | null
    actualMinutes: number
    dos: string | Date
    clientName: string
  }[]
}

export function mapApiEntriesToBreakdown(entries: ApiBreakdownEntry[]): BreakdownEntry[] {
  return entries.map((e) => ({
    ...e,
    sessions: e.sessions.map((s) => ({
      sessionStatus: s.sessionStatus,
      actualMinutes: s.actualMinutes,
      dos: typeof s.dos === 'string' ? s.dos : new Date(s.dos).toISOString(),
      clientName: s.clientName,
    })),
  }))
}
