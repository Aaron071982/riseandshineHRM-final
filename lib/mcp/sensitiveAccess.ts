import 'server-only'

import type { SensitiveAccessAction, SensitiveAccessCategory, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import { requireMcpAuthContext } from '@/lib/mcp/context'

const VOLUME_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_PAY_READS_PER_HOUR = 40
const DEFAULT_DISTINCT_STAFF = 25

export async function logSensitiveAccess(input: {
  userId?: string | null
  category: SensitiveAccessCategory
  action: SensitiveAccessAction
  toolName: string
  subjectType?: string | null
  subjectId?: string | null
  subjectLabel?: string | null
  dateRangeFrom?: Date | null
  dateRangeTo?: Date | null
  reason?: string | null
  resultSummary?: Record<string, unknown> | null
}): Promise<void> {
  const auth = (() => {
    try {
      return requireMcpAuthContext()
    } catch {
      return null
    }
  })()

  const userId = input.userId || auth?.userId || (await getMcpSystemUserId())

  await prisma.sensitiveAccessLog.create({
    data: {
      userId,
      category: input.category,
      action: input.action,
      toolName: input.toolName,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      subjectLabel: input.subjectLabel ?? null,
      dateRangeFrom: input.dateRangeFrom ?? null,
      dateRangeTo: input.dateRangeTo ?? null,
      oauthClientId: auth?.clientId ?? null,
      tokenHashPrefix: auth?.tokenHash?.slice(0, 8) ?? null,
      ip: auth?.requestIp ?? null,
      reason: input.reason ?? null,
      resultSummary: (input.resultSummary ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })

  if (input.action === 'BLOCKED_UNAUTHORIZED' || input.action === 'BLOCKED_SCOPE') {
    await notifyAdmins({
      kind: 'blocked',
      message: `MCP sensitive access blocked (${input.action}): tool=${input.toolName} category=${input.category} actor=${userId}`,
    })
  } else if (input.category === 'PAY' || input.category === 'PAYROLL') {
    await maybeNotifyPayVolume(userId)
  }
}

async function notifyAdmins(input: { kind: 'blocked' | 'volume'; message: string }) {
  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ isMcpSuperAdmin: true }, { role: 'ADMIN' }],
    },
    select: { id: true },
    take: 20,
  })
  if (admins.length === 0) return

  await prisma.adminNotification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: 'MCP_SENSITIVE_ACCESS',
      message: input.message,
      linkUrl: '/admin/mcp-sensitive-access',
    })),
  })
}

async function maybeNotifyPayVolume(userId: string) {
  const readsPerHour =
    Number(process.env.MCP_PAY_ALERT_READS_PER_HOUR) || DEFAULT_PAY_READS_PER_HOUR
  const distinctStaff =
    Number(process.env.MCP_PAY_ALERT_DISTINCT_STAFF) || DEFAULT_DISTINCT_STAFF
  const since = new Date(Date.now() - VOLUME_WINDOW_MS)

  const recent = await prisma.sensitiveAccessLog.findMany({
    where: {
      createdAt: { gte: since },
      action: 'READ',
      category: { in: ['PAY', 'PAYROLL', 'WORKED_SESSIONS'] },
    },
    select: { subjectId: true },
  })

  const subjects = new Set(
    recent.map((r) => r.subjectId).filter((id): id is string => Boolean(id))
  )

  if (recent.length === readsPerHour + 1 || subjects.size === distinctStaff + 1) {
    await notifyAdmins({
      kind: 'volume',
      message: `MCP pay/comp volume alert: ${recent.length} reads / ${subjects.size} subjects in 1h (thresholds ${readsPerHour}/${distinctStaff}) actor=${userId}`,
    })
  }
}
