import { prisma } from '@/lib/prisma'
import { getAssignmentCountsByRbt } from '@/lib/rbt/activeWorking'
import { daysSince, formatDate, getHireDateProxy } from '@/lib/mcp/helpers'
import type { ToolResult } from '@/lib/mcp/types'

export async function findIdleHires(args: {
  includeNotTrained?: boolean
}): Promise<ToolResult> {
  const includeNotTrained = args.includeNotTrained === true

  const profiles = await prisma.rBTProfile.findMany({
    where: {
      status: 'HIRED',
      ...(includeNotTrained ? {} : { artemisTrainingCompleted: true }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      locationCity: true,
      locationState: true,
      updatedAt: true,
      artemisTrainingCompleted: true,
    },
    orderBy: { updatedAt: 'asc' },
  })

  const ids = profiles.map((p) => p.id)
  const assignmentCounts = await getAssignmentCountsByRbt(ids)

  const idle = profiles.filter((p) => (assignmentCounts.get(p.id) ?? 0) === 0)

  const lines: string[] = []
  for (const p of idle) {
    const hireDate = await getHireDateProxy(p.id, p.updatedAt)
    const location = [p.locationCity, p.locationState].filter(Boolean).join(', ') || '—'
    lines.push(
      `## ${p.firstName} ${p.lastName} (${p.id})`,
      `- Hire date: ${formatDate(hireDate)} (${daysSince(hireDate)} days ago)`,
      `- Location: ${location}`,
      `- Artemis training: ${p.artemisTrainingCompleted ? 'completed' : 'not completed'}`,
      `- Email: ${p.email ?? '—'}`,
      `- Phone: ${p.phoneNumber}`,
      `- Active clients: 0`,
      ''
    )
  }

  const text =
    idle.length === 0
      ? 'No idle hires found matching the criteria.'
      : `# Idle Hires (${idle.length})\n\nHired RBTs with no client assignments:\n\n${lines.join('\n')}`

  return {
    text,
    summary: { idleCount: idle.length, includeNotTrained },
  }
}
