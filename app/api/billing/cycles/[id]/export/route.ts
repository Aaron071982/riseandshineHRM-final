import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPayrollWorkbook, payrollExportFilename } from '@/lib/billing/excelExport'
import { ARTEMIS_STATUS } from '@/lib/billing/sessionStatus'
import type { BillingMatchStatus } from '@prisma/client'

function entryDisplayName(entry: {
  providerNameRaw: string
  rbtProfile: { firstName: string; lastName: string } | null
  payrollOnly: { fullName: string } | null
}): string {
  if (entry.rbtProfile) {
    return `${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}`.trim()
  }
  if (entry.payrollOnly) return entry.payrollOnly.fullName
  return entry.providerNameRaw
}

function matchesExportFilters(
  entry: {
    providerNameRaw: string
    matchStatus: BillingMatchStatus
    rbtProfile: { firstName: string; lastName: string } | null
    payrollOnly: { fullName: string } | null
    sessions: { sessionStatus: string | null; actualMinutes: number }[]
  },
  search: string | null,
  match: string | null,
  status: string | null,
  incompleteOnly: boolean
): boolean {
  if (search) {
    const q = search.toLowerCase()
    const name = entryDisplayName(entry).toLowerCase()
    if (!name.includes(q) && !entry.providerNameRaw.toLowerCase().includes(q)) return false
  }
  if (match === 'matched' && entry.matchStatus !== 'MATCHED') return false
  if (match === 'payroll_only' && entry.matchStatus !== 'PAYROLL_ONLY') return false
  if (match === 'unmatched' && entry.matchStatus !== 'UNMATCHED') return false
  if (match === 'needs_review' && entry.matchStatus !== 'NEEDS_REVIEW') return false
  if (status) {
    const hasStatus = entry.sessions.some(
      (s) => s.sessionStatus === status && s.actualMinutes > 0
    )
    if (!hasStatus) return false
  }
  if (incompleteOnly) {
    const hasIncomplete = entry.sessions.some(
      (s) => s.sessionStatus === ARTEMIS_STATUS.INCOMPLETE
    )
    if (!hasIncomplete) return false
  }
  return true
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const match = searchParams.get('match')
  const status = searchParams.get('status')
  const incompleteOnly = searchParams.get('incomplete') === '1'
  const hasFilters = !!(search || match || status || incompleteOnly)

  let entries = await prisma.billingEntry.findMany({
    where: {
      billingCycleId: params.id,
      isExcluded: false,
      matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] },
    },
    include: {
      rbtProfile: { select: { firstName: true, lastName: true } },
      payrollOnly: { select: { fullName: true } },
      sessions: { orderBy: { dos: 'asc' } },
    },
    orderBy: { providerNameRaw: 'asc' },
  })

  if (hasFilters) {
    entries = entries.filter((e) =>
      matchesExportFilters(e, search, match, status, incompleteOnly)
    )
  }

  const buffer = await buildPayrollWorkbook(
    {
      label: cycle.label,
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      payableStatuses: cycle.payableStatuses,
      filtered: hasFilters,
    },
    entries
  )
  const filename = payrollExportFilename(cycle.periodStart, cycle.periodEnd)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
