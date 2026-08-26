'use server'

import { revalidatePath } from 'next/cache'
import type { CommTemplate, CrmRole, SavedQueryShareScope } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CrmAccessError,
  getClientServicesUser,
  getVisibleClientsWhere,
  isFullAccess,
  getUserCrmRoles,
  rethrowIfNextControlFlow,
} from '@/lib/crm/access'
import { canAccessOperations } from '@/lib/operations/access'
import { logOpsReportRun } from '@/lib/operations/audit'
import { rowsToCsv } from '@/lib/operations/csv'
import {
  REPORT_DEFINITIONS,
  executeReport,
  getReportDefinition,
  type EmailActivityFilters,
  type ReportResult,
} from '@/lib/operations/reports'
import { loadOpsOverview, type OpsOverviewData } from '@/lib/operations/overview'
import {
  filterTreeToWhere,
  QUERY_FILTER_FIELDS,
  type QueryFilterGroup,
} from '@/lib/operations/queryBuilder'
import { buildWeeklyEmailSummaryPayload } from '@/lib/operations/weeklySummary'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { writeAuditLog } from '@/lib/audit'

export type OpsActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number }

function fail(err: unknown): OpsActionResult<never> {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[operations]', err)
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Something went wrong',
    status: 500,
  }
}

async function requireOpsUser() {
  const user = await getClientServicesUser()
  if (!canAccessOperations(user)) {
    throw new CrmAccessError('Operations access required', 403)
  }
  return user
}

export async function listOperationsReports(): Promise<
  OpsActionResult<{ reports: { key: string; title: string; description: string }[] }>
> {
  try {
    await requireOpsUser()
    return {
      ok: true,
      reports: REPORT_DEFINITIONS.map((r) => ({
        key: r.key,
        title: r.title,
        description: r.description,
      })),
    }
  } catch (err) {
    return fail(err)
  }
}

export async function runOperationsReport(
  key: string,
  emailFilters?: EmailActivityFilters
): Promise<OpsActionResult<{ report: ReportResult }>> {
  try {
    const user = await requireOpsUser()
    if (!getReportDefinition(key) && key !== 'email-activity') {
      return { ok: false, error: 'Unknown report', status: 404 }
    }
    const report = await executeReport(user, key, emailFilters)
    return { ok: true, report }
  } catch (err) {
    return fail(err)
  }
}

