import { prisma } from '@/lib/prisma'
import { getCycleDisplayStats } from '@/lib/billing/cycleStats'
import { formatCycleLabel } from '@/lib/billing/format'
import { round2 } from '@/lib/payroll/hoursHmm'
import {
  estimatePlutusBilled,
  estimatePlutusFromHours,
} from '@/lib/payroll/plutusEstimate'
import type { PayStatementStatus, PayeeType } from '@prisma/client'

export type PayPeriodOption = {
  id: string
  label: string
  startDate: string
  endDate: string
  payDate: string
}

export type UnifiedPayeeRow = {
  statementId: string
  payeeType: PayeeType
  payeeName: string
  entityName: string | null
  ratePerHour: number | null
  totalHours: number
  grossPay: number
  netPay: number
  deductions: number
  status: PayStatementStatus
  reconciled: boolean
  contractorId: string | null
  staffId: string | null
  userId: string | null
}

export type UnifiedSummary = {
  grossPayroll: number
  rbtPayroll: number
  bcbaPayroll: number
  billedPlutus: number
  estMargin: number
  billedSource: 'sessions' | 'hours-fallback' | 'none'
}

export type BillingCycleRow = {
  id: string
  label: string
  status: string
  periodStart: string
  periodEnd: string
  totalHours: number
  totalGrossPay: number
  rbtCount: number
}

