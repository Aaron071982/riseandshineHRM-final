'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Bell, ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import type { ClientOwnerDept, TeamTaskPriority, TeamTaskStatus } from '@prisma/client'
import {
  addTeamTaskComment,
  addTeamTaskSubtask,
  deleteTeamTask,
  getTeamTask,
  requestTeamTaskExtension,
  reviewTeamTaskExtension,
  sendTeamTaskReminder,
  toggleTeamTaskSubtask,
  updateTeamTask,
  updateTeamTaskStatus,
} from '@/lib/crm/tasks/actions'
import {
  TASK_PRIORITY_CHIP,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_CHIP,
  TASK_STATUS_LABELS,
  isTaskOverdue,
  ownerDeptLabel,
} from '@/lib/crm/tasks/constants'
import { formatDueRelative } from '@/lib/crm/tasks/formatDue'
import {
  TaskChatComposer,
  TaskChatThread,
  type ChatComment,
} from '@/components/crm/tasks/TaskChatThread'
import { useTaskMentions } from '@/components/crm/tasks/useTaskMentions'
import { CrmAvatar } from '@/components/crm/shared/CrmAvatar'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { cn } from '@/lib/utils'

const DEPTS: ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}

type TaskDetail = Extract<
  Awaited<ReturnType<typeof getTeamTask>>,
  { ok: true }
>['task']

