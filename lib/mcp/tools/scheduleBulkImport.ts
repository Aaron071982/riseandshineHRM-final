import 'server-only'

import { requireMcpAuthContext } from '@/lib/mcp/context'
import { jsonToolResult } from '@/lib/mcp/format'
import type { ToolResult } from '@/lib/mcp/types'
import { prisma } from '@/lib/prisma'
import {
  BULK_IMPORT_IDENTITY_REQUIRED_MESSAGE,
  BULK_IMPORT_UNAUTHORIZED_MESSAGE,
  userCanBulkImportSchedule,
} from '@/lib/mcp/scheduleBulkImportAllowlist'
import {
  commitScheduleBulkImport,
  loadCrmUserForBulkImport,
  previewScheduleBulkImport,
  rollbackScheduleBulkImport,
  type BulkImportEntryInput,
} from '@/lib/schedule/bulkImport'

async function requireBulkImportActor() {
  const auth = requireMcpAuthContext()
  if (auth.method !== 'oauth' || !auth.userId) {
    throw new Error(BULK_IMPORT_IDENTITY_REQUIRED_MESSAGE)
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      canBulkImportSchedule: true,
      isActive: true,
    },
  })
  if (!user?.isActive) {
    throw new Error(BULK_IMPORT_IDENTITY_REQUIRED_MESSAGE)
  }
  if (!userCanBulkImportSchedule(user)) {
    throw new Error(BULK_IMPORT_UNAUTHORIZED_MESSAGE)
  }
  const actor = await loadCrmUserForBulkImport(user.id)
  if (!actor) throw new Error(BULK_IMPORT_IDENTITY_REQUIRED_MESSAGE)
  return actor
}

function parseEntries(raw: unknown): BulkImportEntryInput[] {
  if (!Array.isArray(raw)) {
    throw new Error('entries must be an array')
  }
  return raw.map((row, i) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`entries[${i}] must be an object`)
    }
    const r = row as Record<string, unknown>
    return {
      client: String(r.client ?? ''),
      therapist: String(r.therapist ?? r.rbt ?? ''),
      service: typeof r.service === 'string' ? r.service : typeof r.cpt === 'string' ? r.cpt : null,
      dayOrDate:
        typeof r.dayOrDate === 'number' || typeof r.dayOrDate === 'string'
          ? r.dayOrDate
          : typeof r.day === 'number' || typeof r.day === 'string'
            ? r.day
            : typeof r.date === 'string'
              ? r.date
              : '',
      start: String(r.start ?? r.startTime ?? ''),
      end: String(r.end ?? r.endTime ?? ''),
      location: typeof r.location === 'string' ? r.location : null,
    }
  })
}

export async function previewScheduleImportTool(args: {
  entries?: unknown
}): Promise<ToolResult> {
  const actor = await requireBulkImportActor()
  const entries = parseEntries(args.entries)
  const result = await previewScheduleBulkImport({ actor, entries })

  const conflictSample = result.rows
    .filter((r) => r.status !== 'ok')
    .slice(0, 25)
    .map((r) => ({
      index: r.index,
      status: r.status,
      reasons: r.reasons,
      client: r.resolved?.clientCode,
      therapist: r.resolved?.therapistName,
    }))

  return jsonToolResult(
    `Schedule import preview: ${result.summary.ok} ok / ${result.summary.conflict} conflict / ${result.summary.error} error across ${result.summary.distinctClients} clients. previewToken=${result.previewToken}. No writes performed.`,
    {
      previewToken: result.previewToken,
      batchId: result.batchId,
      expiresAt: result.expiresAt,
      requiresAdminApproval: result.requiresAdminApproval,
      summary: result.summary,
      nonOkSample: conflictSample,
      hint: 'Review conflicts, then call commit_schedule_import with the same previewToken and confirm:true. Only ok rows are written.',
    },
    {
      previewToken: result.previewToken,
      batchId: result.batchId,
      ...result.summary,
    }
  )
}

export async function commitScheduleImportTool(args: {
  previewToken?: string
  confirm?: boolean
}): Promise<ToolResult> {
  const actor = await requireBulkImportActor()
  const result = await commitScheduleBulkImport({
    actor,
    previewToken: String(args.previewToken ?? ''),
    confirm: args.confirm === true,
  })

  if (result.status === 'awaiting_admin_approval') {
    return jsonToolResult(
      result.message,
      result,
      { batchId: result.batchId, awaitingAdmin: true }
    )
  }

  return jsonToolResult(
    `Committed batch ${result.batchId}: created ${result.created}, updated ${result.updated}, skipped ${result.skipped}. Use rollback_schedule_import if needed, then ask an admin to revoke schedule:bulk_import.`,
    result,
    {
      batchId: result.batchId,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    }
  )
}

export async function rollbackScheduleImportTool(args: {
  batchId?: string
}): Promise<ToolResult> {
  const actor = await requireBulkImportActor()
  const result = await rollbackScheduleBulkImport({
    actor,
    batchId: String(args.batchId ?? ''),
  })
  return jsonToolResult(
    `Rolled back batch ${result.batchId}: soft-deleted ${result.rolledBack} assignment(s).`,
    result,
    result
  )
}
