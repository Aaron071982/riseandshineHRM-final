import 'server-only'

import { auditClientAction } from '@/lib/crm/access'

export async function auditCaseCoordinationAction(input: {
  userId: string
  serviceClientId: string
  action: string
  ip?: string | null
}) {
  await auditClientAction({
    userId: input.userId,
    serviceClientId: input.serviceClientId,
    action: `CASE_COORDINATION:${input.action}`,
    ip: input.ip ?? null,
  })
}
