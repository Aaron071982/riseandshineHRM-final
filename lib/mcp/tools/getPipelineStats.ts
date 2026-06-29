import { prisma } from '@/lib/prisma'
import { getActiveWorkingStats } from '@/lib/rbt/activeWorking'

const PIPELINE_STATUSES = [
  'NEW',
  'REACH_OUT',
  'REACH_OUT_EMAIL_SENT',
  'TO_INTERVIEW',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
] as const

import type { ToolResult } from '@/lib/mcp/types'

export async function getPipelineStats(): Promise<ToolResult> {
  const now = new Date()

  const [
    statusCounts,
    hiredRBTs,
    inPipeline,
    onboardingComplete,
    activeStats,
    hiredWithTasks,
    upcomingInterviews,
  ] = await Promise.all([
    prisma.rBTProfile.groupBy({ by: ['status'], _count: true }),
    prisma.rBTProfile.count({ where: { status: 'HIRED' } }),
    prisma.rBTProfile.count({ where: { status: { in: [...PIPELINE_STATUSES] } } }),
    prisma.rBTProfile.count({ where: { status: 'ONBOARDING_COMPLETED' } }),
    getActiveWorkingStats(),
    prisma.rBTProfile.findMany({
      where: { status: 'HIRED' },
      include: { onboardingTasks: true },
    }),
    prisma.interview.count({
      where: {
        scheduledAt: { gte: now },
        status: { not: 'CANCELED' },
      },
    }),
  ])

  const statusMap = statusCounts.reduce(
    (acc, s) => {
      acc[s.status] = s._count
      return acc
    },
    {} as Record<string, number>
  )

  const totalHired = hiredWithTasks.length
  const fullyCompleted = hiredWithTasks.filter((r) => {
    const tasks = r.onboardingTasks
    const total = tasks.length
    const completed = tasks.filter((t) => t.isCompleted).length
    return total > 0 && completed === total
  }).length
  const onboardingCompletionRatePercent =
    totalHired > 0 ? Math.round((fullyCompleted / totalHired) * 100) : 0

  const statusLines = Object.entries(statusMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `  ${status}: ${count}`)

  const text = [
    '# Pipeline & Operations Summary',
    '',
    '## Candidates by status',
    ...statusLines,
    '',
    '## Key metrics',
    `  Hired RBTs: ${hiredRBTs}`,
    `  In pipeline: ${inPipeline}`,
    `  Actively working: ${activeStats.activelyWorking}`,
    `  Idle hires: ${activeStats.idleHires}`,
    `  Onboarding completed (status): ${onboardingComplete}`,
    `  Onboarding completion rate: ${onboardingCompletionRatePercent}%`,
    `  Upcoming interviews: ${upcomingInterviews}`,
  ].join('\n')

  return {
    text,
    summary: {
      hiredRBTs,
      inPipeline,
      activelyWorking: activeStats.activelyWorking,
      idleHires: activeStats.idleHires,
      upcomingInterviews,
      onboardingCompletionRatePercent,
    },
  }
}