export function TaskDetailPanel({
  taskId,
  currentUserId,
  users,
  clients = [],
  fullAccess = false,
  canManage = false,
  onClose,
  onUpdated,
  onDeleted,
}: {
  taskId: string
  currentUserId: string
  users: { id: string; name: string | null; email: string | null }[]
  clients?: {
    id: string
    firstName: string
    lastName: string
    clientCode: string
  }[]
  fullAccess?: boolean
  canManage?: boolean
  onClose: () => void
  onUpdated: () => void
  onDeleted?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [error, setError] = useState('')
  const [subtask, setSubtask] = useState('')
  const [extDue, setExtDue] = useState('')
  const [extReason, setExtReason] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [reminderMsg, setReminderMsg] = useState('')
  const {
    draft: comment,
    setDraft: setComment,
    mentionMatches,
    pickMention,
    clearDraft: clearComment,
  } = useTaskMentions(users)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editPriority, setEditPriority] = useState<TeamTaskPriority>('NORMAL')
  const [editAssignee, setEditAssignee] = useState('')
  const [editDept, setEditDept] = useState<ClientOwnerDept | ''>('')
  const [editClientId, setEditClientId] = useState('')

  useEffect(() => {
    setActivityOpen(false)
    setReminderMsg('')
    clearComment()
    let cancelled = false
    void (async () => {
      const res = await getTeamTask(taskId)
      if (cancelled) return
      if (res.ok) setTask(res.task as TaskDetail)
      else setError(res.error)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset composer when switching tasks
  }, [taskId])

  const load = async () => {
    const res = await getTeamTask(taskId)
    if (res.ok) setTask(res.task as TaskDetail)
    else setError(res.error)
  }

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
  const canManageTask =
    fullAccess || canManage || task.createdByUserId === currentUserId
  const pendingExt = task.extensionRequests.find((r) => r.status === 'PENDING')

  const startEditing = () => {
    setEditTitle(task.title)
    setEditDesc(task.description ?? '')
    setEditDue(toDateInputValue(task.dueAt))
    setEditPriority(task.priority)
    setEditAssignee(task.assignedToUserId ?? '')
    setEditDept(task.assignedDept ?? '')
    setEditClientId(task.serviceClientId ?? '')
    setEditing(true)
  }

  const saveEdits = () => {
    if (!editTitle.trim()) {
      setError('Title is required')
      return
    }
    if (!editAssignee && !editDept) {
      setError('Assign to a person or department pool')
      return
    }
    run(async () => {
      const res = await updateTeamTask(taskId, {
        title: editTitle,
        description: editDesc,
        dueAt: editDue || null,
        priority: editPriority,
        assignedToUserId: editAssignee || null,
        assignedDept: editAssignee ? null : editDept || null,
        serviceClientId: editClientId || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
    })
  }

  const confirmDelete = () => {
    startTransition(async () => {
      setError('')
      const res = await deleteTeamTask(taskId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowDelete(false)
      onDeleted?.()
      onUpdated()
      onClose()
    })
  }

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
            <div className="flex shrink-0 items-center gap-1">
              {canManageTask && !editing && (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="rounded-lg p-1.5 text-quiet transition hover:bg-line-2 hover:text-ink"
                    title="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    className="rounded-lg p-1.5 text-quiet transition hover:bg-[var(--urgent-bg)] hover:text-[var(--urgent)]"
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-quiet transition hover:bg-line-2 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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

          {editing ? (
            <section className="space-y-3 rounded-xl border border-line bg-[var(--bg)]/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Edit task
              </p>
              <label className="block text-xs text-quiet">
                Title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                />
              </label>
              <label className="block text-xs text-quiet">
                Description
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-quiet">
                  Due date
                  <input
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                  />
                </label>
                <label className="text-xs text-quiet">
                  Priority
                  <select
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(e.target.value as TeamTaskPriority)
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                  >
                    {(
                      ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as TeamTaskPriority[]
                    ).map((p) => (
                      <option key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs text-quiet">
                Assign to person
                <select
                  value={editAssignee}
                  onChange={(e) => {
                    setEditAssignee(e.target.value)
                    if (e.target.value) setEditDept('')
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                >
                  <option value="">— Department pool —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </label>
              {!editAssignee && (
                <label className="block text-xs text-quiet">
                  Department pool
                  <select
                    value={editDept}
                    onChange={(e) =>
                      setEditDept(e.target.value as ClientOwnerDept | '')
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                  >
                    <option value="">Select department</option>
                    {DEPTS.map((d) => (
                      <option key={d} value={d}>
                        {ownerDeptLabel(d)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {clients.length > 0 && (
                <label className="block text-xs text-quiet">
                  Client (optional)
                  <select
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                  >
                    <option value="">— Standalone (no client) —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.lastName}, {c.firstName} ({c.clientCode})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing(false)}
                  className="h-8 rounded-lg border border-line px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveEdits}
                  className="h-8 rounded-lg bg-[var(--espresso)] px-3 text-xs font-medium text-white disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </section>
          ) : (
            task.description && (
              <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap rounded-xl border border-line bg-[var(--bg)]/50 px-3 py-2">
                {task.description}
              </p>
            )
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-ink">Conversation</h3>
              {canManageTask &&
                comments.length === 0 &&
                task.assignedToUserId &&
                task.status !== 'DONE' && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setReminderMsg('')
                      startTransition(async () => {
                        setError('')
                        const res = await sendTeamTaskReminder(taskId)
                        if (!res.ok) {
                          setError(res.error)
                          return
                        }
                        setReminderMsg('Reminder email sent to the assignee')
                        await load()
                        onUpdated()
                      })
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/30 bg-[var(--sunrise-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--brand)] transition hover:bg-[var(--sunrise-soft)]/80 disabled:opacity-50"
                    title="Email the assignee a reminder (only when there are no updates yet)"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Send reminder
                  </button>
                )}
            </div>
            {reminderMsg ? (
              <p className="mt-2 text-xs text-[var(--green)]">{reminderMsg}</p>
            ) : null}
            <div className="mt-3 space-y-3">
              <TaskChatThread comments={comments} currentUserId={currentUserId} />
              <TaskChatComposer
                value={comment}
                onChange={setComment}
                onSubmit={() => {
                  if (!comment.trim()) return
                  startTransition(async () => {
                    setError('')
                    const res = await addTeamTaskComment(taskId, comment)
                    if (!res.ok) {
                      setError(res.error)
                      return
                    }
                    clearComment()
                    await load()
                    onUpdated()
                  })
                }}
                pending={pending}
                mentionMatches={mentionMatches}
                onPickMention={pickMention}
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

      <ConfirmDestructiveDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete task?"
        description="This removes the task from your lists. Comments and activity history stay in the audit log."
        confirmLabel="Delete task"
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
