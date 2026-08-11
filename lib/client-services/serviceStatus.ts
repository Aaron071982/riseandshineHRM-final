import { hoursBetween } from '@/lib/rbt-schedule/utils'
import { prisma } from '@/lib/prisma'
import { normalizeName } from '@/lib/rbt-schedule/from-roster'
import {
  getClientSchedulePeriod,
  schedulePeriodWhere,
  type ClientSchedulePeriod,
} from '@/lib/client-services/schedulePeriod'
import type {
  ClientBreakReason,
  ClientBreakStatus,
  ServiceClientStatus,
} from '@prisma/client'

export const DEFAULT_HOURS_GAP_THRESHOLD = 0

export type ServiceBoardBucket =
  | 'RECEIVING_SERVICES'
  | 'NEEDS_ADDITIONAL_HOURS'
  | 'NEEDS_RBT'
  | 'CLIENT_ON_BREAK'
  | 'RBT_ON_BREAK'
  | 'NEW_INTAKE'
  | 'ON_HOLD_DISCHARGED'
  | 'SCHEDULE_UNLINKED'

export type BreakTimerInfo = {
  id: string
  kind: 'client' | 'rbt'
  btName?: string
  reason: ClientBreakReason
  startDate: string
  expectedReturnDate: string
  status: ClientBreakStatus
  hasCoverage?: boolean
  coverageNotes?: string | null
  daysUntilReturn: number
  overdue: boolean
  daysOverdue: number
}

