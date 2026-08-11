import { prisma } from '@/lib/prisma'

/** Append a system note to the client activity timeline. */
export async function addClientTimelineNote(params: {
  serviceClientId: string
  authorId: string
  content: string
}): Promise<void> {
  try {
    await prisma.serviceClientNote.create({
      data: {
        serviceClientId: params.serviceClientId,
        authorId: params.authorId,
        content: params.content,
      },
    })
  } catch (err) {
    console.error('[client-services] timeline note failed', err)
  }
}

export async function recordStatusChange(params: {
  serviceClientId: string
  fromStatus: string | null
  toStatus: string
  changedBy: string
  reason?: string | null
}): Promise<void> {
  try {
    await prisma.serviceClientStatusHistory.create({
      data: {
        serviceClientId: params.serviceClientId,
        fromStatus: params.fromStatus as never,
        toStatus: params.toStatus as never,
        changedBy: params.changedBy,
        reason: params.reason ?? null,
      },
    })
    await addClientTimelineNote({
      serviceClientId: params.serviceClientId,
      authorId: params.changedBy,
      content: `[Status] ${params.fromStatus ?? '—'} → ${params.toStatus}${
        params.reason ? ` — ${params.reason}` : ''
      }`,
    })
  } catch (err) {
    console.error('[client-services] status history failed', err)
  }
}
