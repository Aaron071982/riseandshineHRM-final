import 'server-only'

import { auditClientAction } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'

export async function auditStaffingReplacementForClient(input: {
  userId: string
  serviceClientId: string
  action: string
  ip?: string | null
}) {
  await auditClientAction({
    userId: input.userId,
    serviceClientId: input.serviceClientId,
    action: `STAFFING:${input.action}`,
    ip: input.ip ?? null,
  })
}

export async function auditRbtDeparture(input: {
  rbtProfileId: string
  userId: string
  action: 'DEPARTURE_FLAG' | 'DEPARTURE_CLEAR'
  note: string
}) {
  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      auditType: `STAFFING_${input.action}`,
      dateTime: new Date(),
      notes: input.note,
      createdBy: input.userId,
    },
  })
}
