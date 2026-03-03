import { prisma } from '@/lib/prisma'

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE'

interface AuditLogOptions {
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: AuditActionType
  before?: unknown
  after?: unknown
}

export async function writeAuditLog(opts: AuditLogOptions) {
  const { actorUserId, entityType, entityId, action, before, after } = opts

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        entityType,
        entityId,
        action,
        diff: { before, after },
      },
    })
  } catch (error) {
    // Audit logging must never break primary flows; log and continue.
    console.error('[audit] Failed to write audit log', {
      error,
      entityType,
      entityId,
      action,
    })
  }
}

