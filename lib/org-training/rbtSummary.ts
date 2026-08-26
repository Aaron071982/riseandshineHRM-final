import { prisma } from '@/lib/prisma'
import { userAudienceKeys } from '@/lib/org-training/audience'

export type AudienceTrainingSummary = {
  audienceKey: string
  label: string
  moduleCount: number
  peopleAssigned: number
  peopleFullyComplete: number
  modules: {
    id: string
    title: string
    required: boolean
    assignedPeople: number
    completedPeople: number
  }[]
}

const AUDIENCE_LABELS: Record<string, string> = {
  RBT: 'RBTs',
  BCBA: 'BCBAs',
  INTAKE: 'Intake',
  CLINICAL: 'Clinical',
  AUTHORIZATION: 'Authorization',
  STAFFING: 'Staffing',
  CASE_COORDINATION: 'Case coordination',
  BILLING: 'Billing',
  MANAGEMENT: 'Management',
  SUPER_ADMIN: 'Super admin',
  MARKETING: 'Marketing',
  CALL_CENTER: 'Call center',
  TRAINER: 'Trainers',
}

/**
 * Per-audience completion rollup for ACTIVE modules (required preferred first).
 * Used on the Client Services training manage hub.
 */
export async function buildAudienceTrainingSummaries(): Promise<
  AudienceTrainingSummary[]
> {
  const modules = await prisma.orgTrainingModule.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ required: 'desc' }, { displayOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      required: true,
      audienceRoles: true,
      completions: { select: { userId: true } },
    },
  })

  if (modules.length === 0) return []

  const audienceKeys = Array.from(
    new Set(modules.flatMap((m) => m.audienceRoles.map((r) => r.toUpperCase())))
  )

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: audienceKeys as never[] } },
        {
          crmRoles: {
            some: { revokedAt: null, role: { in: audienceKeys as never[] } },
          },
        },
      ],
    },
    select: {
      id: true,
      role: true,
      crmRoles: { where: { revokedAt: null }, select: { role: true } },
    },
    take: 3000,
  })

  const peopleByAudience = new Map<string, Set<string>>()
  for (const key of audienceKeys) {
    peopleByAudience.set(key, new Set())
  }
  for (const u of users) {
    const keys = userAudienceKeys({
      role: u.role,
      crmRoles: u.crmRoles.map((r) => r.role),
    })
    for (const k of keys) {
      peopleByAudience.get(k)?.add(u.id)
    }
  }

  const out: AudienceTrainingSummary[] = []

  for (const key of audienceKeys) {
    const audienceModules = modules.filter((m) =>
      m.audienceRoles.some((r) => r.toUpperCase() === key)
    )
    if (audienceModules.length === 0) continue

    const people = peopleByAudience.get(key) ?? new Set()
    const requiredMods = audienceModules.filter((m) => m.required)
    const trackMods = requiredMods.length > 0 ? requiredMods : audienceModules

    let fullyComplete = 0
    for (const userId of people) {
      const done = trackMods.every((m) =>
        m.completions.some((c) => c.userId === userId)
      )
      if (done && trackMods.length > 0) fullyComplete += 1
    }

    out.push({
      audienceKey: key,
      label: AUDIENCE_LABELS[key] ?? key,
      moduleCount: audienceModules.length,
      peopleAssigned: people.size,
      peopleFullyComplete: fullyComplete,
      modules: audienceModules.map((m) => {
        const assigned = people.size
        const completed = [...people].filter((uid) =>
          m.completions.some((c) => c.userId === uid)
        ).length
        return {
          id: m.id,
          title: m.title,
          required: m.required,
          assignedPeople: assigned,
          completedPeople: completed,
        }
      }),
    })
  }

  // RBTs first, then alphabetical
  out.sort((a, b) => {
    if (a.audienceKey === 'RBT') return -1
    if (b.audienceKey === 'RBT') return 1
    return a.label.localeCompare(b.label)
  })

  return out
}
