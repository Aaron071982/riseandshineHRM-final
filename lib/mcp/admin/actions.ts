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

export async function setMcpSuperAdmin(userId: string, enabled: boolean) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: userId },
    data: { isMcpSuperAdmin: enabled },
  })

  revalidatePath('/admin/mcp-connections')
  revalidatePath('/admin/mcp-sensitive-access')
}

export async function setCanBulkImportSchedule(userId: string, enabled: boolean) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: userId },
    data: { canBulkImportSchedule: enabled },
  })

  revalidatePath('/admin/mcp-connections')
}

export async function setCanBulkImportScheduleByEmail(
  email: string,
  enabled: boolean
) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')

  const normalized = email.trim().toLowerCase()
  if (!normalized) throw new Error('Email is required')

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  })
  if (!user) throw new Error(`No active user with email ${normalized}`)

  await prisma.user.update({
    where: { id: user.id },
    data: { canBulkImportSchedule: enabled },
  })

  revalidatePath('/admin/mcp-connections')
}

export async function approveScheduleBulkImportBatch(batchId: string) {
  const auth = await requireAdminSession()
  if (auth.response) throw new Error('Unauthorized')
  const admin = auth.user
  if (!admin) throw new Error('Unauthorized')

  const { approveBulkImportBatch } = await import('@/lib/schedule/bulkImport')
  await approveBulkImportBatch({ adminUserId: admin.id, batchId })
  revalidatePath('/admin/mcp-connections')
}
