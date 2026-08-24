'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ClientOwnerDept,
  TeamTaskPriority,
  TeamTaskStatus,
} from '@prisma/client'
import {
  CalendarDays,
  CheckCircle2,
  List,
  MessageSquare,
  Plus,
  Sparkles,
} from 'lucide-react'
import {
  claimTeamTask,
  createTeamTask,
  updateTeamTaskStatus,
} from '@/lib/crm/tasks/actions'
import {
  isTaskOverdue,
  TASK_PRIORITY_CHIP,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_CHIP,
  TASK_STATUS_LABELS,
  ownerDeptLabel,
} from '@/lib/crm/tasks/constants'
import { formatDueRelative } from '@/lib/crm/tasks/formatDue'
import { isMyTeamTask } from '@/lib/crm/tasks/myTasks'
import { CrmAvatar } from '@/components/crm/shared/CrmAvatar'
import { TaskDetailPanel } from '@/components/crm/tasks/TaskDetailPanel'
import { TaskCalendarView } from '@/components/crm/tasks/TaskCalendarView'
import { TaskRowComments } from '@/components/crm/tasks/TaskRowComments'
import { cn } from '@/lib/utils'

export type TaskListItem = {
  id: string
  title: string
  description: string | null
  status: TeamTaskStatus
  priority: TeamTaskPriority
  dueAt: Date | string | null
  assignedToUserId: string | null
  assignedDept: ClientOwnerDept | null
  createdByUserId: string
  serviceClientId: string | null
  assignedToUser: { id: string; name: string | null; email: string | null } | null
  createdByUser: { id: string; name: string | null; email: string | null }
  serviceClient: {
    id: string
    firstName: string
    lastName: string
    clientCode: string
  } | null
  subtasks: { id: string; title: string; done: boolean }[]
  _count: { comments: number }
}

type ViewFilter = 'my' | 'assigned_by_me' | 'team'
type LayoutMode = 'list' | 'calendar'

const DEPTS: ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

