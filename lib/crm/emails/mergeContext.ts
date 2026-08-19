import { prisma } from '@/lib/prisma'
import type { StaffMergeFields } from '@/lib/crm/emails/templates'

export function formatEmailDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function loadStaffEmailMergeContext(clientId: string) {
  return prisma.serviceClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentEmail: true,
      currentOwnerUserId: true,
      caseCoordinatorUserId: true,
      caseCoordinatorName: true,
      actualServiceStartDate: true,
      serviceStartDate: true,
      caseCoordinatorUser: { select: { name: true, email: true } },
      btAssignments: {
        where: { status: 'ACTIVE', deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
}

export function buildStaffMergeFields(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>,
  staff: { name: string | null; email: string | null }
): StaffMergeFields {
  const primary = client.btAssignments[0]
  const rbtName = primary?.rbtProfile
    ? `${primary.rbtProfile.firstName} ${primary.rbtProfile.lastName}`.trim()
    : null

  return {
    childFirstName: client.firstName,
    childLastName: client.lastName,
    parentName: client.parentName,
    parentEmail: client.parentEmail,
    coordinatorName:
      client.caseCoordinatorUser?.name || client.caseCoordinatorName,
    rbtName,
    startDate: formatEmailDate(
      client.actualServiceStartDate ?? client.serviceStartDate
    ),
    assessmentDate: null,
    staffName: staff.name?.trim() || staff.email || 'Rise & Shine Team',
    staffEmail: staff.email,
    companyPhone: '(888) 898-4774',
    companyEmail: 'info@riseandshineaba.com',
    companyName: 'Rise & Shine ABA',
  }
}

export function parseCcList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@'))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
