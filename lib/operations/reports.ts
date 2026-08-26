import type { ClientStage, CommTemplate, Prisma } from '@prisma/client'
import {
  getVisibleClientsWhere,
  type CrmUser as AccessCrmUser,
} from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import {
  STAGE_LABELS,
  LINEAR_STAGE_ORDER,
  OWNER_DEPT_LABELS,
  requirementStatusSatisfies,
} from '@/lib/crm/stages'
import { STAGE_MAX_DAYS, daysInStage, isStalled } from '@/lib/crm/thresholds'
import { staffTemplateLabel } from '@/lib/crm/emails/templates'
import {
  CANONICAL_DOCUMENT_KEYS,
  DOCUMENT_BY_KEY,
  isDocumentRequired,
} from '@/lib/crm/documents'
import { isReadyForCoordination } from '@/lib/crm/claims'
import {
  authBandLabel,
  authExpiryBand,
  daysUntilExpiry,
  isInAuthAttentionWindow,
} from '@/lib/operations/authBands'
import { median } from '@/lib/operations/csv'
import { logOpsReportRun } from '@/lib/operations/audit'

export type ReportColumn = { key: string; header: string }

export type ReportResult = {
  key: string
  title: string
  description: string
  summary: string
  refreshedAt: string
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
  meta?: Record<string, unknown>
  gaps?: string[]
}

export type ReportDefinition = {
  key: string
  title: string
  description: string
  run: (user: AccessCrmUser) => Promise<ReportResult>
}

export type EmailActivityFilters = {
  from?: Date | string
  to?: Date | string
  senderUserId?: string
  template?: CommTemplate
  clientId?: string
  quickRange?: 'week_to_date' | 'last_full_week'
}

/** LIVE clients from APPROVED through ACTIVE (post-authorization staffing track). */
const UNSTAFFED_STAGES: ClientStage[] = [
  'APPROVED',
  'READY_FOR_STAFFING',
  'RBT_SEARCH',
  'RBT_ASSIGNED',
  'SCHEDULE_COORDINATION',
  'SCHEDULE_CONFIRMED',
  'PRE_START',
  'ACTIVE',
]

const MISSING_DOC_STATUSES = ['MISSING', 'PENDING', 'EXPIRED'] as const

function clientLabel(
  firstName: string,
  lastName: string,
  clientCode: string
): string {
  return `${lastName}, ${firstName} (${clientCode})`
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + diff)
  return x
}

