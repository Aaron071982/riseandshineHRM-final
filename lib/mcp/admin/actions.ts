'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function revokeMcpToken(tokenId: string) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  const updated = await prisma.oAuthAccessToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  if (updated.count === 0) {
    throw new Error('Token not found or already revoked')
  }

  revalidatePath('/admin/mcp-connections')
}

export async function revokeAllMcpTokens() {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  await prisma.oAuthAccessToken.updateMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  })

  revalidatePath('/admin/mcp-connections')
}

export async function setCanReadClientDocuments(userId: string, enabled: boolean) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: userId },
    data: { canReadClientDocuments: enabled },
  })

  revalidatePath('/admin/mcp-connections')
  revalidatePath('/admin/mcp-document-access')
}
