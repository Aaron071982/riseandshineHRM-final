import 'server-only'

import { prisma } from '@/lib/prisma'
import { requireMcpAuthContext } from '@/lib/mcp/context'
import {
  MCP_SUPERADMIN_UNAUTHORIZED_MESSAGE,
  userIsMcpSuperAdmin,
} from '@/lib/mcp/superAdminAllowlist'
import { logSensitiveAccess } from '@/lib/mcp/sensitiveAccess'
import { maskSensitiveDeep, maskSensitiveIdentifiers } from '@/lib/mcp/maskSensitive'
import { jsonToolResult } from '@/lib/mcp/format'
import type { ToolResult } from '@/lib/mcp/types'
import type { SensitiveAccessCategory } from '@prisma/client'

function parseDate(value: string | undefined, label: string): Date {
  if (!value?.trim()) throw new Error(`${label} is required (YYYY-MM-DD)`)
  const d = new Date(value.trim())
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label}: ${value}`)
  return d
}

function parseDateRange(args: {
  date_range?: string
  from?: string
  to?: string
}): { from: Date; to: Date; label: string } {
  if (args.from && args.to) {
    return {
      from: parseDate(args.from, 'from'),
      to: parseDate(args.to, 'to'),
      label: `${args.from} → ${args.to}`,
    }
  }
  const raw = args.date_range?.trim()
  if (!raw) throw new Error('Provide date_range (e.g. "2026-03-13 to 2026-03-26") or from+to')
  const m = raw.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/)
  if (!m) throw new Error(`Could not parse date_range: ${raw}. Use YYYY-MM-DD to YYYY-MM-DD.`)
  return {
    from: parseDate(m[1], 'from'),
    to: parseDate(m[2], 'to'),
    label: `${m[1]} → ${m[2]}`,
  }
}

async function requireSuperAdminActor(): Promise<{ userId: string }> {
  const auth = requireMcpAuthContext()
  if (!auth.userId) {
    await logSensitiveAccess({
      category: 'OTHER',
      action: 'BLOCKED_UNAUTHORIZED',
      toolName: 'superadmin_gate',
      reason: 'missing_token_user',
    })
    throw new Error(MCP_SUPERADMIN_UNAUTHORIZED_MESSAGE)
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, isMcpSuperAdmin: true },
  })
  if (!user || !userIsMcpSuperAdmin(user)) {
    await logSensitiveAccess({
      userId: auth.userId,
      category: 'OTHER',
      action: 'BLOCKED_UNAUTHORIZED',
      toolName: 'superadmin_gate',
      reason: 'not_on_superadmin_allowlist',
    })
    throw new Error(MCP_SUPERADMIN_UNAUTHORIZED_MESSAGE)
  }
  return { userId: user.id }
}

async function resolveStaff(staff: string): Promise<{
  id: string
  name: string
  email: string | null
  hourlyPayRate: number | null
}> {
  const q = staff.trim()
  if (!q) throw new Error('staff is required')

  const byId = await prisma.rBTProfile.findFirst({
    where: { id: q },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      hourlyPayRate: true,
    },
  })
  if (byId) {
    return {
      id: byId.id,
      name: `${byId.firstName} ${byId.lastName}`.trim(),
      email: byId.email,
      hourlyPayRate: byId.hourlyPayRate,
    }
  }

  const parts = q.split(/\s+/).filter(Boolean)
  const profiles = await prisma.rBTProfile.findMany({
    where: {
      OR: [
        { email: { equals: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { payrollName: { contains: q, mode: 'insensitive' } },
        { artemisProviderName: { contains: q, mode: 'insensitive' } },
        ...(parts.length >= 2
          ? [
              {
                AND: [
                  { firstName: { contains: parts[0], mode: 'insensitive' as const } },
                  { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      hourlyPayRate: true,
    },
  })

  if (profiles.length === 0) throw new Error(`Staff not found: ${staff}`)
  if (profiles.length > 1) {
    const names = profiles.map((p) => `${p.firstName} ${p.lastName} (${p.id})`).join('; ')
    throw new Error(`Multiple staff matched "${staff}". Be more specific: ${names}`)
  }
  const p = profiles[0]!
  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    hourlyPayRate: p.hourlyPayRate,
  }
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

async function auditRead(
  actorUserId: string,
  category: SensitiveAccessCategory,
  toolName: string,
  subject: { id: string; name: string } | null,
  range: { from: Date; to: Date },
  summary: Record<string, unknown>
) {
  await logSensitiveAccess({
    userId: actorUserId,
    category,
    action: 'READ',
    toolName,
    subjectType: subject ? 'rbt' : 'payroll_period',
    subjectId: subject?.id ?? null,
    subjectLabel: subject?.name ?? null,
    dateRangeFrom: range.from,
    dateRangeTo: range.to,
    resultSummary: summary,
  })
}

/**
 * Actual pay from published PayrollRun entries (vendor register / YTD).
 * match_by=worked (default) filters by periodStart/periodEnd overlapping the window;
 * match_by=pay_date filters by PayrollRun.payDate.
 */
export async function getStaffPay(args: {
  staff: string
  date_range?: string
  from?: string
  to?: string
  match_by?: string
}): Promise<ToolResult> {
  const actor = await requireSuperAdminActor()
  const range = parseDateRange(args)
  const matchBy = args.match_by === 'pay_date' ? 'pay_date' : 'worked'
  const staff = await resolveStaff(args.staff)

  const runWhere =
    matchBy === 'pay_date'
      ? {
          status: 'PUBLISHED' as const,
          payDate: { gte: range.from, lte: range.to },
        }
      : {
          status: 'PUBLISHED' as const,
          periodStart: { lte: range.to },
          periodEnd: { gte: range.from },
        }

  const entries = await prisma.payrollRunEntry.findMany({
    where: {
      rbtProfileId: staff.id,
      payrollRun: runWhere,
    },
    orderBy: { payrollRun: { payDate: 'asc' } },
    select: {
      id: true,
      payrollName: true,
      totalHours: true,
      grossPay: true,
      netPay: true,
      adjustedGross: true,
      empTaxTotal: true,
      empDeductionTotal: true,
      payrollRun: {
        select: {
          id: true,
          label: true,
          payDate: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  })

  // Estimated payable from billing cycles overlapping the window (Artemis)
  const billingEntries = await prisma.billingEntry.findMany({
    where: {
      rbtProfileId: staff.id,
      isExcluded: false,
      billingCycle: {
        periodStart: { lte: range.to },
        periodEnd: { gte: range.from },
      },
    },
    select: {
      totalHours: true,
      hourlyRate: true,
      grossPay: true,
      finalPay: true,
      billingCycle: {
        select: { label: true, periodStart: true, periodEnd: true, status: true },
      },
    },
  })

  const periods = entries.map((e) => {
    const rate =
      e.totalHours > 0 ? e.grossPay / e.totalHours : staff.hourlyPayRate
    return {
      payDate: e.payrollRun.payDate.toISOString().slice(0, 10),
      periodStart: e.payrollRun.periodStart.toISOString().slice(0, 10),
      periodEnd: e.payrollRun.periodEnd.toISOString().slice(0, 10),
      label: e.payrollRun.label,
      hours: e.totalHours,
      hourlyRate: rate,
      grossPay: e.grossPay,
      netPay: e.netPay,
      taxes: e.empTaxTotal,
      deductions: e.empDeductionTotal,
    }
  })

  const totalGross = periods.reduce((s, p) => s + p.grossPay, 0)
  const totalNet = periods.reduce((s, p) => s + p.netPay, 0)
  const totalHours = periods.reduce((s, p) => s + p.hours, 0)

  const estimated = billingEntries.map((b) => ({
    cycle: b.billingCycle.label,
    periodStart: b.billingCycle.periodStart.toISOString().slice(0, 10),
    periodEnd: b.billingCycle.periodEnd.toISOString().slice(0, 10),
    cycleStatus: b.billingCycle.status,
    hours: b.totalHours,
    hourlyRate: b.hourlyRate,
    estimatedGross: b.finalPay || b.grossPay,
  }))

  const payload = maskSensitiveDeep({
    staff: { id: staff.id, name: staff.name, email: staff.email },
    matchBy,
    dateRange: range.label,
    profileHourlyRate: staff.hourlyPayRate,
    actualPaid: {
      totalGross,
      totalNet,
      totalHours,
      payDates: periods.map((p) => p.payDate),
      periods,
    },
    estimatedFromArtemis: estimated,
  })

  await auditRead(actor.userId, 'PAY', 'get_staff_pay', staff, range, {
    periodCount: periods.length,
    totalGross,
    totalNet,
    matchBy,
  })

  const lines = [
    `# Pay — ${staff.name}`,
    `Range: ${range.label} (match_by=${matchBy})`,
    `Profile rate: ${staff.hourlyPayRate != null ? money(staff.hourlyPayRate) : '—'}`,
    '',
    `## Actual paid (published payroll)`,
    `- Total gross: ${money(totalGross)}`,
    `- Total net: ${money(totalNet)}`,
    `- Total hours: ${totalHours.toFixed(2)}`,
    '',
    ...periods.map(
      (p) =>
        `- Pay date ${p.payDate} (${p.periodStart}–${p.periodEnd}): ${p.hours.toFixed(2)}h × ${money(p.hourlyRate ?? 0)} → gross ${money(p.grossPay)}, net ${money(p.netPay)}`
    ),
    periods.length === 0 ? '- (none)' : '',
    '',
    `## Estimated from Artemis billing cycles`,
    ...estimated.map(
      (e) =>
        `- ${e.cycle} (${e.periodStart}–${e.periodEnd}, ${e.cycleStatus}): ${e.hours.toFixed(2)}h @ ${e.hourlyRate != null ? money(e.hourlyRate) : '—'} → ${money(e.estimatedGross)}`
    ),
    estimated.length === 0 ? '- (none)' : '',
  ]

  return {
    text: maskSensitiveIdentifiers(lines.filter(Boolean).join('\n')),
    summary: {
      staffId: staff.id,
      periodCount: periods.length,
      totalGross,
      totalNet,
    },
  }
}

