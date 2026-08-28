import type { ClientOwnerDept, Prisma, TeamTaskPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type EffectiveNotificationPrefs = {
  assignmentEmails: boolean
  digestEnabled: boolean
  digestFrequencyNights: number
}

export async function getEffectiveNotificationPrefs(
  userId: string
): Promise<EffectiveNotificationPrefs> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: {
      assignmentEmails: true,
      digestEnabled: true,
      digestFrequencyNights: true,
    },
  })
  return {
    assignmentEmails: row?.assignmentEmails ?? true,
    digestEnabled: row?.digestEnabled ?? true,
    digestFrequencyNights: row?.digestFrequencyNights ?? 2,
  }
}

export async function getLastDigestSentAt(userId: string): Promise<Date | null> {
  const row = await prisma.taskNotificationLog.findFirst({
    where: { userId, type: 'DIGEST' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  return row?.sentAt ?? null
}

export function isDigestDue(
  lastSentAt: Date | null,
  frequencyNights: number,
  now = new Date()
): boolean {
  if (!lastSentAt) return true
  const ms = frequencyNights * 24 * 60 * 60 * 1000
  return now.getTime() - lastSentAt.getTime() >= ms
}

export async function logTaskNotification(input: {
  userId: string
  type: 'ASSIGNMENT' | 'DIGEST'
  meta: Prisma.InputJsonValue
}): Promise<void> {
  await prisma.taskNotificationLog.create({
    data: {
      userId: input.userId,
      type: input.type,
      meta: input.meta,
    },
  })
}

/** Safe category label — never includes task title or client identifiers. */
export function taskEmailCategory(input: {
  serviceClientId: string | null
  assignedDept: ClientOwnerDept | null
  priority: TeamTaskPriority
}): string {
  const base = input.serviceClientId
    ? 'Client-linked task'
    : input.assignedDept
      ? `${input.assignedDept.replace(/_/g, ' ').toLowerCase()} pool task`
      : 'Team ops task'
  return `${base} · ${input.priority.toLowerCase()} priority`
}
