import { prisma } from '@/lib/prisma'

export async function logClientAccess(params: {
  userId: string
  serviceClientId?: string | null
  action: string
  ip?: string | null
}): Promise<void> {
  try {
    await prisma.clientAccessLog.create({
      data: {
        userId: params.userId,
        serviceClientId: params.serviceClientId ?? null,
        action: params.action,
        ip: params.ip ?? null,
      },
    })
  } catch (err) {
    console.error('[client-services] audit log failed', err)
  }
}