/** Days worked from Artemis billing sessions (no dollar figures). */
export async function getStaffWorkedSessions(args: {
  staff: string
  date_range?: string
  from?: string
  to?: string
}): Promise<ToolResult> {
  const actor = await requireSuperAdminActor()
  const range = parseDateRange(args)
  const staff = await resolveStaff(args.staff)

  const sessions = await prisma.billingSession.findMany({
    where: {
      dos: { gte: range.from, lte: range.to },
      billingEntry: {
        rbtProfileId: staff.id,
        isExcluded: false,
      },
    },
    orderBy: [{ dos: 'asc' }, { actualStart: 'asc' }],
    select: {
      id: true,
      clientName: true,
      dos: true,
      actualMinutes: true,
      rawActualMinutes: true,
      sessionStatus: true,
      procedureCode: true,
      location: true,
      billingEntry: {
        select: {
          billingCycle: { select: { label: true, status: true } },
        },
      },
    },
  })

  const rows = sessions.map((s) => {
    const minutes = s.actualMinutes || s.rawActualMinutes || 0
    return {
      date: s.dos.toISOString().slice(0, 10),
      hours: Math.round((minutes / 60) * 100) / 100,
      client: s.clientName,
      status: s.sessionStatus,
      procedureCode: s.procedureCode,
      location: s.location,
      cycle: s.billingEntry.billingCycle.label,
    }
  })

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0)
  const uniqueDays = new Set(rows.map((r) => r.date)).size

  await auditRead(actor.userId, 'WORKED_SESSIONS', 'get_staff_worked_sessions', staff, range, {
    sessionCount: rows.length,
    uniqueDays,
    totalHours,
  })

  return jsonToolResult(
    maskSensitiveIdentifiers(`Worked sessions — ${staff.name}`),
    maskSensitiveDeep({
      staff: { id: staff.id, name: staff.name },
      dateRange: range.label,
      uniqueDays,
      totalHours,
      sessionCount: rows.length,
      sessions: rows,
    }),
    { staffId: staff.id, sessionCount: rows.length, uniqueDays, totalHours }
  )
}

