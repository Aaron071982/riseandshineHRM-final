'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'
import {
  addTeamTaskComment,
  getTeamTask,
} from '@/lib/crm/tasks/actions'
import { formatMentionDisplay } from '@/lib/crm/tasks/mentions'
import {
  TaskChatComposer,
  TaskChatThread,
  type ChatComment,
} from '@/components/crm/tasks/TaskChatThread'

export function TaskRowComments({
  taskId,
  commentCount,
  users,
  currentUserId,
  open,
  onToggle,
  onUpdated,
}: {
  taskId: string
  commentCount: number
  users: { id: string; name: string | null; email: string | null }[]
  currentUserId: string
  open: boolean
  onToggle: () => void
  onUpdated: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [comments, setComments] = useState<ChatComment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const res = await getTeamTask(taskId)
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      setComments(res.task.comments as ChatComment[])
      setLoaded(true)
      setError('')
    })()
    return () => {
      cancelled = true
    }
  }, [open, taskId])

  const mentionMatches = mentionQuery.trim()
    ? users
        .filter((u) => {
          const q = mentionQuery.toLowerCase()
          return (
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
          )
        })
        .slice(0, 5)
    : []

  const onBodyChange = (v: string) => {
    setBody(v)
    const at = v.lastIndexOf('@')
    if (at >= 0 && !v.slice(at).includes(' ')) {
      setMentionQuery(v.slice(at + 1))
    } else {
      setMentionQuery('')
    }
  }

  const post = () => {
    if (!body.trim()) return
    startTransition(async () => {
      setError('')
      const res = await addTeamTaskComment(taskId, body)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setBody('')
      const refreshed = await getTeamTask(taskId)
      if (refreshed.ok) {
        setComments(refreshed.task.comments as ChatComment[])
      }
      onUpdated()
    })
  }

  return (
    <>
      {open && (
        <div className="w-full space-y-3 border-t border-line/80 bg-gradient-to-b from-[var(--sunrise-soft)]/30 to-[var(--bg)] px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
              <MessageSquare className="h-4 w-4 text-[var(--brand)]" />
              Conversation
              <span className="rounded-full bg-[var(--espresso)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-white">
                {commentCount}
              </span>
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-quiet transition hover:bg-line-2 hover:text-ink"
              aria-expanded={open}
            >
              Collapse
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-[var(--urgent)]" role="alert">
              {error}
            </p>
          )}

          {!loaded ? (
            <p className="text-xs text-quiet animate-pulse">Loading chat…</p>
          ) : (
            <>
              <TaskChatThread
                comments={comments}
                currentUserId={currentUserId}
                compact
              />
              <TaskChatComposer
                value={body}
                onChange={onBodyChange}
                onSubmit={post}
                pending={pending}
                mentionMatches={mentionMatches}
                onPickMention={(u) => {
                  const label = u.name || u.email || 'User'
                  setBody((c) =>
                    c.replace(/@[^@]*$/, formatMentionDisplay(label, u.id) + ' ')
                  )
                  setMentionQuery('')
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  )
}
