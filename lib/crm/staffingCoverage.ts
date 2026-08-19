import { NOT_DELETED } from '@/lib/crm/softDelete'
import { isActiveStaffingUnderHoursClient } from '@/lib/crm/staffingUnderHours'
import { prisma } from '@/lib/prisma'

/** ACTIVE client manually flagged as needing more therapist hours. */
export async function isActiveStaffingCoverageClient(
  clientId: string
): Promise<boolean> {
  const client = await prisma.serviceClient.findFirst({
    where: {
      id: clientId,
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      stage: 'ACTIVE',
      staffingNeedsMoreHours: true,
    },
    select: { id: true },
  })
  return !!client
}

/** Staffing cross-list: under authorized hours or manually flagged for coverage. */
export async function isActiveStaffingCrossListClient(
  clientId: string
): Promise<boolean> {
  if (await isActiveStaffingCoverageClient(clientId)) return true
  return isActiveStaffingUnderHoursClient(clientId)
}
