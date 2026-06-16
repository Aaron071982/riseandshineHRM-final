import { prisma } from '@/lib/prisma'

const MCP_SYSTEM_USER_EMAIL = 'mcp-connector@riseandshine.local'

let cachedUserId: string | null = null

export async function getMcpSystemUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId

  const existing = await prisma.user.findUnique({
    where: { email: MCP_SYSTEM_USER_EMAIL },
    select: { id: true },
  })
  if (existing) {
    cachedUserId = existing.id
    return existing.id
  }

  const created = await prisma.user.create({
    data: {
      email: MCP_SYSTEM_USER_EMAIL,
      name: 'MCP Connector',
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true },
  })
  cachedUserId = created.id
  return created.id
}
