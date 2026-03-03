import { prisma } from '@/lib/prisma'

export type EmployeeSourceType = 'RBT' | 'BCBA' | 'BILLING' | 'MARKETING' | 'CALL_CENTER' | 'DEV'

interface EmployeeSource {
  id: string
  type: EmployeeSourceType
  displayName: string
}

export async function ensureEmployeeForRbtProfile(rbtProfileId: string) {
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { id: true, firstName: true, lastName: true, userId: true },
  })
  if (!profile) return null
  return ensureEmployeeForSource({
    id: profile.id,
    type: 'RBT',
    displayName: `${profile.firstName} ${profile.lastName}`,
  }, profile.userId ?? undefined)
}

export async function ensureEmployeeForSource(
  source: EmployeeSource,
  userId?: string
) {
  const existing = await prisma.employee.findFirst({
    where: {
      employeeType: source.type,
      referenceId: source.id,
    },
  })
  if (existing) {
    return existing
  }

  const employee = await prisma.employee.create({
    data: {
      employeeType: source.type,
      referenceId: source.id,
      displayName: source.displayName,
      userId: userId ?? null,
      roles: {
        create: {
          role: source.type,
          isPrimary: true,
        },
      },
    },
  })

  return employee
}

export async function ensureEmployeeForBcbaProfile(id: string) {
  const profile = await prisma.bCBAProfile.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  })
  if (!profile) return null
  return ensureEmployeeForSource({
    id: profile.id,
    type: 'BCBA',
    displayName: profile.fullName,
  })
}

export async function ensureEmployeeForBillingProfile(id: string) {
  const profile = await prisma.billingProfile.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  })
  if (!profile) return null
  return ensureEmployeeForSource({
    id: profile.id,
    type: 'BILLING',
    displayName: profile.fullName,
  })
}

export async function ensureEmployeeForMarketingProfile(id: string) {
  const profile = await prisma.marketingProfile.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  })
  if (!profile) return null
  return ensureEmployeeForSource({
    id: profile.id,
    type: 'MARKETING',
    displayName: profile.fullName,
  })
}

export async function ensureEmployeeForCallCenterProfile(id: string) {
  const profile = await prisma.callCenterProfile.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  })
  if (!profile) return null
  return ensureEmployeeForSource({
    id: profile.id,
    type: 'CALL_CENTER',
    displayName: profile.fullName,
  })
}

export async function ensureEmployeeForDevTeamMember(id: string) {
  const member = await prisma.devTeamMember.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  })
  if (!member) return null
  return ensureEmployeeForSource({
    id: member.id,
    type: 'DEV',
    displayName: member.fullName,
  })
}