/** Period roll-up across staff from published payroll runs. */
export async function getPayrollSummary(args: {
  date_range?: string
  from?: string
  to?: string
  match_by?: string
}): Promise<ToolResult> {
  const actor = await requireSuperAdminActor()
  const range = parseDateRange(args)
  const matchBy = args.match_by === 'pay_date' ? 'pay_date' : 'worked'

  const runWhere =
    matchBy === 'pay_date'
      ? {
          status: 'PUBLISHED' as const,
          payDate: { gte: range.from, lte: range.to },
        }
      : {
          status: 'PUBLISHED' as const,
          periodStart: { lte: range.to },
          periodEnd: { gte: range.from },
        }

  const runs = await prisma.payrollRun.findMany({
    where: runWhere,
    orderBy: { payDate: 'asc' },
    select: {
      id: true,
      label: true,
      payDate: true,
      periodStart: true,
      periodEnd: true,
      employeeCount: true,
      totalGrossPay: true,
      totalNetPay: true,
      entries: {
        where: { matchStatus: { in: ['MATCHED', 'NEEDS_REVIEW'] } },
        select: {
          payrollName: true,
          totalHours: true,
          grossPay: true,
          netPay: true,
          rbtProfile: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  })

  const staffMap = new Map<
    string,
    { name: string; hours: number; gross: number; net: number; payDates: string[] }
  >()

  for (const run of runs) {
    const payDate = run.payDate.toISOString().slice(0, 10)
    for (const e of run.entries) {
      const key = e.rbtProfile?.id ?? `name:${e.payrollName}`
      const name = e.rbtProfile
        ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.trim()
        : e.payrollName
      const cur = staffMap.get(key) ?? {
        name,
        hours: 0,
        gross: 0,
        net: 0,
        payDates: [],
      }
      cur.hours += e.totalHours
      cur.gross += e.grossPay
      cur.net += e.netPay
      if (!cur.payDates.includes(payDate)) cur.payDates.push(payDate)
      staffMap.set(key, cur)
    }
  }

  const staff = [...staffMap.entries()].map(([id, v]) => ({
    staffId: id.startsWith('name:') ? null : id,
    name: v.name,
    hours: Math.round(v.hours * 100) / 100,
    grossPay: v.gross,
    netPay: v.net,
    payDates: v.payDates,
  }))
  staff.sort((a, b) => a.name.localeCompare(b.name))

  const payload = maskSensitiveDeep({
    matchBy,
    dateRange: range.label,
    runCount: runs.length,
    staffCount: staff.length,
    totalGross: runs.reduce((s, r) => s + r.totalGrossPay, 0),
    totalNet: runs.reduce((s, r) => s + r.totalNetPay, 0),
    runs: runs.map((r) => ({
      id: r.id,
      label: r.label,
      payDate: r.payDate.toISOString().slice(0, 10),
      periodStart: r.periodStart.toISOString().slice(0, 10),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
      employeeCount: r.employeeCount,
      totalGross: r.totalGrossPay,
      totalNet: r.totalNetPay,
    })),
    staff,
  })

  await auditRead(actor.userId, 'PAYROLL', 'get_payroll_summary', null, range, {
    runCount: runs.length,
    staffCount: staff.length,
    matchBy,
  })

  return jsonToolResult(
    maskSensitiveIdentifiers(`Payroll summary — ${range.label}`),
    payload,
    {
      runCount: runs.length,
      staffCount: staff.length,
      totalGross: payload.totalGross,
      totalNet: payload.totalNet,
    }
  )
}