export type DerivedClientMetrics = {
  scheduledHoursPerWeek: number
  authHours: number | null
  hoursGap: number | null
  needsAdditionalHours: boolean
  needsRbt: boolean
  /** ACTIVE + linked + zero period assignments + not on client break */
  notBeingServed: boolean
  /** Has ≥1 assignment row linked to this client (any period) or in active period */
  scheduleLinked: boolean
  /** Linked but zero sessions in the active period */
  receivingServices: boolean
  scheduleBtNames: string[]
  careTeamBtNames: string[]
  /** Schedule BTs not present on care team */
  careTeamScheduleMismatch: string[]
  boardBucket: ServiceBoardBucket
  activeClientBreak: BreakTimerInfo | null
  activeRbtBreaks: BreakTimerInfo[]
  period: { start: string; end: string; label: string }
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function daysUntil(date: Date | string, from = startOfDay()): number {
  const target = startOfDay(typeof date === 'string' ? new Date(date) : date)
  return Math.round((target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function breakTimerFromRow(row: {
  id: string
  reason: ClientBreakReason
  startDate: Date
  expectedReturnDate: Date
  status: ClientBreakStatus
  btName?: string
  hasCoverage?: boolean
  coverageNotes?: string | null
  kind: 'client' | 'rbt'
}): BreakTimerInfo {
  const days = daysUntil(row.expectedReturnDate)
  return {
    id: row.id,
    kind: row.kind,
    btName: row.btName,
    reason: row.reason,
    startDate: row.startDate.toISOString().slice(0, 10),
    expectedReturnDate: row.expectedReturnDate.toISOString().slice(0, 10),
    status: row.status,
    hasCoverage: row.hasCoverage,
    coverageNotes: row.coverageNotes,
    daysUntilReturn: days,
    overdue: days < 0,
    daysOverdue: days < 0 ? Math.abs(days) : 0,
  }
}

export async function getHoursGapThreshold(): Promise<number> {
  try {
    const row = await prisma.companySetting.findUnique({
      where: { key: 'client_services_hours_gap_threshold' },
    })
    if (row?.value == null) return DEFAULT_HOURS_GAP_THRESHOLD
    const n = typeof row.value === 'number' ? row.value : Number(row.value)
    return Number.isFinite(n) ? n : DEFAULT_HOURS_GAP_THRESHOLD
  } catch {
    return DEFAULT_HOURS_GAP_THRESHOLD
  }
}

export async function setHoursGapThreshold(threshold: number): Promise<void> {
  await prisma.companySetting.upsert({
    where: { key: 'client_services_hours_gap_threshold' },
    create: { key: 'client_services_hours_gap_threshold', value: threshold },
    update: { value: threshold },
  })
}

type Slot = {
  startTime: string
  endTime: string
  isActive: boolean
  rbtProfile?: {
    firstName: string | null
    lastName: string | null
    artemisProviderName?: string | null
  } | null
}

export function rbtDisplayName(p: {
  firstName?: string | null
  lastName?: string | null
  artemisProviderName?: string | null
} | null | undefined): string {
  if (!p) return ''
  const composed = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
  return composed || p.artemisProviderName?.trim() || ''
}

export function sumScheduledWeeklyHours(slots: Slot[]): number {
  return slots
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0)
}

function careTeamContains(careNames: string[], scheduleBt: string): boolean {
  const target = normalizeName(scheduleBt)
  if (!target) return false
  return careNames.some((c) => {
    const n = normalizeName(c)
    if (!n) return false
    if (n === target) return true
    // first+last token overlap
    const ct = n.split(' ')
    const st = target.split(' ')
    if (ct.length >= 2 && st.length >= 2) {
      return ct[0] === st[0] && ct[ct.length - 1] === st[st.length - 1]
    }
    return n.includes(target) || target.includes(n)
  })
}

export function deriveBoardBucket(input: {
  status: ServiceClientStatus
  onClientBreak: boolean
  needsRbt: boolean
  needsAdditionalHours: boolean
  hasRbtBreak: boolean
  receivingServices: boolean
  scheduleLinked: boolean
}): ServiceBoardBucket {
  if (input.status === 'NEW') return 'NEW_INTAKE'
  if (input.status === 'ON_HOLD' || input.status === 'DISCHARGED') {
    return 'ON_HOLD_DISCHARGED'
  }
  if (input.onClientBreak) return 'CLIENT_ON_BREAK'
  if (input.needsRbt) return 'NEEDS_RBT'
  // Name-mismatch: never pretend Receiving / Needs hours from empty schedule
  if (!input.scheduleLinked) return 'SCHEDULE_UNLINKED'
  if (input.needsAdditionalHours) return 'NEEDS_ADDITIONAL_HOURS'
  if (input.hasRbtBreak) return 'RBT_ON_BREAK'
  if (input.receivingServices) return 'RECEIVING_SERVICES'
  return 'NEEDS_ADDITIONAL_HOURS'
}

export function deriveClientMetrics(input: {
  status: ServiceClientStatus
  authHours: number | null
  careTeamBtNames: string[]
  scheduleSlots: Slot[]
  /** True if this client has been linked to the schedule system (not a name-mismatch orphan). */
  scheduleLinked: boolean
  clientBreaks: {
    id: string
    reason: ClientBreakReason
    startDate: Date
    expectedReturnDate: Date
    status: ClientBreakStatus
  }[]
  rbtBreaks: {
    id: string
    btName: string
    reason: ClientBreakReason
    startDate: Date
    expectedReturnDate: Date
    status: ClientBreakStatus
    hasCoverage: boolean
    coverageNotes: string | null
  }[]
  hoursGapThreshold: number
  period: ClientSchedulePeriod
}): DerivedClientMetrics {
  const scheduledHoursPerWeek =
    Math.round(sumScheduledWeeklyHours(input.scheduleSlots) * 100) / 100
  const scheduleBtNames = [
    ...new Set(
      input.scheduleSlots
        .filter((s) => s.isActive)
        .map((s) => rbtDisplayName(s.rbtProfile))
        .filter(Boolean)
    ),
  ]

  const activeClientBreakRow = input.clientBreaks.find((b) => b.status === 'ON_BREAK')
  const activeRbtBreaks = input.rbtBreaks
    .filter((b) => b.status === 'ON_BREAK')
    .map((b) => breakTimerFromRow({ ...b, kind: 'rbt' }))

  const onClientBreak = !!activeClientBreakRow
  const hasCareBt = input.careTeamBtNames.length > 0
  const hasScheduleBt = scheduleBtNames.length > 0
  const hasBt = hasCareBt || hasScheduleBt

  // Needs RBT from care team emptiness; schedule BTs count as covered when linked
  const needsRbt =
    input.status === 'ACTIVE' && !onClientBreak && !hasBt

  const authHours = input.authHours
  const hoursGap =
    authHours != null ? Math.round((authHours - scheduledHoursPerWeek) * 100) / 100 : null

  const receivingServices =
    input.scheduleLinked && scheduledHoursPerWeek > 0 && input.scheduleSlots.length > 0

  // Never treat unlinked (name-mismatch) clients as unserved / needs-hours from schedule
  const notBeingServed =
    input.status === 'ACTIVE' &&
    !onClientBreak &&
    input.scheduleLinked &&
    !receivingServices

  const needsAdditionalHours =
    input.status === 'ACTIVE' &&
    !onClientBreak &&
    !needsRbt &&
    input.scheduleLinked &&
    ((hoursGap != null && hoursGap >= input.hoursGapThreshold && hoursGap > 0) ||
      !receivingServices)

  const careTeamScheduleMismatch = scheduleBtNames.filter(
    (bt) => !careTeamContains(input.careTeamBtNames, bt)
  )

  const boardBucket = deriveBoardBucket({
    status: input.status,
    onClientBreak,
    needsRbt,
    needsAdditionalHours,
    hasRbtBreak: activeRbtBreaks.length > 0,
    receivingServices,
    scheduleLinked: input.scheduleLinked,
  })

  return {
    scheduledHoursPerWeek,
    authHours,
    hoursGap,
    needsAdditionalHours,
    needsRbt,
    notBeingServed,
    scheduleLinked: input.scheduleLinked,
    receivingServices,
    scheduleBtNames,
    careTeamBtNames: input.careTeamBtNames,
    careTeamScheduleMismatch,
    boardBucket,
    activeClientBreak: activeClientBreakRow
      ? breakTimerFromRow({ ...activeClientBreakRow, kind: 'client' })
      : null,
    activeRbtBreaks,
    period: {
      start: input.period.start,
      end: input.period.end,
      label: input.period.label,
    },
  }
}

/** Load period-scoped schedule slots + breaks and derive metrics. */
export async function deriveMetricsForClients(
  clients: {
    id: string
    status: ServiceClientStatus
    authHours: number | null
    btAssignments: { btName: string }[]
  }[],
  hoursGapThreshold?: number,
  period?: ClientSchedulePeriod
): Promise<Map<string, DerivedClientMetrics>> {
  const threshold = hoursGapThreshold ?? (await getHoursGapThreshold())
  const activePeriod = period ?? (await getClientSchedulePeriod())
  const ids = clients.map((c) => c.id)
  if (ids.length === 0) return new Map()

  const periodFilter = schedulePeriodWhere(activePeriod)

  const [periodSlots, linkedAny, clientBreaks, rbtBreaks] = await Promise.all([
    prisma.rbtScheduleAssignment.findMany({
      where: {
        ...periodFilter,
        serviceClientId: { in: ids },
      },
      select: {
        serviceClientId: true,
        startTime: true,
        endTime: true,
        isActive: true,
        rbtProfile: {
          select: { firstName: true, lastName: true, artemisProviderName: true },
        },
      },
    }),
    // Any link at all (so empty period ≠ name-mismatch unlinked)
    prisma.rbtScheduleAssignment.findMany({
      where: {
        isActive: true,
        serviceClientId: { in: ids },
      },
      select: { serviceClientId: true },
      distinct: ['serviceClientId'],
    }),
    prisma.clientServiceBreak.findMany({
      where: { serviceClientId: { in: ids }, status: 'ON_BREAK' },
    }),
    prisma.clientRbtBreak.findMany({
      where: { serviceClientId: { in: ids }, status: 'ON_BREAK' },
    }),
  ])

  const linkedSet = new Set(
    linkedAny.map((r) => r.serviceClientId).filter((id): id is string => !!id)
  )

  const slotsByClient = new Map<string, typeof periodSlots>()
  for (const s of periodSlots) {
    if (!s.serviceClientId) continue
    const list = slotsByClient.get(s.serviceClientId) ?? []
    list.push(s)
    slotsByClient.set(s.serviceClientId, list)
  }
  const cbByClient = new Map<string, typeof clientBreaks>()
  for (const b of clientBreaks) {
    const list = cbByClient.get(b.serviceClientId) ?? []
    list.push(b)
    cbByClient.set(b.serviceClientId, list)
  }
  const rbByClient = new Map<string, typeof rbtBreaks>()
  for (const b of rbtBreaks) {
    const list = rbByClient.get(b.serviceClientId) ?? []
    list.push(b)
    rbByClient.set(b.serviceClientId, list)
  }

  const map = new Map<string, DerivedClientMetrics>()
  for (const c of clients) {
    const cSlots = slotsByClient.get(c.id) ?? []
    map.set(
      c.id,
      deriveClientMetrics({
        status: c.status,
        authHours: c.authHours,
        careTeamBtNames: c.btAssignments.map((b) => b.btName),
        scheduleSlots: cSlots,
        scheduleLinked: linkedSet.has(c.id),
        clientBreaks: cbByClient.get(c.id) ?? [],
        rbtBreaks: rbByClient.get(c.id) ?? [],
        hoursGapThreshold: threshold,
        period: activePeriod,
      })
    )
  }
  return map
}
