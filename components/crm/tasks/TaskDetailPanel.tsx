'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { TeamTaskStatus } from '@prisma/client'
import {
  addTeamTaskComment,
  addTeamTaskSubtask,
  getTeamTask,
  requestTeamTaskExtension,
  reviewTeamTaskExtension,
  toggleTeamTaskSubtask,
  updateTeamTaskStatus,
} from '@/lib/crm/tasks/actions'
import {
  TASK_PRIORITY_CHIP,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_CHIP,
  TASK_STATUS_LABELS,
  isTaskOverdue,
} from '@/lib/crm/tasks/constants'
import { formatDueRelative } from '@/lib/crm/tasks/formatDue'
import { formatMentionDisplay } from '@/lib/crm/tasks/mentions'
import {
  TaskChatComposer,
  TaskChatThread,
  type ChatComment,
} from '@/components/crm/tasks/TaskChatThread'
import { CrmAvatar } from '@/components/crm/shared/CrmAvatar'
import { cn } from '@/lib/utils'

type TaskDetail = Extract<
  Awaited<ReturnType<typeof getTeamTask>>,
  { ok: true }
>['task']

export function TaskDetailPanel({
  taskId,
  currentUserId,
  users,
  onClose,
  onUpdated,
}: {
  taskId: string
  currentUserId: string
  users: { id: string; name: string | null; email: string | null }[]
  onClose: () => void
  onUpdated: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [subtask, setSubtask] = useState('')
  const [extDue, setExtDue] = useState('')
  const [extReason, setExtReason] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)

  const load = async () => {
    const res = await getTeamTask(taskId)
    if (res.ok) setTask(res.task as TaskDetail)
    else setError(res.error)
  }

  useEffect(() => {
    setActivityOpen(false)
    void load()
  }, [taskId])

  const run = (fn: () => Promise<unknown>) => {
    startTransition(async () => {
      setError('')
      await fn()
      await load()
      onUpdated()
    })
  }

  const subtaskProgress = useMemo(() => {
    if (!task?.subtasks.length) return null
    const done = task.subtasks.filter((s) => s.done).length
    return { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) }
  }, [task?.subtasks])

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
        <div className="flex h-full w-full max-w-lg items-center justify-center border-l border-line bg-surface">
          <p className="text-sm text-quiet animate-pulse">Loading task…</p>
        </div>
      </div>
    )
  }

  const overdue = isTaskOverdue(task.dueAt, task.status)
  const due = formatDueRelative(task.dueAt, task.status)
  const isAssigner = task.createdByUserId === currentUserId
  const isAssignee = task.assignedToUserId === currentUserId
  const pendingExt = task.extensionRequests.find((r) => r.status === 'PENDING')

  const mentionMatches = mentionQuery.trim()
    ? users.filter((u) => {
        const q = mentionQuery.toLowerCase()
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        )
      }).slice(0, 5)
    : []

  const comments = task.comments as ChatComment[]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl">
        <div className="border-b border-line bg-gradient-to-r from-[var(--sunrise-soft)]/80 to-surface px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold leading-snug text-ink">
                {task.title}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <CrmAvatar
                  name={task.assignedToUser?.name}
                  email={task.assignedToUser?.email}
                  size={28}
                  seed={task.assignedToUserId ?? 'pool'}
                />
                <p className="text-xs text-quiet">
                  {task.assignedToUser?.name ||
                    task.assignedToUser?.email ||
                    (task.assignedDept ? `${task.assignedDept} pool` : 'Unassigned')}
                  {' · '}
                  by {task.createdByUser.name || task.createdByUser.email}
                </p>
              </div>
              {task.serviceClient && (
                <p className="mt-1 text-xs font-medium text-[var(--brand)]">
                  {task.serviceClient.firstName} {task.serviceClient.lastName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-quiet transition hover:bg-line-2 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                TASK_STATUS_CHIP[task.status]
              )}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                TASK_PRIORITY_CHIP[task.priority]
              )}
            >
              {TASK_PRIORITY_LABELS[task.priority]}
            </span>
            {task.dueAt && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                  overdue
                    ? 'bg-[var(--urgent-bg)] text-[var(--urgent)] ring-1 ring-[var(--urgent)]/30'
                    : 'bg-line-2 text-quiet'
                )}
              >
                {due.text}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <p className="rounded-xl bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
              {error}
            </p>
          )}

          {task.description && (
            <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap rounded-xl border border-line bg-[var(--bg)]/50 px-3 py-2">
              {task.description}
            </p>
          )}

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Status</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as TeamTaskStatus[]).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending || task.status === s}
                    onClick={() =>
                      run(async () => {
                        if (s === 'BLOCKED' && !blockedReason.trim()) {
                          setError('Blocked reason required')
                          return
                        }
                        await updateTeamTaskStatus(
                          taskId,
                          s,
                          s === 'BLOCKED' ? blockedReason : null
                        )
                      })
                    }
                    className={cn(
                      'h-8 rounded-lg px-3 text-xs font-medium transition',
                      task.status === s
                        ? 'bg-[var(--espresso)] text-white'
                        : 'border border-line bg-surface hover:bg-[var(--sunrise-soft)]'
                    )}
                  >
                    {TASK_STATUS_LABELS[s]}
                  </button>
                )
              )}
            </div>
            {task.status !== 'BLOCKED' && (
              <input
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="Blocked reason (if marking blocked)"
                className="mt-2 h-9 w-full rounded-lg border border-line bg-[var(--bg)] px-3 text-xs"
              />
            )}
          </section>

          <section className="rounded-xl border border-line bg-[var(--bg)]/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-ink">Checklist</h3>
              {subtaskProgress && (
                <span className="text-xs font-medium tabular-nums text-[var(--brand)]">
                  {subtaskProgress.done}/{subtaskProgress.total}
                </span>
              )}
            </div>
            {subtaskProgress && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--sunrise-a)] to-[var(--brand)] transition-all"
                  style={{ width: `${subtaskProgress.pct}%` }}
                />
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.done}
                    disabled={pending}
                    onChange={(e) =>
                      run(() => toggleTeamTaskSubtask(s.id, e.target.checked))
                    }
                    className="h-4 w-4 rounded border-line text-[var(--brand)]"
                  />
                  <span className={s.done ? 'text-quiet line-through' : 'text-ink'}>
                    {s.title}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={subtask}
                onChange={(e) => setSubtask(e.target.value)}
                placeholder="Add subtask…"
                className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-xs"
              />
              <button
                type="button"
                disabled={pending || !subtask.trim()}
                onClick={() =>
                  run(async () => {
                    await addTeamTaskSubtask(taskId, subtask)
                    setSubtask('')
                  })
                }
                className="h-9 rounded-lg bg-[var(--espresso)] px-3 text-xs font-medium text-white"
              >
                Add
              </button>
            </div>
          </section>

          {isAssignee && (
            <section className="rounded-xl border border-line p-3">
              <h3 className="text-sm font-semibold text-ink">Request more time</h3>
              <div className="mt-2 grid gap-2">
                <input
                  type="date"
                  value={extDue}
                  onChange={(e) => setExtDue(e.target.value)}
                  className="h-9 rounded-lg border border-line px-2 text-xs"
                />
                <input
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  placeholder="Reason"
                  className="h-9 rounded-lg border border-line px-2 text-xs"
                />
                <button
                  type="button"
                  disabled={pending || !extDue}
                  onClick={() =>
                    run(async () => {
                      await requestTeamTaskExtension(taskId, extDue, extReason)
                      setExtDue('')
                      setExtReason('')
                    })
                  }
                  className="h-9 rounded-lg bg-gradient-to-r from-[var(--sunrise-a)] to-[var(--brand)] text-xs font-semibold text-white"
                >
                  Request extension
                </button>
              </div>
            </section>
          )}

          {isAssigner && pendingExt && (
            <section className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-bg)] p-3 text-sm">
              <p>
                Extension requested to{' '}
                {new Date(pendingExt.requestedDueAt).toLocaleDateString()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => reviewTeamTaskExtension(pendingExt.id, true))
                  }
                  className="h-8 rounded-lg bg-[var(--green)] px-3 text-xs font-medium text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => reviewTeamTaskExtension(pendingExt.id, false))
                  }
                  className="h-8 rounded-lg border border-line bg-surface px-3 text-xs"
                >
                  Deny
                </button>
              </div>
            </section>
          )}

          <section>
            <h3 className="font-display text-sm font-semibold text-ink">Conversation</h3>
            <div className="mt-3 space-y-3">
              <TaskChatThread comments={comments} currentUserId={currentUserId} />
              <TaskChatComposer
                value={comment}
                onChange={(v) => {
                  setComment(v)
                  const at = v.lastIndexOf('@')
                  if (at >= 0 && !v.slice(at).includes(' ')) {
                    setMentionQuery(v.slice(at + 1))
                  } else {
                    setMentionQuery('')
                  }
                }}
                onSubmit={() =>
                  run(async () => {
                    await addTeamTaskComment(taskId, comment)
                    setComment('')
                  })
                }
                pending={pending}
                mentionMatches={mentionMatches}
                onPickMention={(u) => {
                  const label = u.name || u.email || 'User'
                  setComment((c) =>
                    c.replace(/@[^@]*$/, formatMentionDisplay(label, u.id) + ' ')
                  )
                  setMentionQuery('')
                }}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setActivityOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-line-2/40"
              aria-expanded={activityOpen}
            >
              <span className="text-sm font-semibold text-ink">
                Activity
                <span className="ml-1.5 font-normal text-quiet tabular-nums">
                  ({task.activities.length})
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-quiet transition-transform',
                  activityOpen && 'rotate-180'
                )}
              />
            </button>
            {activityOpen && (
              <ul className="max-h-36 space-y-1 overflow-y-auto border-t border-line px-3 py-2 text-xs text-quiet">
                {task.activities.map((a) => (
                  <li key={a.id}>
                    {a.actor.name || a.actor.email} · {a.action} ·{' '}
                    {new Date(a.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
