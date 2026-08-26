import { prisma } from '@/lib/prisma'
import { moduleAssignedToUser, userAudienceKeys } from '@/lib/org-training/audience'

export type OrgTrainingStaffingSummary = {
  requiredTotal: number
  completedCount: number
  outstandingTitles: string[]
  label: string
}

const EMPTY: OrgTrainingStaffingSummary = {
  requiredTotal: 0,
  completedCount: 0,
  outstandingTitles: [],
  label: 'Required training: 0/0',
}

/**
 * Required ACTIVE modules for the RBT UserRole, completion counts for staffing cards.
 * Does not block staffing — informational only.
 */
export async function getOrgTrainingStaffingSummary(opts: {
  userId?: string | null
  rbtProfileId?: string | null
}): Promise<OrgTrainingStaffingSummary> {
  let userId = opts.userId ?? null
  if (!userId && opts.rbtProfileId) {
    const profile = await prisma.rBTProfile.findUnique({
      where: { id: opts.rbtProfileId },
      select: { userId: true },
    })
    userId = profile?.userId ?? null
  }
  if (!userId) return EMPTY

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      crmRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  })
  if (!user) return EMPTY

  const keys = userAudienceKeys({
    role: user.role,
    crmRoles: user.crmRoles.map((r) => r.role),
  })

  const modules = await prisma.orgTrainingModule.findMany({
    where: { status: 'ACTIVE', required: true },
    select: { id: true, title: true, audienceRoles: true },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  })

  const required = modules.filter((m) => moduleAssignedToUser(m, keys))
  if (required.length === 0) return EMPTY

  const completions = await prisma.orgTrainingCompletion.findMany({
    where: {
      userId,
      moduleId: { in: required.map((m) => m.id) },
    },
    select: { moduleId: true },
  })
  const done = new Set(completions.map((c) => c.moduleId))
  const outstandingTitles = required
    .filter((m) => !done.has(m.id))
    .map((m) => m.title)
  const completedCount = required.length - outstandingTitles.length

  return {
    requiredTotal: required.length,
    completedCount,
    outstandingTitles,
    label: `Required training: ${completedCount}/${required.length}`,
  }
}

/** Batch summaries keyed by rbtProfileId for therapist search cards. */
export async function getOrgTrainingStaffingSummariesForRbtProfiles(
  rbtProfileIds: string[]
): Promise<Record<string, OrgTrainingStaffingSummary>> {
  if (rbtProfileIds.length === 0) return {}

  const profiles = await prisma.rBTProfile.findMany({
    where: { id: { in: rbtProfileIds } },
    select: { id: true, userId: true },
  })
  if (profiles.length === 0) return {}

  const userIds = profiles.map((p) => p.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      role: true,
      crmRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  const modules = await prisma.orgTrainingModule.findMany({
    where: { status: 'ACTIVE', required: true },
    select: { id: true, title: true, audienceRoles: true },
  })

  const completions = await prisma.orgTrainingCompletion.findMany({
    where: {
      userId: { in: userIds },
      moduleId: { in: modules.map((m) => m.id) },
    },
    select: { userId: true, moduleId: true },
  })
  const doneByUser = new Map<string, Set<string>>()
  for (const c of completions) {
    let set = doneByUser.get(c.userId)
    if (!set) {
      set = new Set()
      doneByUser.set(c.userId, set)
    }
    set.add(c.moduleId)
  }

  const out: Record<string, OrgTrainingStaffingSummary> = {}
  for (const profile of profiles) {
    const user = userById.get(profile.userId)
    if (!user) {
      out[profile.id] = EMPTY
      continue
    }
    const keys = userAudienceKeys({
      role: user.role,
      crmRoles: user.crmRoles.map((r) => r.role),
    })
    const required = modules.filter((m) => moduleAssignedToUser(m, keys))
    if (required.length === 0) {
      out[profile.id] = EMPTY
      continue
    }
    const done = doneByUser.get(user.id) ?? new Set()
    const outstandingTitles = required
      .filter((m) => !done.has(m.id))
      .map((m) => m.title)
    const completedCount = required.length - outstandingTitles.length
    out[profile.id] = {
      requiredTotal: required.length,
      completedCount,
      outstandingTitles,
      label: `Required training: ${completedCount}/${required.length}`,
    }
  }
  return out
}
