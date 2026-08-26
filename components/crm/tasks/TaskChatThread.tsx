'use client'

import { renderMentionBody } from '@/lib/crm/tasks/mentions'
import { formatCommentTime } from '@/lib/crm/tasks/formatDue'
import { CrmAvatar } from '@/components/crm/shared/CrmAvatar'
import { cn } from '@/lib/utils'

export type ChatComment = {
  id: string
  body: string
  createdAt: Date | string
  author: { id: string; name: string | null; email: string | null }
}

function MentionHighlightedBody({ body }: { body: string }) {
  const text = renderMentionBody(body)
  const parts = text.split(/(@[^\s@]+(?:\s+[A-Z][^\s@]*)?)/g)
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span
            key={i}
            className="rounded px-0.5 font-medium text-[var(--brand)] bg-[var(--sunrise-soft)]"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

export function TaskChatThread({
  comments,
  currentUserId,
  compact = false,
}: {
  comments: ChatComment[]
  currentUserId: string
  compact?: boolean
}) {
  if (comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--sunrise)]/30 bg-[var(--sunrise-soft)]/50 px-4 py-6 text-center">
        <p className="font-display text-sm font-medium text-ink">Start the conversation</p>
        <p className="mt-1 text-xs text-quiet">
          Drop an update, ask a question, or @mention a teammate.
        </p>
      </div>
    )
  }

  return (
    <ul className={cn('space-y-3', compact ? 'max-h-52' : 'max-h-80', 'overflow-y-auto pr-1')}>
      {comments.map((c) => {
        const isMine = c.author.id === currentUserId
        const name = c.author.name || c.author.email || 'Teammate'
        return (
          <li
            key={c.id}
            className={cn('flex gap-2.5', isMine ? 'flex-row-reverse' : 'flex-row')}
          >
            <CrmAvatar
              name={c.author.name}
              email={c.author.email}
              size={compact ? 28 : 32}
              seed={c.author.id}
            />
            <div
              className={cn(
                'min-w-0 max-w-[85%] rounded-2xl px-3 py-2 shadow-sm transition-colors',
                isMine
                  ? 'rounded-br-md bg-gradient-to-br from-[var(--sunrise-a)] to-[var(--brand)] text-white'
                  : 'rounded-bl-md border border-line bg-surface text-ink'
              )}
            >
              <div
                className={cn(
                  'mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[11px]',
                  isMine ? 'text-white/85' : 'text-quiet'
                )}
              >
                <span className="font-medium">{isMine ? 'You' : name}</span>
                <span className="tabular-nums">{formatCommentTime(c.createdAt)}</span>
              </div>
              <div className={isMine ? 'text-white [&_span]:bg-white/20 [&_span]:text-white' : ''}>
                <MentionHighlightedBody body={c.body} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function TaskChatComposer({
  value,
  onChange,
  onSubmit,
  pending,
  mentionMatches,
  onPickMention,
  placeholder = 'Write a message… Use @ to mention someone',
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  pending: boolean
  mentionMatches: { id: string; name: string | null; email: string | null }[]
  onPickMention: (user: { id: string; name: string | null; email: string | null }) => void
  placeholder?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-[var(--bg)] p-2 shadow-inner">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mentionMatches.length > 0) {
              e.preventDefault()
              return
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              if (mentionMatches.length > 0) {
                e.preventDefault()
                onPickMention(mentionMatches[0]!)
                return
              }
              e.preventDefault()
              if (value.trim() && !pending) onSubmit()
            }
          }}
        />
        {mentionMatches.length > 0 && (
          <ul
            className="absolute bottom-full z-20 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg"
            role="listbox"
          >
            {mentionMatches.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--sunrise-soft)]"
                  // mousedown so pick fires before textarea blur steals the click
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onPickMention(u)
                  }}
                >
                  <CrmAvatar name={u.name} email={u.email} size={24} seed={u.id} />
                  <span className="min-w-0 truncate">
                    {u.name || u.email}
                    {u.name && u.email ? (
                      <span className="ml-1 text-xs text-quiet">{u.email}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <span className="text-[10px] text-faint">
          @ to mention · Enter to send · Shift+Enter for newline
        </span>
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={onSubmit}
          className="h-8 rounded-lg bg-[var(--espresso)] px-4 text-xs font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
