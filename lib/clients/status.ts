import type { ServiceBoardBucket } from '@/lib/client-services/serviceStatus'

/**
 * Semantic caseload status — single source of truth for color/label/dot.
 * Do not put status colors inline in UI components.
 */
export type CaseStatus =
  | 'needs_rbt'
  | 'receiving'
  | 'unmatched'
  | 'on_hold'
  | 'intake'

export const STATUS: Record<
  CaseStatus,
  {
    label: string
    fg: string
    dot: string
    bg: string
    ring: string
    urgent?: boolean
  }
> = {
  needs_rbt: {
    label: 'Needs RBT',
    fg: '#B22B30',
    dot: 'var(--urgent)',
    bg: 'var(--urgent-bg)',
    ring: 'var(--urgent)',
    urgent: true,
  },
  intake: {
    label: 'New / Intake',
    fg: 'var(--blue)',
    dot: 'var(--blue)',
    bg: 'var(--blue-bg)',
    ring: 'var(--blue)',
  },
  receiving: {
    label: 'Receiving',
    fg: '#237A34',
    dot: 'var(--green)',
    bg: 'var(--green-bg)',
    ring: 'var(--green)',
  },
  unmatched: {
    label: 'Unmatched schedule',
    fg: '#8A5D06',
    dot: 'var(--amber)',
    bg: 'var(--amber-bg)',
    ring: 'var(--amber)',
  },
  on_hold: {
    label: 'On hold / Discharged',
    fg: 'var(--slate)',
    dot: 'var(--slate)',
    bg: 'var(--slate-bg)',
    ring: 'var(--slate)',
  },
}

export type CaseStatusInput = {
  boardBucket?: ServiceBoardBucket | string | null
  needsRbt?: boolean
  receivingServices?: boolean
  scheduleLinked?: boolean
  status?: string | null
  needsAdditionalHours?: boolean
  activeClientBreak?: unknown
  activeRbtBreaks?: unknown[]
}

/** Map existing CS metrics into the semantic CaseStatus scale. */
export function resolveCaseStatus(client: CaseStatusInput): CaseStatus {
  const bucket = client.boardBucket

  if (bucket === 'NEEDS_RBT' || client.needsRbt) return 'needs_rbt'
  if (bucket === 'NEW_INTAKE' || client.status === 'NEW') return 'intake'
  if (bucket === 'ON_HOLD_DISCHARGED' || client.status === 'ON_HOLD' || client.status === 'DISCHARGED') {
    return 'on_hold'
  }
  if (bucket === 'SCHEDULE_UNLINKED' || client.scheduleLinked === false) return 'unmatched'
  if (
    bucket === 'RECEIVING_SERVICES' ||
    client.receivingServices ||
    bucket === 'NEEDS_ADDITIONAL_HOURS' ||
    bucket === 'CLIENT_ON_BREAK' ||
    bucket === 'RBT_ON_BREAK'
  ) {
    // Needs hours / breaks still "in service" for the semantic scale
    if (bucket === 'NEEDS_ADDITIONAL_HOURS' && client.needsRbt) return 'needs_rbt'
    return 'receiving'
  }

  if (client.needsRbt) return 'needs_rbt'
  if (client.receivingServices) return 'receiving'
  return 'receiving'
}

export function statusSortRank(status: CaseStatus): number {
  switch (status) {
    case 'needs_rbt':
      return 0
    case 'unmatched':
      return 1
    case 'intake':
      return 2
    case 'receiving':
      return 3
    case 'on_hold':
      return 4
    default:
      return 5
  }
}
