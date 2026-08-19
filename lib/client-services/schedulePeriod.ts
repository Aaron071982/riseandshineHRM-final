import { prisma } from '@/lib/prisma'
import { LIVE_REVIEW_STATUSES } from '@/lib/schedule/live'

/**
 * Active Client Services ↔ schedule period.
 *
 * Resolution order:
 * 1. Explicit company_settings `client_services_schedule_period`
 * 2. Latest active Artemis/import assignment period (tracks HRM schedule updates)
 * 3. DEFAULT_CLIENT_SCHEDULE_PERIOD fallback
 *
 * Schedule import also writes (1) so the portal follows new weeks automatically.
 */
export const DEFAULT_CLIENT_SCHEDULE_PERIOD = {
  start: '2026-07-15',
  end: '2026-07-31',
} as const

export const CLIENT_SCHEDULE_PERIOD_SETTING_KEY = 'client_services_schedule_period'

export type ClientSchedulePeriod = {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  startDate: Date
  endDate: Date
  label: string
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatLabel(start: string, end: string): string {
  const fmt = (ymd: string) => {
    const d = parseYmd(ymd)
    if (!d) return ymd
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export function buildPeriod(start: string, end: string): ClientSchedulePeriod | null {
  const startDate = parseYmd(start)
  const endDate = parseYmd(end)
  if (!startDate || !endDate || endDate < startDate) return null
  return {
    start,
    end,
    startDate,
    endDate,
    label: formatLabel(start, end),
  }
}

/** Prisma where for assignments visible for a CS period — matches Schedule workspace. */
export function schedulePeriodWhere(period: ClientSchedulePeriod) {
  return {
    isActive: true as const,
    deletedAt: null,
    reviewStatus: { in: LIVE_REVIEW_STATUSES },
    OR: [
      { periodStart: period.startDate, periodEnd: period.endDate },
      { source: 'MANUAL' as const, periodStart: null, periodEnd: null },
    ],
  }
}

/** Most recent period that still has active schedule assignments. */
export async function getLatestActiveSchedulePeriod(): Promise<ClientSchedulePeriod | null> {
  const row = await prisma.rbtScheduleAssignment.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      reviewStatus: { in: LIVE_REVIEW_STATUSES },
      periodStart: { not: null },
      periodEnd: { not: null },
    },
    orderBy: [{ periodEnd: 'desc' }, { periodStart: 'desc' }, { updatedAt: 'desc' }],
    select: { periodStart: true, periodEnd: true },
  })
  if (!row?.periodStart || !row?.periodEnd) return null
  return buildPeriod(isoDateUtc(row.periodStart), isoDateUtc(row.periodEnd))
}

/**
 * Resolve the active schedule period.
 * Prefer the latest period that has active schedule rows (tracks HRM updates),
 * then an explicit company_settings override, then the hardcoded default.
 */
export async function getClientSchedulePeriod(): Promise<ClientSchedulePeriod> {
  try {
    const latest = await getLatestActiveSchedulePeriod()
    if (latest) return latest
  } catch {
    // fall through
  }

  try {
    const row = await prisma.companySetting.findUnique({
      where: { key: CLIENT_SCHEDULE_PERIOD_SETTING_KEY },
    })
    const value = row?.value as { start?: string; end?: string } | null
    if (value?.start && value?.end) {
      const built = buildPeriod(String(value.start), String(value.end))
      if (built) return built
    }
  } catch {
    // fall through
  }

  const fallback = buildPeriod(
    DEFAULT_CLIENT_SCHEDULE_PERIOD.start,
    DEFAULT_CLIENT_SCHEDULE_PERIOD.end
  )
  if (!fallback) {
    throw new Error('Invalid DEFAULT_CLIENT_SCHEDULE_PERIOD')
  }
  return fallback
}

export async function setClientSchedulePeriod(
  start: string,
  end: string
): Promise<ClientSchedulePeriod> {
  const built = buildPeriod(start, end)
  if (!built) {
    throw new Error('Invalid period dates (use YYYY-MM-DD, end ≥ start)')
  }
  await prisma.companySetting.upsert({
    where: { key: CLIENT_SCHEDULE_PERIOD_SETTING_KEY },
    create: {
      key: CLIENT_SCHEDULE_PERIOD_SETTING_KEY,
      value: { start: built.start, end: built.end },
    },
    update: {
      value: { start: built.start, end: built.end },
    },
  })
  return built
}
