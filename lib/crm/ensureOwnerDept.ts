import type { ClientOwnerDept, ClientStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { STAGE_DEFAULT_OWNER_DEPT } from '@/lib/crm/stages'

/** ACTIVE clients must be owned by case coordination — heal legacy CLINICAL rows. */
export async function ensureCanonicalOwnerDept(
  clientId: string,
  stage: ClientStage,
  currentOwnerDept: ClientOwnerDept | null
): Promise<ClientOwnerDept | null> {
  const expected = STAGE_DEFAULT_OWNER_DEPT[stage]
  if (stage !== 'ACTIVE' || !expected || currentOwnerDept === expected) {
    return currentOwnerDept
  }

  await prisma.serviceClient.update({
    where: { id: clientId },
    data: { currentOwnerDept: expected },
  })
  return expected
}
