import type { TeamTaskStatus } from '@prisma/client'
import { isTaskOverdue } from '@/lib/crm/tasks/constants'

export function formatDueRelative(
  dueAt: Date | string | null,
  status: TeamTaskStatus
): { text: string; overdue: boolean; soon: boolean } {
  if (!dueAt) return { text: 'No due date', overdue: false, soon: false }
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return { text: 'Invalid date', overdue: false, soon: false }

  const overdue = isTaskOverdue(dueAt, status)
  const now = Date.now()
  const diffMs = due.getTime() - now
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (overdue) {
    const days = Math.max(1, Math.abs(diffDays))
    return {
      text: `overdue by ${days} day${days === 1 ? '' : 's'}`,
      overdue: true,
      soon: false,
    }
  }

  if (diffDays === 0) {
    return { text: 'due today', overdue: false, soon: true }
  }
  if (diffDays === 1) {
    return { text: 'in 1 day', overdue: false, soon: true }
  }
  if (diffDays > 1 && diffDays <= 7) {
    return { text: `in ${diffDays} days`, overdue: false, soon: true }
  }
  if (diffDays < 0) {
    return { text: due.toLocaleDateString(), overdue: false, soon: false }
  }

  return {
    text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overdue: false,
    soon: false,
  }
}

export function formatCommentTime(d: Date | string): string {
  const date = new Date(d)
  const now = new Date()
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
