import { prisma } from '@/lib/prisma'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import { daysSince, formatDate, getHireDateProxy } from '@/lib/mcp/helpers'
import type { ToolResult } from '@/lib/mcp/types'

export async function getOnboardingStatus(args: {
  stuckOnly?: boolean
  minDaysStuck?: number
}): Promise<ToolResult> {
  const stuckOnly = args.stuckOnly === true
  const minDaysStuck = typeof args.minDaysStuck === 'number' ? args.minDaysStuck : 0

  const profiles = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      updatedAt: true,
      postHireStage: true,
      submittedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  })

  const lines: string[] = []
  let included = 0

  for (const p of profiles) {
    let progress
    try {
      progress = await getOnboardingProgress(p.id)
    } catch {
      continue
    }

    const hireDate = await getHireDateProxy(p.id, p.updatedAt)
    const daysHired = daysSince(hireDate)
    const pct =
      progress.totalRbtSteps > 0
        ? Math.round((progress.completedCount / progress.totalRbtSteps) * 100)
        : 0

    const daysStuck = progress.fullyActivated ? 0 : daysSince(p.updatedAt)

    if (stuckOnly && (progress.fullyActivated || daysHired < 7)) continue
    if (minDaysStuck > 0 && daysStuck < minDaysStuck) continue

    const incomplete = progress.steps
      .filter((s) => !s.isComplete)
      .map((s) => s.document.title)

    lines.push(
      `## ${p.firstName} ${p.lastName} (${p.id})`,
      `- Hire date: ${formatDate(hireDate)} (${daysHired} days ago)`,
      `- Onboarding: ${pct}% (${progress.completedCount}/${progress.totalRbtSteps} steps)`,
      `- Post-hire stage: ${p.postHireStage ?? 'none'}`,
      `- Fully activated: ${progress.fullyActivated ? 'yes' : 'no'}`,
      incomplete.length > 0
        ? `- Incomplete: ${incomplete.join('; ')}`
        : '- Incomplete: none',
      ''
    )
    included++
  }

  const header =
    included === 0
      ? 'No hired RBTs match the requested filters.'
      : `Onboarding status for ${included} hired RBT(s):\n`

  return {
    text: header + lines.join('\n'),
    summary: { rbtCount: included, stuckOnly, minDaysStuck },
  }
}
