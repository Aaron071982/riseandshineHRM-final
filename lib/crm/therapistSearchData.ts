import {
  assertCanViewClient,
  auditClientAction,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'

export async function loadTherapistSearchClient(
  user: CrmAccessSubject,
  clientId: string
) {
  await assertCanViewClient(user, clientId)
  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, deletedAt: null },
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
  if (!client) throw new Error('Client not found')

  await auditClientAction({
    userId: user.id,
    serviceClientId: client.id,
    action: 'THERAPIST_SEARCH_VIEW',
  })
  return client
}
