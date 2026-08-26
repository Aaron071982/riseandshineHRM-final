import { writeAuditLog } from '@/lib/audit'
import { logClientAccess } from '@/lib/client-services/audit'

/** Audit every report / saved-query run (actor, key, filters, row count). */
export async function logOpsReportRun(opts: {
  actorUserId: string
  reportKey: string
  filterJson?: unknown
  rowCount: number
  kind?: 'report' | 'query' | 'overview' | 'weekly_preview'
}): Promise<void> {
  const kind = opts.kind ?? 'report'
  const payload = {
    kind,
    reportKey: opts.reportKey,
    filterJson: opts.filterJson ?? null,
    rowCount: opts.rowCount,
    at: new Date().toISOString(),
  }

  await Promise.all([
    logClientAccess({
      userId: opts.actorUserId,
      action: `OPS_${kind.toUpperCase()}_RUN:${opts.reportKey}:${opts.rowCount}`,
    }),
    writeAuditLog({
      actorUserId: opts.actorUserId,
      entityType: 'CrmOpsReport',
      entityId: opts.reportKey,
      action: 'UPDATE',
      after: payload,
    }),
  ])
}