export async function exportOperationsReportCsv(
  key: string,
  emailFilters?: EmailActivityFilters
): Promise<OpsActionResult<{ csv: string; fileName: string }>> {
  try {
    const user = await requireOpsUser()
    const report = await executeReport(user, key, emailFilters)
    const csv = rowsToCsv(report.columns, report.rows)
    return {
      ok: true,
      csv,
      fileName: `${report.key}-${new Date().toISOString().slice(0, 10)}.csv`,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function loadOperationsOverview(): Promise<
  OpsActionResult<{ overview: OpsOverviewData }>
> {
  try {
    const user = await requireOpsUser()
    const overview = await loadOpsOverview(user)
    return { ok: true, overview }
  } catch (err) {
    return fail(err)
  }
}

export async function previewWeeklySummaryEmail(): Promise<
  OpsActionResult<{
    subject: string
    html: string
    weekRange: string
    sentCount: number
  }>
> {
  try {
    const user = await requireOpsUser()
    const payload = await buildWeeklyEmailSummaryPayload(user, [
      user.email ?? 'ops@riseandshineaba.com',
    ])
    return {
      ok: true,
      subject: payload.subject,
      html: payload.html,
      weekRange: payload.weekRange,
      sentCount: payload.sentCount,
    }
  } catch (err) {
    return fail(err)
  }
}

const QUERY_RESULT_COLUMNS = [
  { key: 'client', header: 'Client' },
  { key: 'clientCode', header: 'Code' },
  { key: 'stage', header: 'Stage' },
  { key: 'pipelineStatus', header: 'Pipeline' },
  { key: 'dept', header: 'Owner dept' },
  { key: 'caseCoordinator', header: 'CC' },
  { key: 'borough', header: 'Borough' },
  { key: 'city', header: 'City' },
  { key: 'payer', header: 'Payer' },
  { key: 'daysInStage', header: 'Days in stage' },
  { key: 'hasRbt', header: 'Has RBT schedule' },
] as const

export async function runOperationsQuery(input: {
  filter: unknown
  columns?: string[]
}): Promise<
  OpsActionResult<{
    columns: { key: string; header: string }[]
    rows: Record<string, string | number | null>[]
    count: number
    rejectedField?: string
  }>
> {
  try {
    const user = await requireOpsUser()
    const translated = filterTreeToWhere(input.filter)
    if (!translated.ok) {
      return {
        ok: false,
        error: translated.error.message,
        status: translated.error.code === 'UNKNOWN_FIELD' ? 400 : 422,
      }
    }

    const where = {
      AND: [getVisibleClientsWhere(user), translated.where],
    }

    const clients = await prisma.serviceClient.findMany({
      where,
      take: 500,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        firstName: true,
        lastName: true,
        clientCode: true,
        stage: true,
        pipelineStatus: true,
        currentOwnerDept: true,
        borough: true,
        city: true,
        insuranceProvider: true,
        stageEnteredAt: true,
        caseCoordinatorUser: { select: { name: true, email: true } },
        caseCoordinatorName: true,
        scheduleAssignments: {
          where: { deletedAt: null, isActive: true },
          select: { id: true },
          take: 1,
        },
      },
    })

    const wanted = new Set(
      input.columns?.length
        ? input.columns
        : QUERY_RESULT_COLUMNS.map((c) => c.key)
    )
    const columns = QUERY_RESULT_COLUMNS.filter((c) => wanted.has(c.key)).map(
      (c) => ({ key: c.key, header: c.header })
    )

    const rows = clients.map((c) => {
      const days = c.stageEnteredAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - c.stageEnteredAt.getTime()) / (24 * 60 * 60 * 1000)
            )
          )
        : 0
      const full: Record<string, string | number | null> = {
        client: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        stage: STAGE_LABELS[c.stage],
        pipelineStatus: c.pipelineStatus,
        dept: c.currentOwnerDept ?? '—',
        caseCoordinator:
          c.caseCoordinatorUser?.name ||
          c.caseCoordinatorUser?.email ||
          c.caseCoordinatorName ||
          '—',
        borough: c.borough ?? '—',
        city: c.city ?? '—',
        payer: c.insuranceProvider ?? '—',
        daysInStage: days,
        hasRbt: c.scheduleAssignments.length ? 'Yes' : 'No',
      }
      const out: Record<string, string | number | null> = {}
      for (const col of columns) out[col.key] = full[col.key] ?? null
      return out
    })

    await logOpsReportRun({
      actorUserId: user.id,
      reportKey: 'query-builder',
      filterJson: input.filter,
      rowCount: rows.length,
      kind: 'query',
    })

    return { ok: true, columns, rows, count: rows.length }
  } catch (err) {
    return fail(err)
  }
}

export async function exportOperationsQueryCsv(input: {
  filter: unknown
  columns?: string[]
}): Promise<OpsActionResult<{ csv: string; fileName: string }>> {
  const res = await runOperationsQuery(input)
  if (!res.ok) return res
  return {
    ok: true,
    csv: rowsToCsv(res.columns, res.rows),
    fileName: `ops-query-${new Date().toISOString().slice(0, 10)}.csv`,
  }
}

export async function listSavedQueries(): Promise<
  OpsActionResult<{
    queries: {
      id: string
      name: string
      description: string | null
      shareScope: SavedQueryShareScope
      sharedWithRole: CrmRole | null
      isOwner: boolean
      updatedAt: string
    }[]
  }>
