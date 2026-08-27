import {
  assertCanEditClient,
  CrmAccessError,
  fetchUserCrmRoles,
  type CrmUser,
} from '@/lib/crm/access'
import {
  isUploadableDocumentRequirement,
  type RequirementUploadRequirement,
} from '@/lib/crm/requirementDocuments'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'

type UploadUser = CrmUser | SessionUser

export async function loadUploadableRequirement(
  user: UploadUser,
  clientId: string,
  requirementId: string
): Promise<RequirementUploadRequirement & { type: 'DOCUMENT' }> {
  const crmRoles = await fetchUserCrmRoles(user.id)
  const subject = { ...user, crmRoles }
  await assertCanEditClient(subject, clientId)

  const requirement = await prisma.clientRequirement.findFirst({
    where: {
      id: requirementId,
      serviceClientId: clientId,
      deletedAt: null,
      type: 'DOCUMENT',
    },
    select: {
      id: true,
      key: true,
      serviceClientId: true,
      type: true,
      deletedAt: true,
    },
  })

  if (!isUploadableDocumentRequirement(requirement)) {
    throw new CrmAccessError('Document requirement not found', 404)
  }

  return requirement
}
