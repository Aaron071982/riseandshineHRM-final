'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  UserPlus,
  Users,
  Waypoints,
} from 'lucide-react'
import type { PortalInboxItem } from '@/lib/crm/portalNotifications'
import { cn } from '@/lib/utils'

const TYPE_ICON = {
  CLIENT_ASSIGNED: UserPlus,
  THERAPIST_ASSIGNED: Users,
  IN_COORDINATION: Waypoints,
  READY_FOR_ASSESSMENT: ClipboardCheck,
} as const

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function PortalInboxCard({
  items,
  unreadCount,
  variant = 'rail',
}: {
  items: PortalInboxItem[]
  unreadCount: number
  variant?: 'rail' | 'page'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [local, setLocal] = useState(items)

  const markAll = () => {
    startTransition(async () => {
      await fetch('/api/portal/inbox/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setLocal((prev) =>
        prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() }))
      )
      router.refresh()
    })
  }

  const markOne = (id: string) => {
    startTransition(async () => {
      await fetch('/api/portal/inbox/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setLocal((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, readAt: i.readAt ?? new Date().toISOString() } : i
        )
      )
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        'rounded-[16px] border border-[var(--portal-line)] bg-white shadow-[var(--portal-shadow)]',
        variant === 'page' && 'overflow-hidden'
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--portal-line)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--portal-orange)]" />
          <h2 className="font-display text-lg font-semibold text-[var(--espresso)]">
            Inbox
          </h2>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-[var(--portal-orange)] px-2 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={markAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--espresso)] disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          ) : null}
          {variant === 'rail' ? (
            <Link
              href="/portal/inbox"
              className="text-xs font-medium text-[var(--portal-orange)] hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
      </div>

      <ul className={cn(variant === 'rail' ? 'max-h-[22rem] overflow-y-auto' : '')}>
        {local.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-[var(--muted-ink)]">
            No lifecycle updates yet.
          </li>
        ) : (
          local.map((item) => {
            const Icon = TYPE_ICON[item.type] ?? Bell
            const unread = !item.readAt
            return (
              <li key={item.id}>
                <Link
                  href={`/portal/clients/${item.clientId}`}
                  onClick={() => {
                    if (unread) markOne(item.id)
                  }}
                  className={cn(
                    'flex gap-3 border-t border-[var(--portal-line)] px-5 py-3.5 transition-colors hover:bg-[var(--portal-paper)]',
                    unread && 'bg-[color-mix(in_srgb,var(--portal-orange)_6%,white)]'
                  )}
                >
                  <span className="relative mt-0.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--portal-orange)_12%,white)] text-[var(--portal-orange)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    {unread ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--portal-orange)]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm text-[var(--espresso)]',
                        unread ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted-ink)]">
                      {item.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--muted-ink)]">
                    {relativeTime(item.createdAt)}
                  </span>
                </Link>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