> {
  try {
    const user = await requireOpsUser()
    const roles = getUserCrmRoles(user)
    const full = isFullAccess(user)

    const queries = await prisma.savedQuery.findMany({
      where: {
        OR: [
          { ownerUserId: user.id },
          ...(full ? [{ shareScope: 'FULL_ACCESS' as const }] : []),
          ...(roles.length
            ? [
                {
                  shareScope: 'ROLE' as const,
                  sharedWithRole: { in: roles },
                },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        shareScope: true,
        sharedWithRole: true,
        ownerUserId: true,
        updatedAt: true,
      },
    })

    return {
      ok: true,
      queries: queries.map((q) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        shareScope: q.shareScope,
        sharedWithRole: q.sharedWithRole,
        isOwner: q.ownerUserId === user.id,
        updatedAt: q.updatedAt.toISOString(),
      })),
    }
  } catch (err) {
    return fail(err)
  }
}

export async function saveOperationsQuery(input: {
  id?: string
  name: string
  description?: string
  filter: unknown
  columns?: string[]
  shareScope?: SavedQueryShareScope
  sharedWithRole?: CrmRole | null
}): Promise<OpsActionResult<{ id: string }>> {
  try {
    const user = await requireOpsUser()
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'Name is required', status: 400 }

    const translated = filterTreeToWhere(input.filter)
    if (!translated.ok) {
      return { ok: false, error: translated.error.message, status: 400 }
    }

    const shareScope = input.shareScope ?? 'PRIVATE'
    const sharedWithRole =
      shareScope === 'ROLE' ? input.sharedWithRole ?? null : null
    if (shareScope === 'ROLE' && !sharedWithRole) {
      return {
        ok: false,
        error: 'sharedWithRole required when shareScope is ROLE',
        status: 400,
      }
    }

    if (input.id) {
      const existing = await prisma.savedQuery.findFirst({
        where: { id: input.id, ownerUserId: user.id },
      })
      if (!existing) {
        return { ok: false, error: 'Saved query not found', status: 404 }
      }
      await prisma.savedQuery.update({
        where: { id: existing.id },
        data: {
          name,
          description: input.description?.trim() || null,
          filterJson: input.filter as Prisma.InputJsonValue,
          columnsJson:
            input.columns == null
              ? Prisma.JsonNull
              : (input.columns as Prisma.InputJsonValue),
          shareScope,
          sharedWithRole,
        },
      })
      await writeAuditLog({
        actorUserId: user.id,
        entityType: 'SavedQuery',
        entityId: existing.id,
        action: 'UPDATE',
        after: { name, shareScope },
      })
      revalidatePath('/client-services/operations/query')
      return { ok: true, id: existing.id }
    }

    const created = await prisma.savedQuery.create({
      data: {
        ownerUserId: user.id,
        name,
        description: input.description?.trim() || null,
        filterJson: input.filter as Prisma.InputJsonValue,
        columnsJson:
          input.columns == null
            ? Prisma.JsonNull
            : (input.columns as Prisma.InputJsonValue),
        shareScope,
        sharedWithRole,
      },
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'SavedQuery',
      entityId: created.id,
      action: 'CREATE',
      after: { name, shareScope },
    })
    revalidatePath('/client-services/operations/query')
    return { ok: true, id: created.id }
  } catch (err) {
    return fail(err)
  }
}

export async function loadSavedQuery(
  id: string
): Promise<
  OpsActionResult<{
    id: string
    name: string
    description: string | null
    filter: unknown
    columns: string[] | null
    shareScope: SavedQueryShareScope
    sharedWithRole: CrmRole | null
  }>
> {
  try {
    const user = await requireOpsUser()
    const roles = getUserCrmRoles(user)
    const full = isFullAccess(user)
    const q = await prisma.savedQuery.findUnique({ where: { id } })
    if (!q) return { ok: false, error: 'Not found', status: 404 }

    const allowed =
      q.ownerUserId === user.id ||
      (q.shareScope === 'FULL_ACCESS' && full) ||
      (q.shareScope === 'ROLE' &&
        q.sharedWithRole &&
        roles.includes(q.sharedWithRole))
    if (!allowed) {
      return { ok: false, error: 'Forbidden', status: 403 }
    }

    return {
      ok: true,
      id: q.id,
      name: q.name,
      description: q.description,
      filter: q.filterJson,
      columns: Array.isArray(q.columnsJson)
        ? (q.columnsJson as string[])
        : null,
      shareScope: q.shareScope,
      sharedWithRole: q.sharedWithRole,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteSavedQuery(
  id: string
): Promise<OpsActionResult<{ deleted: true }>> {
  try {
    const user = await requireOpsUser()
    const existing = await prisma.savedQuery.findFirst({
      where: { id, ownerUserId: user.id },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }
    await prisma.savedQuery.delete({ where: { id } })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'SavedQuery',
      entityId: id,
      action: 'DELETE',
    })
    revalidatePath('/client-services/operations/query')
    return { ok: true, deleted: true }
  } catch (err) {
    return fail(err)
  }
}

export function getQueryFilterFieldWhitelist(): string[] {
  return [...QUERY_FILTER_FIELDS]
}

export type { QueryFilterGroup, CommTemplate }
