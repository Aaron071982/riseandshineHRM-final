/** Normalized Artemis session status keys stored on billing_sessions.sessionStatus */
export const ARTEMIS_STATUS = {
  SCHEDULED: 'scheduled',
  INCOMPLETE: 'incomplete',
  COMPLETED: 'completed',
  READY_TO_BILL: 'ready_to_bill',
  IN_PROGRESS: 'in_progress',
  CANCELLED: 'cancelled',
  DELETED: 'deleted',
} as const

export type ArtemisSessionStatusKey =
  (typeof ARTEMIS_STATUS)[keyof typeof ARTEMIS_STATUS]

export const PAYABLE_STATUS_OPTIONS: {
  key: ArtemisSessionStatusKey
  label: string
  defaultOn: boolean
}[] = [
  { key: ARTEMIS_STATUS.COMPLETED, label: 'Completed', defaultOn: true },
  { key: ARTEMIS_STATUS.READY_TO_BILL, label: 'Ready to Bill', defaultOn: true },
  { key: ARTEMIS_STATUS.IN_PROGRESS, label: 'In Progress', defaultOn: false },
  { key: ARTEMIS_STATUS.INCOMPLETE, label: 'Incomplete', defaultOn: false },
  { key: ARTEMIS_STATUS.SCHEDULED, label: 'Scheduled', defaultOn: false },
]

export const DEFAULT_PAYABLE_STATUSES: ArtemisSessionStatusKey[] = [
  ARTEMIS_STATUS.COMPLETED,
  ARTEMIS_STATUS.READY_TO_BILL,
]

export const ALWAYS_EXCLUDED_STATUSES = new Set<ArtemisSessionStatusKey>([
  ARTEMIS_STATUS.CANCELLED,
  ARTEMIS_STATUS.DELETED,
])

const SUMMARY_STATUSES = new Set(['subtotal', 'total', 'sum', 'count'])

const ALLOWED_STATUS_KEYS = new Set<string>(Object.values(ARTEMIS_STATUS))

/** Artemis export labels and stored DB keys → normalized key */
const STATUS_ALIASES: Record<string, ArtemisSessionStatusKey> = {
  completed: ARTEMIS_STATUS.COMPLETED,
  'ready to bill': ARTEMIS_STATUS.READY_TO_BILL,
  'in progress': ARTEMIS_STATUS.IN_PROGRESS,
  incomplete: ARTEMIS_STATUS.INCOMPLETE,
  scheduled: ARTEMIS_STATUS.SCHEDULED,
  cancelled: ARTEMIS_STATUS.CANCELLED,
  canceled: ARTEMIS_STATUS.CANCELLED,
  deleted: ARTEMIS_STATUS.DELETED,
}

export function isSummaryArtemisStatus(status: string | null): boolean {
  return SUMMARY_STATUSES.has((status ?? '').trim().toLowerCase())
}

/**
 * Map Artemis export labels, stored sessionStatus keys (snake_case), or mixed input
 * to a single normalized key. All payroll hour math must use this — never compare raw strings.
 */
export function normalizeArtemisStatus(raw: string | null | undefined): ArtemisSessionStatusKey | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return null
  if (ALLOWED_STATUS_KEYS.has(s)) return s as ArtemisSessionStatusKey
  const spaced = s.replace(/_/g, ' ')
  return STATUS_ALIASES[spaced] ?? null
}

export function sessionMatchesStatusFilter(
  sessionStatus: string | null | undefined,
  filterStatus: ArtemisSessionStatusKey
): boolean {
  return normalizeArtemisStatus(sessionStatus) === filterStatus
}

export function isAlwaysExcludedStatus(
  status: ArtemisSessionStatusKey | null | undefined
): boolean {
  return status != null && ALWAYS_EXCLUDED_STATUSES.has(status)
}

export function parsePayableStatusesJson(value: unknown): ArtemisSessionStatusKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_PAYABLE_STATUSES]
  const allowed = new Set(PAYABLE_STATUS_OPTIONS.map((o) => o.key))
  const parsed = value
    .map((v) => String(v).trim().toLowerCase())
    .filter((v): v is ArtemisSessionStatusKey => allowed.has(v as ArtemisSessionStatusKey))
  return parsed.length > 0 ? parsed : [...DEFAULT_PAYABLE_STATUSES]
}

export function statusLabel(key: ArtemisSessionStatusKey): string {
  return PAYABLE_STATUS_OPTIONS.find((o) => o.key === key)?.label ?? key
}

export type SessionForPayroll = {
  sessionStatus: string | null
  actualMinutes: number
}

export type StatusHoursBreakdown = Record<ArtemisSessionStatusKey, number>

export function emptyStatusBreakdown(): StatusHoursBreakdown {
  return {
    [ARTEMIS_STATUS.SCHEDULED]: 0,
    [ARTEMIS_STATUS.INCOMPLETE]: 0,
    [ARTEMIS_STATUS.COMPLETED]: 0,
    [ARTEMIS_STATUS.READY_TO_BILL]: 0,
    [ARTEMIS_STATUS.IN_PROGRESS]: 0,
    [ARTEMIS_STATUS.CANCELLED]: 0,
    [ARTEMIS_STATUS.DELETED]: 0,
  }
}

export function computeStatusBreakdown(sessions: SessionForPayroll[]): StatusHoursBreakdown {
  const breakdown = emptyStatusBreakdown()
  for (const s of sessions) {
    const key = normalizeArtemisStatus(s.sessionStatus)
    if (!key || isAlwaysExcludedStatus(key)) continue
    breakdown[key] += s.actualMinutes / 60
  }
  return breakdown
}

export function computePayableHours(
  sessions: SessionForPayroll[],
  payableStatuses: ArtemisSessionStatusKey[]
): number {
  const set = new Set(payableStatuses)
  let minutes = 0
  for (const s of sessions) {
    const key = normalizeArtemisStatus(s.sessionStatus)
    if (!key || isAlwaysExcludedStatus(key)) continue
    if (set.has(key)) minutes += s.actualMinutes
  }
  return minutes / 60
}

export function countPayableSessions(
  sessions: SessionForPayroll[],
  payableStatuses: ArtemisSessionStatusKey[]
): number {
  const set = new Set(payableStatuses)
  return sessions.filter((s) => {
    const key = normalizeArtemisStatus(s.sessionStatus)
    return key != null && !isAlwaysExcludedStatus(key) && set.has(key)
  }).length
}

export function payableStatusLabels(statuses: ArtemisSessionStatusKey[]): string {
  return statuses.map((k) => statusLabel(k)).join(', ')
}
