import { deriveMetricsForClients } from '@/lib/client-services/serviceStatus'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'

/** Active clients below this share of authorized weekly hours appear in Staffing queue. */
export const STAFFING_HOURS_UTILIZATION_THRESHOLD = 0.7

export function hoursUtilizationPct(
  scheduledHoursPerWeek: number,
  authHours: number | null | undefined
): number | null {
  if (authHours == null || !Number.isFinite(authHours) || authHours <= 0) return null
  return Math.round((scheduledHoursPerWeek / authHours) * 100)
}

/** True when scheduled weekly hours are strictly below 70% of authorized hours. */
export function isReceivingUnderAuthorizedThreshold(
  scheduledHoursPerWeek: number,
  authHours: number | null | undefined
): boolean {
  if (authHours == null || !Number.isFinite(authHours) || authHours <= 0) return false
  return scheduledHoursPerWeek / authHours < STAFFING_HOURS_UTILIZATION_THRESHOLD
}

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
