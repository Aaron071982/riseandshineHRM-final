import type { CrmAccessSubject } from '@/lib/crm/access'
import {
  auditClientAction,
  CrmAccessError,
  getVisibleClientsWhere,
} from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'

export async function loadTherapistSearchClient(
  user: CrmAccessSubject,
  clientId: string
) {
  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      addressLine: true,
      city: true,
      state: true,
      zip: true,
      preferredRbtGender: true,
      preferredRbtEthnicities: true,
    },
  })
  if (!client) throw new CrmAccessError('Forbidden', 403)

  await auditClientAction({
    userId: user.id,
    serviceClientId: client.id,
    action: 'THERAPIST_SEARCH_VIEW',
  })
  return client
}
