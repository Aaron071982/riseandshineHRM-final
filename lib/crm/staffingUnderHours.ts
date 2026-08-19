import { deriveMetricsForClients } from '@/lib/client-services/serviceStatus'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { isReceivingUnderAuthorizedThreshold } from '@/lib/crm/staffingUnderHoursShared'
import { prisma } from '@/lib/prisma'

export {
  STAFFING_HOURS_UTILIZATION_THRESHOLD,
  hoursUtilizationPct,
  isReceivingUnderAuthorizedThreshold,
} from '@/lib/crm/staffingUnderHoursShared'

/** ACTIVE + authorized hours + scheduled below threshold (staffing queue cross-list). */
export async function isActiveStaffingUnderHoursClient(
  clientId: string
): Promise<boolean> {
  const client = await prisma.serviceClient.findFirst({
    where: {
      id: clientId,
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      stage: 'ACTIVE',
      authHours: { gt: 0 },
    },
    select: {
      id: true,
      status: true,
      authHours: true,
      btAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { btName: true },
      },
    },
  })
  if (!client) return false

  const metrics = await deriveMetricsForClients([
    {
      id: client.id,
      status: client.status,
      authHours: client.authHours,
      btAssignments: client.btAssignments,
    },
  ])
  const m = metrics.get(client.id)
  if (!m) return false
  return isReceivingUnderAuthorizedThreshold(
    m.scheduledHoursPerWeek,
    client.authHours
  )
}
