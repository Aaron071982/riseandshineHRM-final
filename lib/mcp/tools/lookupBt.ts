import { prisma } from '@/lib/prisma'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import { getAssignmentCountsByRbt } from '@/lib/rbt/activeWorking'
import { daysSince, formatDate, getHireDateProxy } from '@/lib/mcp/helpers'
import type { ToolResult } from '@/lib/mcp/types'

export async function lookupBt(args: { query: string }): Promise<ToolResult> {
  const query = args.query?.trim()
  if (!query) {
    throw new Error('query is required')
  }

  let profiles

  if (query.includes('@')) {
    profiles = await prisma.rBTProfile.findMany({
      where: { email: { equals: query, mode: 'insensitive' } },
      take: 5,
      select: profileSelect,
    })
  } else {
    const parts = query.split(/\s+/).filter(Boolean)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined

    profiles = await prisma.rBTProfile.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          ...(firstName && lastName
            ? [
                {
                  AND: [
                    { firstName: { contains: firstName, mode: 'insensitive' as const } },
                    { lastName: { contains: lastName, mode: 'insensitive' as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: 5,
      select: profileSelect,
    })
  }

  if (profiles.length === 0) {
    return {
      text: `No BT or candidate found matching "${query}".`,
      summary: { matchCount: 0 },
    }
  }

  const assignmentCounts = await getAssignmentCountsByRbt(profiles.map((p) => p.id))
  const lines: string[] = []

  for (const p of profiles) {
    const hireDate = await getHireDateProxy(p.id, p.updatedAt)
    const location = [p.locationCity, p.locationState].filter(Boolean).join(', ') || '—'
    let onboardingPct: string = '—'
    if (p.status === 'HIRED') {
      try {
        const progress = await getOnboardingProgress(p.id)
        onboardingPct =
          progress.totalRbtSteps > 0
            ? `${Math.round((progress.completedCount / progress.totalRbtSteps) * 100)}%`
            : '0%'
      } catch {
        onboardingPct = 'unavailable'
      }
    }

    lines.push(
      `## ${p.firstName} ${p.lastName}`,
      `- ID: ${p.id}`,
      `- Status: ${p.status}`,
      `- Post-hire stage: ${p.postHireStage ?? 'none'}`,
      `- Email: ${p.email ?? '—'}`,
      `- Phone: ${p.phoneNumber}`,
      `- Location: ${location}`,
      `- Onboarding: ${onboardingPct}`,
      `- Artemis training: ${p.artemisTrainingCompleted ? 'completed' : 'not completed'}`,
      `- Assigned clients: ${assignmentCounts.get(p.id) ?? 0}`,
      `- Source: ${p.source ?? 'unknown'}`,
      `- Applied: ${formatDate(p.submittedAt)}`,
      `- Hired: ${p.status === 'HIRED' ? `${formatDate(hireDate)} (${daysSince(hireDate)} days ago)` : '—'}`,
      ''
    )
  }

  return {
    text: `# Lookup results (${profiles.length})\n\n${lines.join('\n')}`,
    summary: { matchCount: profiles.length },
  }
}

const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  locationCity: true,
  locationState: true,
  status: true,
  postHireStage: true,
  source: true,
  submittedAt: true,
  updatedAt: true,
  artemisTrainingCompleted: true,
} as const