function parseDate(v: Date | string | undefined): Date | undefined {
  if (v == null) return undefined
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function resolveEmailRange(
  filters?: EmailActivityFilters,
  now = new Date()
): { from: Date; to: Date; label: string } {
  const monday = startOfWeekMonday(now)
  if (filters?.quickRange === 'last_full_week') {
    const from = new Date(monday)
    from.setDate(from.getDate() - 7)
    return { from, to: monday, label: 'last full week' }
  }
  if (filters?.quickRange === 'week_to_date' || (!filters?.from && !filters?.to)) {
    return { from: monday, to: now, label: 'week to date' }
  }
  const from = parseDate(filters?.from) ?? monday
  const to = parseDate(filters?.to) ?? now
  return { from, to, label: 'custom range' }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function visibleWhere(user: AccessCrmUser): Prisma.ServiceClientWhereInput {
  return getVisibleClientsWhere(user)
}

function userDisplayName(u: {
  name: string | null
  email: string | null
} | null): string {
  if (!u) return '—'
  return u.name?.trim() || u.email?.trim() || '—'
}

// ─── 1. Pipeline Health ─────────────────────────────────────────────────────

async function runPipelineHealth(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const clients = await prisma.serviceClient.findMany({
    where: { AND: [visible, { pipelineStatus: 'LIVE' }] },
    select: {
      stage: true,
      stageEnteredAt: true,
      rbtTargetDate: true,
    },
  })

  const byStage = new Map<
    ClientStage,
    { ages: number[]; stalled: number; count: number }
  >()
  for (const stage of LINEAR_STAGE_ORDER) {
    byStage.set(stage, { ages: [], stalled: 0, count: 0 })
  }
  // Legacy parallel track
  byStage.set('TREATMENT_PLAN', { ages: [], stalled: 0, count: 0 })

  for (const c of clients) {
    const bucket = byStage.get(c.stage) ?? {
      ages: [] as number[],
      stalled: 0,
      count: 0,
    }
    if (!byStage.has(c.stage)) byStage.set(c.stage, bucket)
    bucket.count += 1
    const age = daysInStage(c)
    bucket.ages.push(age)
    if (isStalled(c)) bucket.stalled += 1
  }

  const stages: ClientStage[] = [
    ...LINEAR_STAGE_ORDER,
    ...(byStage.get('TREATMENT_PLAN')!.count > 0
      ? (['TREATMENT_PLAN'] as ClientStage[])
      : []),
  ]

  const rows = stages.map((stage) => {
    const b = byStage.get(stage)!
    const med = median(b.ages)
    const threshold = STAGE_MAX_DAYS[stage]
    return {
      stageKey: stage,
      stage: STAGE_LABELS[stage],
      count: b.count,
      medianDays: med,
      stalledCount: b.stalled,
      thresholdDays: threshold,
      overThreshold: b.stalled > 0 ? 'Yes' : 'No',
    }
  })

  const total = clients.length
  const stalledTotal = rows.reduce((n, r) => n + Number(r.stalledCount), 0)

  return {
    key: 'pipeline-health',
    title: 'Pipeline Health',
    description:
      'Visible LIVE clients by pipeline stage, with median days in stage and stall flags against STAGE_MAX_DAYS.',
    summary: `${total} LIVE client${total === 1 ? '' : 's'} · ${stalledTotal} stalled`,
    refreshedAt: new Date().toISOString(),
    columns: [
      { key: 'stage', header: 'Stage' },
      { key: 'count', header: 'Count' },
      { key: 'medianDays', header: 'Median days in stage' },
      { key: 'stalledCount', header: 'Stalled' },
      { key: 'thresholdDays', header: 'Max days' },
      { key: 'overThreshold', header: 'Any stalled?' },
    ],
    rows,
    meta: { total, stalledTotal },
  }
}

// ─── 2. Unstaffed Active ────────────────────────────────────────────────────

async function runUnstaffedActive(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const base: Prisma.ServiceClientWhereInput = {
    AND: [
      visible,
      { pipelineStatus: 'LIVE' },
      { stage: { in: UNSTAFFED_STAGES } },
    ],
  }

  const clients = await prisma.serviceClient.findMany({
    where: base,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clientCode: true,
      stage: true,
      stageEnteredAt: true,
      caseCoordinatorName: true,
      caseCoordinatorUser: { select: { name: true, email: true } },
      scheduleAssignments: {
        where: { deletedAt: null, isActive: true },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const activeTotal = clients.length
  const unstaffed = clients.filter((c) => c.scheduleAssignments.length === 0)
  const activeUnstaffed = unstaffed.length
  const staffingPct =
    activeTotal === 0
      ? null
      : Math.round(((activeTotal - activeUnstaffed) / activeTotal) * 1000) / 10

  const rows = unstaffed.map((c) => ({
    clientId: c.id,
    client: clientLabel(c.firstName, c.lastName, c.clientCode),
    stage: STAGE_LABELS[c.stage],
    stageKey: c.stage,
    caseCoordinator:
      userDisplayName(c.caseCoordinatorUser) !== '—'
        ? userDisplayName(c.caseCoordinatorUser)
        : c.caseCoordinatorName?.trim() || 'Unassigned',
    daysUnstaffed: daysInStage(c),
  }))

  return {
    key: 'unstaffed-active',
    title: 'Unstaffed Active Clients',
    description:
      'LIVE clients from Approved through Active with no active RBT schedule assignment.',
    summary: `${activeUnstaffed} of ${activeTotal} post-auth clients unstaffed${
      staffingPct == null ? '' : ` · ${staffingPct}% staffed`
    }`,
    refreshedAt: new Date().toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'stage', header: 'Stage' },
      { key: 'caseCoordinator', header: 'Case coordinator' },
      { key: 'daysUnstaffed', header: 'Days in stage' },
    ],
    rows,
    meta: { activeTotal, activeUnstaffed, staffingPct },
    gaps: [
      'Unstaffed is inferred from rbt_schedule_assignments (deletedAt null, isActive true); BT assignments alone do not count as staffed.',
    ],
  }
}

// ─── 3. Missing Documents ───────────────────────────────────────────────────

async function runMissingDocuments(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const now = new Date()
  const clients = await prisma.serviceClient.findMany({
    where: {
      AND: [
        visible,
        {
          requirements: {
            some: {
              deletedAt: null,
              status: { in: [...MISSING_DOC_STATUSES] },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clientCode: true,
      stage: true,
      requirements: {
        where: {
          deletedAt: null,
          status: { in: [...MISSING_DOC_STATUSES] },
        },
        select: {
          key: true,
          label: true,
          status: true,
          expiresAt: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const rows: Record<string, string | number | null>[] = []
  for (const c of clients) {
    const open = c.requirements.filter(
      (r) => !requirementStatusSatisfies(r.key, r.status, r.expiresAt, now)
    )
    if (!open.length) continue
    const docLabels = open.map(
      (r) => DOCUMENT_BY_KEY[r.key]?.label ?? r.label ?? r.key
    )
    const oldest = open.reduce((min, r) => {
      const t = (r.updatedAt ?? r.createdAt).getTime()
      return t < min ? t : min
    }, Infinity)
    const daysOpen =
      oldest === Infinity
        ? null
        : Math.max(0, Math.floor((now.getTime() - oldest) / (24 * 60 * 60 * 1000)))

    rows.push({
      clientId: c.id,
      client: clientLabel(c.firstName, c.lastName, c.clientCode),
      stage: STAGE_LABELS[c.stage],
      missingCount: open.length,
      missingDocs: docLabels.join('; '),
      daysOpen,
    })
  }

  return {
    key: 'missing-documents',
    title: 'Missing Documents',
    description:
      'Clients with requirements in MISSING / PENDING / EXPIRED that fail the satisfaction gate (source for Documents Needed nudges).',
    summary: `${rows.length} client${rows.length === 1 ? '' : 's'} with outstanding documents`,
    refreshedAt: now.toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'stage', header: 'Stage' },
      { key: 'missingCount', header: 'Open docs' },
      { key: 'missingDocs', header: 'Outstanding' },
      { key: 'daysOpen', header: 'Days open (oldest)' },
    ],
    rows,
  }
}

// ─── 4. Authorizations Expiring ─────────────────────────────────────────────

async function runAuthorizationsExpiring(
  user: AccessCrmUser
): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const now = new Date()
  const auths = await prisma.clientAuthorization.findMany({
    where: {
      deletedAt: null,
      expirationDate: { not: null },
      serviceClient: visible,
    },
    select: {
      id: true,
      authType: true,
      status: true,
      authNumber: true,
      payerName: true,
      expirationDate: true,
      effectiveDate: true,
      serviceClient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientCode: true,
          stage: true,
        },
      },
      lines: {
        where: { deletedAt: null },
        select: {
          cptCode: true,
          unitsApproved: true,
          unitsAuthorized: true,
          unitsUsed: true,
          unitsRequested: true,
        },
      },
    },
    orderBy: { expirationDate: 'asc' },
  })

  const rows: Record<string, string | number | null>[] = []
  for (const a of auths) {
    if (!a.expirationDate) continue
    const days = daysUntilExpiry(a.expirationDate, now)
    if (!isInAuthAttentionWindow(days)) continue
    const band = authExpiryBand(days)
    const cpt = a.lines.map((l) => l.cptCode).join(', ') || '—'
    const unitsApproved = a.lines.reduce(
      (n, l) => n + (l.unitsApproved ?? l.unitsAuthorized ?? 0),
      0
    )
    const unitsUsed = a.lines.reduce((n, l) => n + (l.unitsUsed ?? 0), 0)

    rows.push({
      authId: a.id,
      clientId: a.serviceClient.id,
      client: clientLabel(
        a.serviceClient.firstName,
        a.serviceClient.lastName,
        a.serviceClient.clientCode
      ),
      stage: STAGE_LABELS[a.serviceClient.stage],
      authType: a.authType,
      authNumber: a.authNumber,
      payer: a.payerName,
      status: a.status,
      expirationDate: isoDate(a.expirationDate),
      daysRemaining: days,
      band: authBandLabel(band),
      cptCodes: cpt,
      unitsApproved,
      unitsUsed,
    })
  }

  return {
    key: 'authorizations-expiring',
    title: 'Authorizations Expiring',
    description:
      'Assessment and treatment authorizations with expiration inside the ≤45-day attention window (or already expired).',
    summary: `${rows.length} authorization${rows.length === 1 ? '' : 's'} in attention window`,
    refreshedAt: now.toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'authType', header: 'Type' },
      { key: 'band', header: 'Band' },
      { key: 'daysRemaining', header: 'Days remaining' },
      { key: 'expirationDate', header: 'Expires' },
      { key: 'cptCodes', header: 'CPT lines' },
      { key: 'unitsApproved', header: 'Units approved' },
      { key: 'unitsUsed', header: 'Units used' },
      { key: 'payer', header: 'Payer' },
      { key: 'status', header: 'Status' },
    ],
    rows,
  }
}

// ─── 5. Reassessments Due (TREATMENT only) ──────────────────────────────────

async function runReassessmentsDue(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const now = new Date()
  const auths = await prisma.clientAuthorization.findMany({
    where: {
      deletedAt: null,
      authType: 'TREATMENT',
      expirationDate: { not: null },
      serviceClient: visible,
    },
    select: {
      id: true,
      authNumber: true,
      payerName: true,
      status: true,
      effectiveDate: true,
      expirationDate: true,
      serviceClient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientCode: true,
          stage: true,
          caseCoordinatorUser: { select: { name: true, email: true } },
          caseCoordinatorName: true,
        },
      },
    },
    orderBy: { expirationDate: 'asc' },
  })

  const rows: Record<string, string | number | null>[] = []
  for (const a of auths) {
    if (!a.expirationDate) continue
    const days = daysUntilExpiry(a.expirationDate, now)
    if (!isInAuthAttentionWindow(days)) continue
    const band = authExpiryBand(days)
    const cc =
      userDisplayName(a.serviceClient.caseCoordinatorUser) !== '—'
        ? userDisplayName(a.serviceClient.caseCoordinatorUser)
        : a.serviceClient.caseCoordinatorName?.trim() || 'Unassigned'

    rows.push({
      authId: a.id,
      clientId: a.serviceClient.id,
      client: clientLabel(
        a.serviceClient.firstName,
        a.serviceClient.lastName,
        a.serviceClient.clientCode
      ),
      stage: STAGE_LABELS[a.serviceClient.stage],
      caseCoordinator: cc,
      effectiveDate: a.effectiveDate ? isoDate(a.effectiveDate) : null,
      expirationDate: isoDate(a.expirationDate),
      daysRemaining: days,
      band: authBandLabel(band),
      authNumber: a.authNumber,
      payer: a.payerName,
      status: a.status,
    })
  }

  return {
    key: 'reassessments-due',
    title: 'Reassessments Due',
    description:
      'Treatment authorizations approaching expiration (same 45/30/14/7/0 band engine) — reassessment / reauth planning list.',
    summary: `${rows.length} treatment auth${rows.length === 1 ? '' : 's'} needing attention`,
    refreshedAt: now.toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'band', header: 'Band' },
      { key: 'daysRemaining', header: 'Days remaining' },
      { key: 'expirationDate', header: 'Auth ends' },
      { key: 'effectiveDate', header: 'Auth starts' },
      { key: 'caseCoordinator', header: 'Case coordinator' },
      { key: 'payer', header: 'Payer' },
      { key: 'status', header: 'Status' },
    ],
    rows,
  }
}

// ─── 6. Under-Approved ──────────────────────────────────────────────────────

async function runUnderApproved(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const lines = await prisma.clientAuthorizationLine.findMany({
    where: {
      deletedAt: null,
      authorization: {
        deletedAt: null,
        serviceClient: visible,
      },
      OR: [
        { isUnderApproved: true },
        {
          AND: [
            { unitsApproved: { not: null } },
            { unitsRequested: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      cptCode: true,
      unitsRequested: true,
      unitsApproved: true,
      unitsAuthorized: true,
      unitsUsed: true,
      isUnderApproved: true,
      description: true,
      authorization: {
        select: {
          id: true,
          authType: true,
          authNumber: true,
          payerName: true,
          status: true,
          serviceClient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientCode: true,
              stage: true,
            },
          },
        },
      },
    },
  })

  const rows: Record<string, string | number | null>[] = []
  for (const line of lines) {
    const approved = line.unitsApproved
    const requested = line.unitsRequested
    const under =
      line.isUnderApproved ||
      (approved != null && requested != null && approved < requested)
    if (!under) continue
    const sc = line.authorization.serviceClient
    rows.push({
      lineId: line.id,
      authId: line.authorization.id,
      clientId: sc.id,
      client: clientLabel(sc.firstName, sc.lastName, sc.clientCode),
      stage: STAGE_LABELS[sc.stage],
      authType: line.authorization.authType,
      cptCode: line.cptCode,
      unitsRequested: requested,
      unitsApproved: approved,
      shortfall:
        requested != null && approved != null ? requested - approved : null,
      payer: line.authorization.payerName,
      status: line.authorization.status,
      description: line.description,
    })
  }

  rows.sort((a, b) => String(a.client).localeCompare(String(b.client)))

  return {
    key: 'under-approved',
    title: 'Under-Approved Authorizations',
    description:
      'Authorization lines flagged isUnderApproved or where unitsApproved < unitsRequested.',
    summary: `${rows.length} under-approved line${rows.length === 1 ? '' : 's'}`,
    refreshedAt: new Date().toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'authType', header: 'Type' },
      { key: 'cptCode', header: 'CPT' },
      { key: 'unitsRequested', header: 'Requested' },
      { key: 'unitsApproved', header: 'Approved' },
      { key: 'shortfall', header: 'Shortfall' },
      { key: 'payer', header: 'Payer' },
      { key: 'status', header: 'Status' },
    ],
    rows,
  }
}

// ─── 7. Department Queue Load ───────────────────────────────────────────────

async function runDepartmentQueue(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const clients = await prisma.serviceClient.findMany({
    where: { AND: [visible, { pipelineStatus: 'LIVE' }] },
    select: {
      currentOwnerDept: true,
      claims: {
        where: { releasedAt: null },
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  const deptCounts = new Map<string, number>()
  const claimantCounts = new Map<string, { name: string; count: number }>()

  for (const c of clients) {
    const dept = c.currentOwnerDept ?? 'UNASSIGNED'
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1)
    for (const claim of c.claims) {
      const existing = claimantCounts.get(claim.userId)
      if (existing) {
        existing.count += 1
      } else {
        claimantCounts.set(claim.userId, {
          name: userDisplayName(claim.user),
          count: 1,
        })
      }
    }
  }

  const deptRows = [...deptCounts.entries()]
    .map(([dept, count]) => ({
      dimension: 'Department',
      name:
        dept === 'UNASSIGNED'
          ? 'Unassigned'
          : OWNER_DEPT_LABELS[dept as keyof typeof OWNER_DEPT_LABELS] ?? dept,
      key: dept,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const claimantRows = [...claimantCounts.entries()]
    .map(([userId, v]) => ({
      dimension: 'Claimant',
      name: v.name,
      key: userId,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count)

  const rows = [...deptRows, ...claimantRows]

  return {
    key: 'department-queue',
    title: 'Department Queue Load',
    description:
      'LIVE clients by owning department and by active claimant — backlog visibility for leadership.',
    summary: `${clients.length} LIVE · ${deptRows.length} departments · ${claimantRows.length} claimants`,
    refreshedAt: new Date().toISOString(),
    columns: [
      { key: 'dimension', header: 'Dimension' },
      { key: 'name', header: 'Name' },
      { key: 'count', header: 'Count' },
    ],
    rows,
    meta: {
      liveTotal: clients.length,
      byDepartment: deptRows.length,
      byClaimant: claimantRows.length,
    },
  }
}

// ─── 8. Case Coordinator Load ───────────────────────────────────────────────

async function runCcLoad(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const clients = await prisma.serviceClient.findMany({
    where: {
      AND: [
        visible,
        { pipelineStatus: 'LIVE' },
        { caseCoordinatorUserId: { not: null } },
      ],
    },
    select: {
      stage: true,
      caseCoordinatorUserId: true,
      caseCoordinatorUser: { select: { name: true, email: true } },
      caseCoordinatorName: true,
    },
  })

  type Bucket = {
    name: string
    total: number
    upcoming: number
    ready: number
  }
  const byCc = new Map<string, Bucket>()

  for (const c of clients) {
    const id = c.caseCoordinatorUserId!
    const bucket = byCc.get(id) ?? {
      name:
        userDisplayName(c.caseCoordinatorUser) !== '—'
          ? userDisplayName(c.caseCoordinatorUser)
          : c.caseCoordinatorName?.trim() || 'Unknown',
      total: 0,
      upcoming: 0,
      ready: 0,
    }
    bucket.total += 1
    if (isReadyForCoordination(c.stage)) bucket.ready += 1
    else bucket.upcoming += 1
    byCc.set(id, bucket)
  }

  const rows = [...byCc.entries()]
    .map(([userId, b]) => ({
      caseCoordinatorUserId: userId,
      caseCoordinator: b.name,
      total: b.total,
      upcoming: b.upcoming,
      ready: b.ready,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    key: 'cc-load',
    title: 'Case Coordinator Load',
    description:
      'Assigned LIVE clients per case coordinator, split into Upcoming vs Ready (RBT assigned and later).',
    summary: `${rows.length} coordinator${rows.length === 1 ? '' : 's'} · ${clients.length} assigned clients`,
    refreshedAt: new Date().toISOString(),
    columns: [
      { key: 'caseCoordinator', header: 'Case coordinator' },
      { key: 'total', header: 'Total' },
      { key: 'upcoming', header: 'Upcoming' },
      { key: 'ready', header: 'Ready' },
    ],
    rows,
    meta: { coordinatorCount: rows.length, assignedTotal: clients.length },
  }
}

// ─── 9. Email Activity ──────────────────────────────────────────────────────

export async function runEmailActivity(
  user: AccessCrmUser,
  filters?: EmailActivityFilters
): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const now = new Date()
  const range = resolveEmailRange(filters, now)

  const where: Prisma.ClientCommunicationWhereInput = {
    deletedAt: null,
    channel: 'EMAIL',
    direction: 'OUTBOUND',
    sentAt: { gte: range.from, lt: range.to },
    serviceClient: visible,
    ...(filters?.senderUserId
      ? { sentByUserId: filters.senderUserId }
      : {}),
    ...(filters?.template ? { template: filters.template } : {}),
    ...(filters?.clientId ? { serviceClientId: filters.clientId } : {}),
  }

  const rowsRaw = await prisma.clientCommunication.findMany({
    where,
    select: {
      id: true,
      sentAt: true,
      template: true,
      subject: true,
      status: true,
      sentByUser: { select: { name: true, email: true } },
      serviceClient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientCode: true,
          stage: true,
          parentEmail: true,
        },
      },
    },
    orderBy: { sentAt: 'desc' },
    take: 2000,
  })

  const rows = rowsRaw.map((r) => ({
    communicationId: r.id,
    date: r.sentAt.toISOString(),
    dateDisplay: isoDate(r.sentAt),
    sender: userDisplayName(r.sentByUser),
    recipient: r.serviceClient.parentEmail?.trim() || '—',
    template: staffTemplateLabel(r.template),
    templateKey: r.template,
    clientId: r.serviceClient.id,
    client: clientLabel(
      r.serviceClient.firstName,
      r.serviceClient.lastName,
      r.serviceClient.clientCode
    ),
    stageAtSend: STAGE_LABELS[r.serviceClient.stage],
    stageKey: r.serviceClient.stage,
    subject: r.subject,
    status: r.status,
  }))

  return {
    key: 'email-activity',
    title: 'Email Activity',
    description:
      'Outbound client-facing emails from the CRM email tab. Filter by sender, template, date range, or client. Powers the Weekly Summary digest.',
    summary: `${rows.length} email${rows.length === 1 ? '' : 's'} · ${range.label} (${isoDate(range.from)} → ${isoDate(range.to)})`,
    refreshedAt: now.toISOString(),
    columns: [
      { key: 'dateDisplay', header: 'Date' },
      { key: 'sender', header: 'Sender' },
      { key: 'recipient', header: 'Recipient' },
      { key: 'template', header: 'Template' },
      { key: 'client', header: 'Client' },
      { key: 'stageAtSend', header: 'Stage' },
      { key: 'status', header: 'Status' },
    ],
    rows,
    meta: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      rangeLabel: range.label,
      sentCount: rows.length,
    },
    gaps: [
      'Stage at send is not stored on client_communications; the Stage column shows the client’s current stage.',
      'Recipient is taken from the client parent email at report time, not a frozen send-time address.',
    ],
  }
}

// ─── 10. New Intakes ────────────────────────────────────────────────────────

async function runNewIntakes(user: AccessCrmUser): Promise<ReportResult> {
  const visible = visibleWhere(user)
  const now = new Date()
  const weekStart = startOfWeekMonday(now)

  const clients = await prisma.serviceClient.findMany({
    where: {
      AND: [visible, { createdAt: { gte: weekStart, lte: now } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clientCode: true,
      stage: true,
      createdAt: true,
      insuranceProvider: true,
      requirements: {
        where: { deletedAt: null },
        select: {
          key: true,
          status: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = clients.map((c) => {
    const reqByKey = new Map(c.requirements.map((r) => [r.key, r]))
    const requiredKeys = CANONICAL_DOCUMENT_KEYS.filter((key) => {
      const doc = DOCUMENT_BY_KEY[key]
      if (!doc) return false
      return isDocumentRequired(doc, c.insuranceProvider)
    })
    const denom = requiredKeys.length || CANONICAL_DOCUMENT_KEYS.length
    const keys = requiredKeys.length ? requiredKeys : [...CANONICAL_DOCUMENT_KEYS]
    let complete = 0
    for (const key of keys) {
      const r = reqByKey.get(key)
      if (
        r &&
        requirementStatusSatisfies(r.key, r.status, r.expiresAt, now)
      ) {
        complete += 1
      }
    }
    const docsCompletePct =
      denom === 0 ? null : Math.round((complete / denom) * 1000) / 10

    return {
      clientId: c.id,
      client: clientLabel(c.firstName, c.lastName, c.clientCode),
      stage: STAGE_LABELS[c.stage],
      stageKey: c.stage,
      createdAt: isoDate(c.createdAt),
      docsComplete: `${complete}/${denom}`,
      docsCompletePct,
    }
  })

  const avgPct = median(
    rows
      .map((r) => r.docsCompletePct)
      .filter((n): n is number => typeof n === 'number')
  )

  return {
    key: 'new-intakes',
    title: 'New Intakes This Week',
    description:
      'Clients created week-to-date (Monday start), with intake document completeness so new families do not slip.',
    summary: `${rows.length} new intake${rows.length === 1 ? '' : 's'} this week${
      avgPct == null ? '' : ` · median docs ${avgPct}%`
    }`,
    refreshedAt: now.toISOString(),
    columns: [
      { key: 'client', header: 'Client' },
      { key: 'stage', header: 'Stage' },
      { key: 'createdAt', header: 'Created' },
      { key: 'docsComplete', header: 'Docs complete' },
      { key: 'docsCompletePct', header: 'Docs %' },
    ],
    rows,
    meta: {
      weekStart: weekStart.toISOString(),
      count: rows.length,
      medianDocsCompletePct: avgPct,
    },
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: 'pipeline-health',
    title: 'Pipeline Health',
    description:
      'Visible LIVE clients by pipeline stage, with median days in stage and stall flags.',
    run: runPipelineHealth,
  },
  {
    key: 'unstaffed-active',
    title: 'Unstaffed Active Clients',
    description:
      'LIVE clients from Approved through Active with no active RBT schedule assignment.',
    run: runUnstaffedActive,
  },
  {
    key: 'missing-documents',
    title: 'Missing Documents',
    description:
      'Clients with outstanding MISSING / PENDING / EXPIRED requirements that fail the satisfaction gate.',
    run: runMissingDocuments,
  },
  {
    key: 'authorizations-expiring',
    title: 'Authorizations Expiring',
    description:
      'Assessment and treatment authorizations inside the ≤45-day attention window.',
    run: runAuthorizationsExpiring,
  },
  {
    key: 'reassessments-due',
    title: 'Reassessments Due',
    description:
      'Treatment authorizations approaching expiration for reassessment planning.',
    run: runReassessmentsDue,
  },
  {
    key: 'under-approved',
    title: 'Under-Approved Authorizations',
    description:
      'Auth lines where approved units are below requested (or flagged under-approved).',
    run: runUnderApproved,
  },
  {
    key: 'department-queue',
    title: 'Department Queue Load',
    description:
      'LIVE clients by owning department and by active claimant.',
    run: runDepartmentQueue,
  },
  {
    key: 'cc-load',
    title: 'Case Coordinator Load',
    description:
      'Assigned LIVE clients per case coordinator (Upcoming vs Ready).',
    run: runCcLoad,
  },
  {
    key: 'email-activity',
    title: 'Email Activity',
    description:
      'Outbound CRM emails with sender, recipient, template, and client. Supports week-to-date and last-full-week ranges.',
    run: (user) => runEmailActivity(user),
  },
  {
    key: 'new-intakes',
    title: 'New Intakes This Week',
    description:
      'Clients created week-to-date with intake document completeness.',
    run: runNewIntakes,
  },
]

const REPORT_BY_KEY = new Map(
  REPORT_DEFINITIONS.map((d) => [d.key, d] as const)
)

export function getReportDefinition(key: string): ReportDefinition | undefined {
  return REPORT_BY_KEY.get(key)
}

export async function executeReport(
  user: AccessCrmUser,
  key: string,
  emailFilters?: EmailActivityFilters
): Promise<ReportResult> {
  if (key === 'email-activity') {
    const result = await runEmailActivity(user, emailFilters)
    await logOpsReportRun({
      actorUserId: user.id,
      reportKey: key,
      filterJson: emailFilters ?? null,
      rowCount: result.rows.length,
      kind: 'report',
    })
    return result
  }

  const def = getReportDefinition(key)
  if (!def) {
    throw new Error(`Unknown operations report: ${key}`)
  }

  const result = await def.run(user)
  await logOpsReportRun({
    actorUserId: user.id,
    reportKey: key,
    filterJson: emailFilters ?? null,
    rowCount: result.rows.length,
    kind: 'report',
  })
  return result
}
