import { prisma } from '@/lib/prisma'

/**
 * Active Client Services ↔ schedule period.
 *
 * Change these defaults (or set company_settings key
 * `client_services_schedule_period`) when the biweekly window rolls.
 * All portal schedule reads/derives go through getClientSchedulePeriod().
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

/** Prisma where clause fragment for assignments in the active period. */
export function schedulePeriodWhere(period: ClientSchedulePeriod) {
  return {
    isActive: true as const,
    periodStart: period.startDate,
    periodEnd: period.endDate,
  }
}

/**
 * Resolve the active schedule period.
 * Prefer company_settings JSON `{ start, end }`, else DEFAULT_CLIENT_SCHEDULE_PERIOD.
 */
export async function getClientSchedulePeriod(): Promise<ClientSchedulePeriod> {
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
    // fall through to default
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