export type UnifiedDashboardData = {
  periods: PayPeriodOption[]
  selectedPeriodId: string | null
  summary: UnifiedSummary
  statements: UnifiedPayeeRow[]
  contractors: {
    id: string
    userId: string
    legalName: string
    entityName: string | null
    ratePerHour: number | null
  }[]
  /** Portal BCBA users available for the hours sheet picker. */
  bcbaCandidates: {
    userId: string
    name: string
    email: string | null
    contractorId: string | null
    legalName: string | null
    entityName: string | null
    ratePerHour: number | null
  }[]
  billing: {
    cycles: BillingCycleRow[]
    missingRatesCount: number
    totalCycles: number
    payoutTrend: { label: string; payout: number }[]
    topBtHours: { name: string; hours: number }[]
    latestCycle: BillingCycleRow | null
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function loadUnifiedDashboard(
  selectedPeriodId?: string | null
): Promise<UnifiedDashboardData> {
  // First visit after unified payroll: copy Artemis cycles into PayPeriods.
  try {
    const { ensurePayPeriodsFromBillingCycles } = await import(
      '@/lib/payroll/migrateFromBillingCycles'
    )
    await ensurePayPeriodsFromBillingCycles()
  } catch (err) {
    console.warn('[payroll] billing-cycle backfill skipped', err)
  }

  const periodsRaw = await prisma.payPeriod.findMany({
    orderBy: { startDate: 'desc' },
    take: 40,
  })
  const periods: PayPeriodOption[] = periodsRaw.map((p) => ({
    id: p.id,
    label: p.label,
    startDate: isoDate(p.startDate),
    endDate: isoDate(p.endDate),
    payDate: isoDate(p.payDate),
  }))

  const selected =
    periods.find((p) => p.id === selectedPeriodId) ?? periods[0] ?? null

  const [
    statementsRaw,
    contractorsRaw,
    bcbaUsers,
    bcbaProfilesWithUser,
    cycles,
    missingRatesCount,
    totalCycles,
    chartCycles,
  ] = await Promise.all([
    selected
      ? prisma.payStatement.findMany({
          where: { payPeriodId: selected.id },
          include: {
            contractor: {
              include: {
                activeRate: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
            rbtProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hourlyPayRate: true,
              },
            },
          },
          orderBy: [{ payeeType: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.contractorProfile.findMany({
      include: {
        activeRate: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { legalName: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'BCBA', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bCBAProfile.findMany({
      where: { userId: { not: null } },
      select: {
        fullName: true,
        email: true,
        userId: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
    }),
    prisma.billingCycle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        entries: {
          where: { isExcluded: false },
          select: {
            isExcluded: true,
            totalHours: true,
            grossPay: true,
            matchStatus: true,
            providerNameRaw: true,
            rbtProfile: { select: { firstName: true, lastName: true } },
            payrollOnly: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.rBTProfile.count({
      where: {
        status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] },
        hourlyPayRate: null,
      },
    }),
    prisma.billingCycle.count(),
    prisma.billingCycle.findMany({
      where: { status: { in: ['FINALIZED', 'PAID'] } },
      orderBy: { periodEnd: 'desc' },
      take: 6,
      select: { label: true, totalGrossPay: true, periodEnd: true },
    }),
  ])

  const contractorByUserId = new Map(
    contractorsRaw.map((c) => [
      c.userId,
      {
        id: c.id,
        legalName: c.legalName,
        entityName: c.entityName,
        ratePerHour: c.activeRate ? Number(c.activeRate.ratePerHour) : null,
      },
    ])
  )

  const bcbaCandidateMap = new Map<
    string,
    UnifiedDashboardData['bcbaCandidates'][number]
  >()

  for (const u of bcbaUsers) {
    const c = contractorByUserId.get(u.id)
    bcbaCandidateMap.set(u.id, {
      userId: u.id,
      name: u.name?.trim() || u.email || 'BCBA',
      email: u.email,
      contractorId: c?.id ?? null,
      legalName: c?.legalName ?? u.name ?? null,
      entityName: c?.entityName ?? null,
      ratePerHour: c?.ratePerHour ?? null,
    })
  }

  for (const p of bcbaProfilesWithUser) {
    if (!p.userId || !p.user || p.user.isActive === false) continue
    const existing = bcbaCandidateMap.get(p.userId)
    const c = contractorByUserId.get(p.userId)
    const name =
      p.fullName?.trim() ||
      p.user.name?.trim() ||
      p.email ||
      p.user.email ||
      'BCBA'
    if (existing) {
      if (!existing.legalName && (c?.legalName || p.fullName)) {
        existing.legalName = c?.legalName ?? p.fullName
      }
      if (!existing.name || existing.name === 'BCBA') existing.name = name
      continue
    }
    bcbaCandidateMap.set(p.userId, {
      userId: p.userId,
      name,
      email: p.user.email ?? p.email,
      contractorId: c?.id ?? null,
      legalName: c?.legalName ?? p.fullName,
      entityName: c?.entityName ?? null,
      ratePerHour: c?.ratePerHour ?? null,
    })
  }

  // Include existing contractors even if role is not BCBA (legacy payees).
  for (const c of contractorsRaw) {
    if (bcbaCandidateMap.has(c.userId)) continue
    bcbaCandidateMap.set(c.userId, {
      userId: c.userId,
      name: c.legalName,
      email: c.user.email,
      contractorId: c.id,
      legalName: c.legalName,
      entityName: c.entityName,
      ratePerHour: c.activeRate ? Number(c.activeRate.ratePerHour) : null,
    })
  }

  const bcbaCandidates = [...bcbaCandidateMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const statements: UnifiedPayeeRow[] = statementsRaw.map((s) => {
    if (s.payeeType === 'BCBA' && s.contractor) {
      return {
        statementId: s.id,
        payeeType: 'BCBA',
        payeeName: s.contractor.legalName,
        entityName: s.contractor.entityName,
        ratePerHour: s.contractor.activeRate
          ? Number(s.contractor.activeRate.ratePerHour)
          : null,
        totalHours: Number(s.totalHours),
        grossPay: Number(s.grossPay),
        netPay: Number(s.netPay),
        deductions: Number(s.deductions),
        status: s.status,
        reconciled: s.reconciled,
        contractorId: s.contractorId,
        staffId: null,
        userId: s.contractor.userId,
      }
    }
    const rbt = s.rbtProfile
    return {
      statementId: s.id,
      payeeType: 'RBT',
      payeeName: rbt ? `${rbt.firstName} ${rbt.lastName}` : 'Unknown RBT',
      entityName: null,
      ratePerHour: rbt?.hourlyPayRate ?? null,
      totalHours: Number(s.totalHours),
      grossPay: Number(s.grossPay),
      netPay: Number(s.netPay),
      deductions: Number(s.deductions),
      status: s.status,
      reconciled: s.reconciled,
      contractorId: null,
      staffId: s.staffId,
      userId: null,
    }
  })

  const rbtPayroll = round2(
    statements.filter((s) => s.payeeType === 'RBT').reduce((a, s) => a + s.grossPay, 0)
  )
  const bcbaPayroll = round2(
    statements.filter((s) => s.payeeType === 'BCBA').reduce((a, s) => a + s.grossPay, 0)
  )
  const grossPayroll = round2(rbtPayroll + bcbaPayroll)

  let billedPlutus = 0
  let billedSource: UnifiedSummary['billedSource'] = 'none'
  if (selected) {
    const start = new Date(selected.startDate)
    const end = new Date(selected.endDate)
    const sessionRows = await prisma.billingSession.findMany({
      where: {
        dos: { gte: start, lte: end },
        billingEntry: { isExcluded: false },
      },
      select: { procedureCode: true, actualMinutes: true },
    })
    if (sessionRows.length > 0) {
      billedPlutus = estimatePlutusBilled(sessionRows)
      billedSource = 'sessions'
    } else {
      const rbtHours = statements
        .filter((s) => s.payeeType === 'RBT')
        .reduce((a, s) => a + s.totalHours, 0)
      const bcbaHours = statements
        .filter((s) => s.payeeType === 'BCBA')
        .reduce((a, s) => a + s.totalHours, 0)
      if (rbtHours + bcbaHours > 0) {
        billedPlutus = estimatePlutusFromHours({ rbtHours, bcbaHours })
        billedSource = 'hours-fallback'
      }
    }
  }

  const summary: UnifiedSummary = {
    grossPayroll,
    rbtPayroll,
    bcbaPayroll,
    billedPlutus,
    estMargin: round2(billedPlutus - grossPayroll),
    billedSource,
  }

  const cycleRows: BillingCycleRow[] = cycles.map((c) => {
    const stats = getCycleDisplayStats(c, c.entries)
    return {
      id: c.id,
      label: c.label,
      status: c.status,
      periodStart: c.periodStart.toISOString(),
      periodEnd: c.periodEnd.toISOString(),
      totalHours: stats.totalHours,
      totalGrossPay: stats.totalGrossPay,
      rbtCount: stats.rbtCount,
    }
  })

  const latestCycle = cycleRows[0] ?? null
  const topBtHours =
    cycles[0]?.entries
      .filter((e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY')
      .map((e) => ({
        name:
          e.rbtProfile
            ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.split(' ')[0]
            : (e.payrollOnly?.fullName ?? e.providerNameRaw).split(' ')[0],
        hours: e.totalHours,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6) ?? []

  const payoutTrend = [...chartCycles]
    .reverse()
    .map((c) => ({
      label: c.label.length > 12 ? c.label.slice(0, 12) + '…' : c.label,
      payout: c.totalGrossPay,
    }))

  return {
    periods,
    selectedPeriodId: selected?.id ?? null,
    summary,
    statements,
    contractors: contractorsRaw.map((c) => ({
      id: c.id,
      userId: c.userId,
      legalName: c.legalName,
      entityName: c.entityName,
      ratePerHour: c.activeRate ? Number(c.activeRate.ratePerHour) : null,
    })),
    bcbaCandidates,
    billing: {
      cycles: cycleRows,
      missingRatesCount,
      totalCycles,
      payoutTrend,
      topBtHours,
      latestCycle,
    },
  }
}

/** Suggest a default biweekly PayPeriod from billing format helper. */
export function suggestPeriodLabel(start: Date, end: Date): string {
  return formatCycleLabel(start, end)
}
