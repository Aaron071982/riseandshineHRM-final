'use client'

import Link from 'next/link'
import { PortalInboxCard } from '@/components/portal/PortalInboxCard'
import type { PortalInboxItem } from '@/lib/crm/portalNotifications'
import type { PortalNotificationType } from '@prisma/client'
import { cn } from '@/lib/utils'

const FILTERS: { id: PortalNotificationType | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'CLIENT_ASSIGNED', label: 'Assigned' },
  { id: 'THERAPIST_ASSIGNED', label: 'Therapist' },
  { id: 'IN_COORDINATION', label: 'Coordination' },
  { id: 'READY_FOR_ASSESSMENT', label: 'Ready' },
]

export function PortalInboxPageClient({
  items,
  unreadCount,
  activeType,
}: {
  items: PortalInboxItem[]
  unreadCount: number
  activeType: PortalNotificationType | null
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--portal-orange-deep)]">
          Clinical portal
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--espresso)]">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-ink)]">
          Lifecycle updates for your assigned clients.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = f.id ? `/portal/inbox?type=${f.id}` : '/portal/inbox'
          const active = activeType === f.id
          return (
            <Link
              key={f.label}
              href={href}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-[var(--portal-orange)] text-white'
                  : 'border border-[var(--portal-line)] bg-white text-[var(--espresso)] hover:bg-[var(--portal-paper)]'
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <PortalInboxCard items={items} unreadCount={unreadCount} variant="page" />
    </div>
  )
}
