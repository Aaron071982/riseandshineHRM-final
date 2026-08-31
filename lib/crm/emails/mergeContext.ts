import { prisma } from '@/lib/prisma'
import { parentFirstNameFromFull } from '@/lib/crm/emails/templates/shell'
import type { StaffMergeFields, ScheduleSlotRow } from '@/lib/crm/emails/templates/types'

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
      parentPhone: true,
      addressLine: true,
      city: true,
      state: true,
      zip: true,
      currentOwnerUserId: true,
      caseCoordinatorUserId: true,
      caseCoordinatorName: true,
      actualServiceStartDate: true,
      serviceStartDate: true,
      caseCoordinatorUser: { select: { name: true, email: true, phoneNumber: true } },
      bcbaProfile: { select: { fullName: true, email: true, phone: true } },
      bcbaName: true,
      btAssignments: {
        where: { status: 'ACTIVE', deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              addressLine1: true,
              addressLine2: true,
              locationCity: true,
              locationState: true,
              zipCode: true,
            },
          },
        },
      },
      scheduleAssignments: {
        where: {
          isActive: true,
          deletedAt: null,
          reviewStatus: { in: ['NONE', 'CONFIRMED'] },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              addressLine1: true,
              addressLine2: true,
              locationCity: true,
              locationState: true,
              zipCode: true,
            },
          },
        },
      },
      consent: {
        select: { lines: true, deletedAt: true },
      },
    },
  })
}

function buildScheduleSlots(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>
): ScheduleSlotRow[] {
  return client.scheduleAssignments.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
    rbtName: a.rbtProfile
      ? `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim()
      : 'Therapist',
  }))
}

type RbtProfileRow = NonNullable<
  NonNullable<
    Awaited<ReturnType<typeof loadStaffEmailMergeContext>>
  >['btAssignments'][number]['rbtProfile']
>

function rbtContactFromProfile(profile: RbtProfileRow) {
  const addressLine = [profile.addressLine1, profile.addressLine2]
    .filter(Boolean)
    .join(', ')
  return {
    rbtName: `${profile.firstName} ${profile.lastName}`.trim(),
    rbtEmail: profile.email ?? null,
    rbtPhone: profile.phoneNumber ?? null,
    rbtAddressLine: addressLine || null,
    rbtCity: profile.locationCity ?? null,
    rbtState: profile.locationState ?? null,
    rbtZip: profile.zipCode ?? null,
  }
}

/** Primary RBT: explicit staffing pick → primary assignment → schedule → name-only row. */
function resolvePrimaryRbtContact(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>,
  selectedRbtAssignmentId?: string | null
): {
  rbtName: string | null
  rbtEmail: string | null
  rbtPhone: string | null
  rbtAddressLine: string | null
  rbtCity: string | null
  rbtState: string | null
  rbtZip: string | null
} {
  const empty = {
    rbtName: null,
    rbtEmail: null,
    rbtPhone: null,
    rbtAddressLine: null,
    rbtCity: null,
    rbtState: null,
    rbtZip: null,
  }

  const fromAssignment = (
    assignment: (typeof client.btAssignments)[number] | undefined
  ) => {
    if (!assignment) return null
    if (assignment.rbtProfile) return rbtContactFromProfile(assignment.rbtProfile)
    const nameOnly = assignment.btName?.trim()
    if (nameOnly) return { ...empty, rbtName: nameOnly }
    return null
  }

  if (selectedRbtAssignmentId) {
    const picked = client.btAssignments.find((a) => a.id === selectedRbtAssignmentId)
    const resolved = fromAssignment(picked)
    if (resolved) return resolved
  }

  const primaryAssignment = client.btAssignments[0]
  const fromPrimary = fromAssignment(primaryAssignment)
  if (fromPrimary) return fromPrimary

  const scheduleWithProfile = client.scheduleAssignments.find((a) => a.rbtProfile)
  if (scheduleWithProfile?.rbtProfile) {
    return rbtContactFromProfile(scheduleWithProfile.rbtProfile)
  }

  return empty
}

export function defaultRbtAssignmentId(
  assignments: { id: string; isPrimary: boolean }[]
): string | null {
  if (!assignments.length) return null
  return assignments.find((a) => a.isPrimary)?.id ?? assignments[0]!.id
}

export function buildStaffMergeFields(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>,
  staff: { name: string | null; email: string | null },
  options?: { rbtAssignmentId?: string | null }
): StaffMergeFields {
  const rbt = resolvePrimaryRbtContact(client, options?.rbtAssignmentId)
  const bcba = client.bcbaProfile
  const teamStaffEmails = collectTeamStaffEmails(client)

  return {
    childFirstName: client.firstName,
    childLastName: client.lastName,
    parentName: client.parentName,
    parentFirstName: parentFirstNameFromFull(client.parentName),
    parentEmail: client.parentEmail,
    parentPhone: client.parentPhone,
    clientAddressLine: client.addressLine,
    clientCity: client.city,
    clientState: client.state,
    clientZip: client.zip,
    coordinatorName:
      client.caseCoordinatorUser?.name || client.caseCoordinatorName,
    coordinatorEmail: client.caseCoordinatorUser?.email ?? null,
    coordinatorPhone: client.caseCoordinatorUser?.phoneNumber ?? null,
    coordinatorTitle: 'Case Coordinator',
    portalLink: null,
    missingDocsList: [],
    rbtName: rbt.rbtName,
    rbtEmail: rbt.rbtEmail,
    rbtPhone: rbt.rbtPhone,
    rbtAddressLine: rbt.rbtAddressLine,
    rbtCity: rbt.rbtCity,
    rbtState: rbt.rbtState,
    rbtZip: rbt.rbtZip,
    bcbaName: bcba?.fullName || client.bcbaName,
    bcbaEmail: bcba?.email ?? null,
    bcbaPhone: bcba?.phone ?? null,
    scheduleSlots: buildScheduleSlots(client),
    startDate: formatEmailDate(
      client.actualServiceStartDate ?? client.serviceStartDate
    ),
    assessmentDate: null,
    assessmentModality: null,
    staffName: staff.name?.trim() || staff.email || 'Rise & Shine Team',
    staffEmail: staff.email,
    companyPhone: '888-898-4774',
    companyEmail: 'info@riseandshineaba.com',
    companyName: 'Rise & Shine ABA',
    teamStaffEmails,
  }
}

function collectTeamStaffEmails(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>
): string[] {
  const emails = new Set<string>()
  const add = (email: string | null | undefined) => {
    const e = email?.trim().toLowerCase()
    if (e && e.includes('@')) emails.add(e)
  }
  add(client.bcbaProfile?.email)
  add(client.caseCoordinatorUser?.email)
  for (const a of client.scheduleAssignments) {
    add(a.rbtProfile?.email)
  }
  for (const a of client.btAssignments) {
    add(a.rbtProfile?.email)
  }
  return [...emails]
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

/** Suggested CC for templates that disclose full PHI to clinical staff. */
export function meetAndGreetCcEmails(fields: StaffMergeFields): string[] {
  const out: string[] = []
  if (fields.rbtEmail?.trim()) out.push(fields.rbtEmail.trim().toLowerCase())
  if (fields.bcbaEmail?.trim()) out.push(fields.bcbaEmail.trim().toLowerCase())
  return out
}

export function mergeCcLists(...lists: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const email of list) {
      const e = email.trim().toLowerCase()
      if (!e || seen.has(e)) continue
      seen.add(e)
      out.push(e)
    }
  }
  return out
}
