import { prisma } from '@/lib/prisma'

export async function loadMcpActivityLogs(input: {
  tool?: string
  from?: Date
  to?: Date
  phiOnly?: boolean
  limit?: number
}) {
  const where: {
    activityType: 'MCP_TOOL_CALL'
    action?: string
    resourceType?: string
    createdAt?: { gte?: Date; lte?: Date }
  } = {
    activityType: 'MCP_TOOL_CALL',
  }

  if (input.tool?.trim()) {
    where.action = input.tool.trim()
  }
  if (input.phiOnly) {
    where.resourceType = 'MCP_PHI'
  }
  if (input.from || input.to) {
    where.createdAt = {}
    if (input.from) where.createdAt.gte = input.from
    if (input.to) where.createdAt.lte = input.to
  }

  return prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 100,
    select: {
      id: true,
      action: true,
      resourceType: true,
      resourceId: true,
      metadata: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })
}

export async function loadMcpConnections() {
  const now = new Date()
  const [clients, tokens] = await Promise.all([
    prisma.oAuthClient.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientName: true, createdAt: true },
    }),
    prisma.oAuthAccessToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { clientName: true } },
      },
    }),
  ])

  return { clients, tokens }
}

export async function loadDocumentReadAllowlistUsers() {
  return prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { email: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      canReadClientDocuments: true,
      isMcpSuperAdmin: true,
      crmRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  })
}

export async function loadDocumentAccessLogs(input: {
  action?: string
  documentType?: string
  days?: number
  limit?: number
}) {
  const from = new Date()
  from.setDate(from.getDate() - (input.days ?? 7))

  return prisma.documentAccessLog.findMany({
    where: {
      createdAt: { gte: from },
      ...(input.action
        ? { action: input.action as 'LINK_ISSUED' | 'TEXT_RETURNED' | 'BLOCKED_TYPE' | 'BLOCKED_UNAUTHORIZED' }
        : {}),
      ...(input.documentType?.trim()
        ? { documentType: { equals: input.documentType.trim(), mode: 'insensitive' } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 200,
    include: {
      user: { select: { name: true, email: true } },
      serviceClient: { select: { clientCode: true, firstName: true, lastName: true } },
    },
  })
}

export async function loadSensitiveAccessLogs(input: {
  category?: string
  action?: string
  days?: number
  limit?: number
}) {
  const from = new Date()
  from.setDate(from.getDate() - (input.days ?? 7))

  return prisma.sensitiveAccessLog.findMany({
    where: {
      createdAt: { gte: from },
      ...(input.category
        ? {
            category: input.category as
              | 'PAY'
              | 'WORKED_SESSIONS'
              | 'PAYROLL'
              | 'DOCUMENT'
              | 'OTHER',
          }
        : {}),
      ...(input.action
        ? {
            action: input.action as
              | 'READ'
              | 'BLOCKED_UNAUTHORIZED'
              | 'BLOCKED_SCOPE',
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 300,
    include: {
      user: { select: { name: true, email: true } },
    },
  })
}
