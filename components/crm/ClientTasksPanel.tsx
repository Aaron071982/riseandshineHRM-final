'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { TeamTaskPriority } from '@prisma/client'
import { createTeamTask } from '@/lib/crm/tasks/actions'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_CHIP,
  TASK_STATUS_LABELS,
  isTaskOverdue,
} from '@/lib/crm/tasks/constants'
import { TaskDetailPanel } from '@/components/crm/tasks/TaskDetailPanel'
import type { TaskListItem } from '@/components/crm/tasks/TasksHubClient'
import { cn } from '@/lib/utils'

export function ClientTasksPanel({
  clientId,
  clientName,
  tasks,
  users,
  currentUserId,
  canEdit,
}: {
  clientId: string
  clientName: string
  tasks: TaskListItem[]
  users: { id: string; name: string | null; email: string | null }[]
  currentUserId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<TeamTaskPriority>('NORMAL')
  const [assignee, setAssignee] = useState('')
  const [error, setError] = useState('')

  const open = tasks.filter((t) => t.status !== 'DONE')

  const onCreate = () => {
    if (!title.trim()) return
    startTransition(async () => {
      setError('')
      const res = await createTeamTask({
        title,
        serviceClientId: clientId,
        assignedToUserId: assignee || currentUserId,
        dueAt: due || null,
        priority,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowCreate(false)
      setTitle('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-quiet">
          Client-linked tasks for {clientName}. Only staff with access to this
          client can see them.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs hover:bg-line-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      {open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
          No open tasks for this client.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {open.map((task) => {
            const overdue = isTaskOverdue(task.dueAt, task.status)
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedId(task.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-sm font-medium text-ink">{task.title}</div>
                  <div className="mt-0.5 text-xs text-quiet">
                    {task.assignedToUser?.name || task.assignedToUser?.email || 'Pool'}
                    {task.dueAt && (
                      <span className={cn('ml-2', overdue && 'text-[var(--urgent)]')}>
                        Due {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-medium',
                    TASK_STATUS_CHIP[task.status]
                  )}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {selectedId && (
        <TaskDetailPanel
          taskId={selectedId}
          currentUserId={currentUserId}
          users={users}
          onClose={() => setSelectedId(null)}
          onUpdated={() => router.refresh()}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-4">
            <h2 className="font-display text-base font-semibold">New client task</h2>
            <div className="mt-3 space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              />
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TeamTaskPriority)}
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              >
                {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as TeamTaskPriority[]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </option>
                  )
                )}
              </select>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              >
                <option value="">Assign to me</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-8 rounded-lg border border-line px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onCreate}
                className="h-8 rounded-lg bg-[var(--espresso)] px-3 text-xs text-white"
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
