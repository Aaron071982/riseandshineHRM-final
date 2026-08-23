import type { TeamTaskPriority, TeamTaskStatus } from '@prisma/client'

export const TASK_STATUS_LABELS: Record<TeamTaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
}

export const TASK_PRIORITY_LABELS: Record<TeamTaskPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const TASK_STATUS_ORDER: TeamTaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
]

export const TASK_PRIORITY_ORDER: TeamTaskPriority[] = [
  'URGENT',
  'HIGH',
  'NORMAL',
  'LOW',
]

/** Warm, on-brand status pills — no generic blue/grey. */
export const TASK_STATUS_CHIP: Record<TeamTaskStatus, string> = {
  TODO: 'bg-[var(--line-2)] text-[var(--muted-ink)] ring-1 ring-inset ring-[var(--line)]',
  IN_PROGRESS:
    'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)] ring-1 ring-inset ring-[var(--sunrise)]/40',
  BLOCKED: 'bg-[var(--amber-bg)] text-[var(--amber)] ring-1 ring-inset ring-[var(--amber)]/35',
  DONE: 'bg-[var(--green-bg)] text-[var(--green)] ring-1 ring-inset ring-[var(--green)]/30',
}

export const TASK_PRIORITY_CHIP: Record<TeamTaskPriority, string> = {
  LOW: 'bg-[var(--line-2)] text-faint ring-1 ring-inset ring-[var(--line)]',
  NORMAL: 'bg-[var(--line-2)] text-[var(--muted-ink)] ring-1 ring-inset ring-[var(--line)]',
  HIGH: 'bg-[var(--amber-bg)] text-[var(--amber)] ring-1 ring-inset ring-[var(--amber)]/40 font-semibold',
  URGENT:
    'bg-[var(--urgent-bg)] text-[var(--urgent)] ring-1 ring-inset ring-[var(--urgent)]/35 font-semibold',
}

/** Calendar / list chip backgrounds by priority */
export const TASK_PRIORITY_CALENDAR: Record<TeamTaskPriority, string> = {
  LOW: 'bg-[var(--line-2)] text-[var(--muted-ink)]',
  NORMAL: 'bg-[var(--sunrise-soft)] text-[var(--espresso)]',
  HIGH: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  URGENT: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
}

export function isTaskOverdue(
  dueAt: Date | string | null,
  status: TeamTaskStatus
): boolean {
  if (!dueAt || status === 'DONE') return false
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

export function ownerDeptLabel(dept: string | null): string {
  if (!dept) return 'Unassigned pool'
  return dept
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
