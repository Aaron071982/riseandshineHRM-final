import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'

export async function logOAuthEvent(
  action: string,
  metadata: Record<string, unknown>,
  userId?: string
): Promise<void> {
  try {
    const actorId = userId ?? (await getMcpSystemUserId())
    await prisma.activityLog.create({
      data: {
        userId: actorId,
        activityType: 'FORM_SUBMISSION',
        action,
        resourceType: 'MCP_OAUTH',
        resourceId: typeof metadata.clientId === 'string' ? metadata.clientId : null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[oauth-audit]', err)
  }
}