export function TasksHubClient({
  initialTasks,
  users,
  clients,
  ownedClientIds = [],
  currentUserId,
  fullAccess,
}: {
  initialTasks: TaskListItem[]
  users: { id: string; name: string | null; email: string | null }[]
  clients: {
    id: string
    firstName: string
    lastName: string
    clientCode: string
  }[]
  /** Clients this user actively claims / owns (CC or current owner). */
  ownedClientIds?: string[]
  currentUserId: string
  fullAccess: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<ViewFilter>('my')
  const [layout, setLayout] = useState<LayoutMode>('list')
  const [statusFilter, setStatusFilter] = useState<TeamTaskStatus | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createDue, setCreateDue] = useState('')
  const [createPriority, setCreatePriority] = useState<TeamTaskPriority>('NORMAL')
  const [createAssignee, setCreateAssignee] = useState('')
  const [createDept, setCreateDept] = useState<ClientOwnerDept | ''>('')
  const [createClientId, setCreateClientId] = useState('')
  const [error, setError] = useState('')
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const owned = new Set(ownedClientIds)
    let rows = initialTasks
    if (view === 'my') {
      rows = rows.filter((t) => isMyTeamTask(t, currentUserId, owned))
    } else if (view === 'assigned_by_me') {
      rows = rows.filter(
        (t) => t.createdByUserId === currentUserId && t.status !== 'DONE'
      )
    }
    if (statusFilter) rows = rows.filter((t) => t.status === statusFilter)
    return rows
  }, [initialTasks, view, statusFilter, currentUserId, ownedClientIds])

  const groupedByOwner = useMemo(() => {
    const map = new Map<string, TaskListItem[]>()
    for (const t of filtered) {
      const key = t.assignedToUser
        ? t.assignedToUser.name || t.assignedToUser.email || t.assignedToUser.id
        : t.assignedDept
          ? `${ownerDeptLabel(t.assignedDept)} pool`
          : 'Unassigned'
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const refresh = () => router.refresh()

  const onCreate = () => {
    if (!createTitle.trim()) {
      setError('Title is required')
      return
    }
    if (!createAssignee && !createDept && !createClientId.trim()) {
      setError('Assign to a person or department, or link a client')
      return
    }
    startTransition(async () => {
      setError('')
      const res = await createTeamTask({
        title: createTitle,
        description: createDesc || null,
        serviceClientId: createClientId.trim() || null,
        assignedToUserId: createAssignee || null,
        assignedDept: createDept || null,
        dueAt: createDue || null,
        priority: createPriority,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowCreate(false)
      setCreateTitle('')
      setCreateDesc('')
      setCreateDue('')
      setCreateAssignee('')
      setCreateDept('')
      setCreateClientId('')
      refresh()
    })
  }

  const quickStatus = (taskId: string, status: TeamTaskStatus) => {
    startTransition(async () => {
      await updateTeamTaskStatus(taskId, status)
      refresh()
    })
  }

  const onClaim = (taskId: string) => {
    startTransition(async () => {
      const res = await claimTeamTask(taskId)
      if (!res.ok) setError(res.error)
      else refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-16">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--sunrise-soft)] via-transparent to-transparent opacity-80" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--brand)]">
              Rise & Shine CRM
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Tasks
            </h1>
            <p className="mt-1 max-w-md text-sm text-quiet">
              What&apos;s due, for which client, and who owns it — chat with your team right on each task.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--sunrise-a)] to-[var(--brand)] px-4 text-sm font-semibold text-white shadow-md transition hover:opacity-95 hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            New task
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-sm">
        {(
          [
            ['my', 'My tasks'],
            ['assigned_by_me', 'Assigned by me'],
            ...(fullAccess ? [['team', 'Team / all'] as const] : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              'h-9 rounded-lg px-3.5 text-xs font-semibold transition',
              view === id
                ? 'bg-[var(--espresso)] text-white shadow-sm'
                : 'text-quiet hover:bg-[var(--sunrise-soft)] hover:text-ink'
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <button
          type="button"
          onClick={() => setLayout('list')}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
            layout === 'list'
              ? 'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)]'
              : 'text-quiet hover:bg-line-2'
          )}
        >
          <List className="h-3.5 w-3.5" /> List
        </button>
        <button
          type="button"
          onClick={() => setLayout('calendar')}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
            layout === 'calendar'
              ? 'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)]'
              : 'text-quiet hover:bg-line-2'
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Calendar
        </button>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TeamTaskStatus | '')
          }
          className="ml-auto h-9 rounded-lg border border-line bg-[var(--bg)] px-3 text-xs font-medium text-ink"
        >
          <option value="">All statuses</option>
          {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as TeamTaskStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            )
          )}
        </select>
      </div>

      {layout === 'calendar' ? (
        <TaskCalendarView
          tasks={filtered}
          onSelect={(id) => setSelectedId(id)}
        />
      ) : (
        <div className="space-y-6">
          {groupedByOwner.length === 0 ? (
            <div className="crm-card flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--sunrise-soft)] text-[var(--brand)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-ink">
                No tasks here yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-quiet">
                Assign one to get started — link a client so it lands on the right person&apos;s list.
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 h-9 rounded-lg bg-[var(--espresso)] px-4 text-sm font-medium text-white"
              >
                Create a task
              </button>
            </div>
          ) : (
            groupedByOwner.map(([owner, items]) => {
              const ownerUser = items[0]?.assignedToUser
              return (
              <section key={owner}>
                <div className="mb-3 flex items-center gap-3">
                  <CrmAvatar
                    name={ownerUser?.name}
                    email={ownerUser?.email ?? owner}
                    size={40}
                    seed={owner}
                  />
                  <div>
                    <h2 className="font-display text-sm font-semibold text-ink">
                      {owner}
                    </h2>
                    <p className="text-xs text-quiet tabular-nums">
                      {items.length} open task{items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {items.map((task) => {
                    const overdue = isTaskOverdue(task.dueAt, task.status)
                    const due = formatDueRelative(task.dueAt, task.status)
                    const commentsOpen = commentsOpenId === task.id
                    const subDone = task.subtasks.filter((s) => s.done).length
                    const subTotal = task.subtasks.length
                    return (
                      <li
                        key={task.id}
                        className={cn(
                          'crm-card crm-card-hover overflow-hidden transition-all',
                          overdue && 'border-[var(--urgent)]/25 bg-[var(--urgent-bg)]/20'
                        )}
                      >
                        <div className="flex flex-wrap items-start gap-3 p-3 sm:p-4">
                          <button
                            type="button"
                            onClick={() => setSelectedId(task.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="text-base font-semibold text-ink">
                              {task.title}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {task.serviceClient && (
                                <span className="inline-flex items-center rounded-full bg-[var(--sunrise-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--sunrise-dark)] ring-1 ring-[var(--sunrise)]/25">
                                  {task.serviceClient.firstName}{' '}
                                  {task.serviceClient.lastName}
                                </span>
                              )}
                              {!task.serviceClientId && (
                                <span className="text-xs text-faint">Standalone</span>
                              )}
                              {task.dueAt && (
                                <span
                                  className={cn(
                                    'text-xs font-medium tabular-nums',
                                    due.overdue
                                      ? 'text-[var(--urgent)]'
                                      : due.soon
                                        ? 'text-[var(--amber)]'
                                        : 'text-quiet'
                                  )}
                                >
                                  {due.text}
                                </span>
                              )}
                              {subTotal > 0 && (
                                <span className="text-xs text-faint tabular-nums">
                                  {subDone}/{subTotal} checklist
                                </span>
                              )}
                            </div>
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCommentsOpenId((id) =>
                                  id === task.id ? null : task.id
                                )
                              }
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                commentsOpen
                                  ? 'bg-[var(--espresso)] text-white'
                                  : 'bg-line-2 text-quiet hover:text-ink'
                              )}
                            >
                              <MessageSquare className="h-3 w-3" />
                              {task._count.comments}
                            </button>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                TASK_PRIORITY_CHIP[task.priority]
                              )}
                            >
                              {TASK_PRIORITY_LABELS[task.priority]}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                TASK_STATUS_CHIP[task.status]
                              )}
                            >
                              {TASK_STATUS_LABELS[task.status]}
                            </span>
                            {!task.assignedToUserId && task.assignedDept && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => onClaim(task.id)}
                                className="h-8 rounded-lg border border-[var(--brand)]/30 px-2.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--sunrise-soft)]"
                              >
                                Claim
                              </button>
                            )}
                            {task.status !== 'DONE' &&
                              task.assignedToUserId === currentUserId && (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => quickStatus(task.id, 'DONE')}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--green-bg)] px-2.5 text-xs font-semibold text-[var(--green)] hover:opacity-90"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Done
                                </button>
                              )}
                          </div>
                        </div>
                        <TaskRowComments
                          taskId={task.id}
                          commentCount={task._count.comments}
                          users={users}
                          currentUserId={currentUserId}
                          open={commentsOpen}
                          onToggle={() =>
                            setCommentsOpenId((id) =>
                              id === task.id ? null : task.id
                            )
                          }
                          onUpdated={refresh}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )})
          )}
        </div>
      )}

      {selectedId && (
        <TaskDetailPanel
          taskId={selectedId}
          currentUserId={currentUserId}
          users={users}
          clients={clients}
          fullAccess={fullAccess}
          onClose={() => setSelectedId(null)}
          onUpdated={refresh}
          onDeleted={() => setSelectedId(null)}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-lg">
            <h2 className="font-display text-lg font-semibold text-ink">
              New task
            </h2>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-quiet">
                Title
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
                />
              </label>
              <label className="block text-xs text-quiet">
                Description
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-quiet">
                  Due date
                  <input
                    type="date"
                    value={createDue}
                    onChange={(e) => setCreateDue(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
                  />
                </label>
                <label className="text-xs text-quiet">
                  Priority
                  <select
                    value={createPriority}
                    onChange={(e) =>
                      setCreatePriority(e.target.value as TeamTaskPriority)
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
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
                  value={createAssignee}
                  onChange={(e) => {
                    setCreateAssignee(e.target.value)
                    if (e.target.value) setCreateDept('')
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
                >
                  <option value="">— Department pool —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </label>
              {!createAssignee && (
                <label className="block text-xs text-quiet">
                  Department pool
                  <select
                    value={createDept}
                    onChange={(e) =>
                      setCreateDept(e.target.value as ClientOwnerDept | '')
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
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
              <label className="block text-xs text-quiet">
                Client (optional)
                <select
                  value={createClientId}
                  onChange={(e) => setCreateClientId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-sm"
                >
                  <option value="">— Standalone (no client) —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName}, {c.firstName} ({c.clientCode})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-9 rounded-lg border border-line px-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onCreate}
                className="h-9 rounded-lg bg-[var(--espresso)] px-3 text-sm text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
