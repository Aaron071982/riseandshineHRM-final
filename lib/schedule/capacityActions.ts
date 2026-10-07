'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { canAccessCrmSchedule, getClientServicesUser, isFullAccess } from '@/lib/crm/access'

export type TherapistCapacityRow = {
  id: string
  weeklyTargetHours: number | null
  preferredHoursRange: string | null
}

/** Capacity inputs for schedule therapists (RBT profile ids). */
export async function getTherapistCapacityTargets(
  therapistIds: string[]
): Promise<{ rows: TherapistCapacityRow[]; canEdit: boolean }> {
  const user = await getClientServicesUser()
  if (!canAccessCrmSchedule(user)) throw new Error('FORBIDDEN')
  const ids = z.array(z.string().min(1)).max(1000).parse(therapistIds)
  if (ids.length === 0) return { rows: [], canEdit: isFullAccess(user) }

  const rows = await prisma.rBTProfile.findMany({
    where: { id: { in: ids } },
    select: { id: true, weeklyTargetHours: true, preferredHoursRange: true },
  })
  return { rows, canEdit: isFullAccess(user) }
}

const TargetInput = z.object({
  therapistId: z.string().min(1),
  hours: z.number().gt(0).max(80).nullable(),
})

/** Admin-only; null clears the override (falls back to preferred hours, then 40). */
export async function setTherapistWeeklyTarget(input: unknown): Promise<TherapistCapacityRow> {
  const user = await getClientServicesUser()
  if (!canAccessCrmSchedule(user) || !isFullAccess(user)) throw new Error('FORBIDDEN')
  const { therapistId, hours } = TargetInput.parse(input)

  const before = await prisma.rBTProfile.findUnique({
    where: { id: therapistId },
    select: { weeklyTargetHours: true },
  })
  if (!before) throw new Error('Therapist not found')

  const [updated] = await prisma.$transaction([
    prisma.rBTProfile.update({
      where: { id: therapistId },
      data: { weeklyTargetHours: hours },
      select: { id: true, weeklyTargetHours: true, preferredHoursRange: true },
    }),
    prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: therapistId,
        auditType: 'NOTE',
        dateTime: new Date(),
        notes: `Weekly capacity target changed from ${before.weeklyTargetHours ?? 'default'} to ${hours ?? 'default'} hrs (schedule view)`,
        createdBy: user.email ?? user.id,
      },
    }),
  ])
  return updated
}
