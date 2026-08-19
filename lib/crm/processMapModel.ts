import type { ClientOwnerDept, ClientStage, CrmRole } from '@prisma/client'
import {
  LINEAR_STAGE_ORDER,
  STAGE_DEFAULT_OWNER_DEPT,
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
} from '@/lib/crm/stages'

/**
 * Pure shape + config for the CRM process chart. Kept free of prisma /
 * next/headers imports so the React Flow client components can import it.
 */

/** Pipeline reading order for the process chart (left → right). */
export const PROCESS_DEPT_ORDER: readonly ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'BILLING',
  'STAFFING',
  'CASE_COORDINATION',
] as const

/** Stage-group accent tokens (Phase 6) reused per department. */
export const PROCESS_DEPT_ACCENT: Record<
  ClientOwnerDept,
  { fg: string; bg: string }
> = {
  INTAKE: { fg: 'var(--stage-intake)', bg: 'var(--stage-intake-bg)' },
  CLINICAL: { fg: 'var(--stage-clinical)', bg: 'var(--stage-clinical-bg)' },
  AUTHORIZATION: { fg: 'var(--stage-coord)', bg: 'var(--stage-coord-bg)' },
  STAFFING: { fg: 'var(--stage-staffing)', bg: 'var(--stage-staffing-bg)' },
  CASE_COORDINATION: { fg: 'var(--slate)', bg: 'var(--slate-bg)' },
  BILLING: { fg: 'var(--stage-active)', bg: 'var(--stage-active-bg)' },
}

/** Full-access CRM roles — rendered in the "Leadership / sees all" node. */
export const LEADERSHIP_ROLES: readonly CrmRole[] = [
  'SUPER_ADMIN',
  'MANAGEMENT',
] as const

export const CRM_ROLE_LABELS: Record<CrmRole, string> = {
  SUPER_ADMIN: 'Super admin',
  MANAGEMENT: 'Management',
  INTAKE: 'Intake',
  CLINICAL: 'Clinical',
  AUTHORIZATION: 'Authorization',
  STAFFING: 'Staffing',
  CASE_COORDINATION: 'Case coordination',
  BILLING: 'Billing',
}

/** Department role that owns each queue (mirror of OWNER_DEPT_TO_CRM_ROLE). */
export const PROCESS_DEPT_TO_ROLE: Record<ClientOwnerDept, CrmRole> = {
  INTAKE: 'INTAKE',
  CLINICAL: 'CLINICAL',
  AUTHORIZATION: 'BILLING',
  STAFFING: 'STAFFING',
  CASE_COORDINATION: 'CASE_COORDINATION',
  BILLING: 'BILLING',
}

export type ProcessPerson = {
  id: string
  /** `name ?? email` — never client PHI. */
  label: string
  roles: CrmRole[]
}

export type ProcessStage = {
  stage: ClientStage
  label: string
  description: string
}

export type ProcessCounts = {
  total: number
  unclaimed: number
  claimed: number
}

export type ProcessHandoffKind = 'forward' | 'return' | 'implied'

export type ProcessHandoff = {
  id: string
  from: ClientOwnerDept
  to: ClientOwnerDept
  /** e.g. "Documents → Benefits" — every stage transition on this hop. */
  labels: string[]
  kind: ProcessHandoffKind
}

export type ProcessDepartment = {
  dept: ClientOwnerDept
  label: string
  slug: string
  href: string
  accent: { fg: string; bg: string }
  stages: ProcessStage[]
  people: ProcessPerson[]
  counts: ProcessCounts
  /** Viewer holds the role (or full access) → node deep-links to the queue. */
  canOpen: boolean
  /** Counts are limited to the viewer's own scope, not the whole department. */
  scopeLimited: boolean
}

export type ProcessMapData = {
  departments: ProcessDepartment[]
  leadership: ProcessPerson[]
  handoffs: ProcessHandoff[]
  parallelTrack: ProcessStage & { ownerDept: ClientOwnerDept }
  viewerFullAccess: boolean
}

/**
 * Handoff path derived from stage config: every point in LINEAR_STAGE_ORDER
 * where the default owning department changes becomes an edge.
 */
export function buildHandoffs(): ProcessHandoff[] {
  const order = (dept: ClientOwnerDept) => PROCESS_DEPT_ORDER.indexOf(dept)
  const byPair = new Map<string, ProcessHandoff>()

  for (let i = 1; i < LINEAR_STAGE_ORDER.length; i += 1) {
    const prevStage = LINEAR_STAGE_ORDER[i - 1]!
    const stage = LINEAR_STAGE_ORDER[i]!
    const from = STAGE_DEFAULT_OWNER_DEPT[prevStage]
    const to = STAGE_DEFAULT_OWNER_DEPT[stage]
    if (from === to) continue

    const key = `${from}->${to}`
    const label = `${STAGE_LABELS[prevStage]} → ${STAGE_LABELS[stage]}`
    const existing = byPair.get(key)
    if (existing) {
      if (!existing.labels.includes(label)) existing.labels.push(label)
      continue
    }
    byPair.set(key, {
      id: `handoff-${from}-${to}`,
      from,
      to,
      labels: [label],
      kind: order(to) > order(from) ? 'forward' : 'return',
    })
  }

  return [...byPair.values()]
}

/** Stages each department owns, in pipeline order (TREATMENT_PLAN excluded). */
export function stagesByDept(): Record<ClientOwnerDept, ProcessStage[]> {
  const map = Object.fromEntries(
    PROCESS_DEPT_ORDER.map((d) => [d, [] as ProcessStage[]])
  ) as Record<ClientOwnerDept, ProcessStage[]>

  for (const stage of LINEAR_STAGE_ORDER) {
    map[STAGE_DEFAULT_OWNER_DEPT[stage]]!.push({
      stage,
      label: STAGE_LABELS[stage],
      description: STAGE_DESCRIPTIONS[stage],
    })
  }
  return map
}
