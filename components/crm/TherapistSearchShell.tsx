'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type TabId = 'search' | 'map'

export default function TherapistSearchShell({
  searchContent,
  mapContent,
}: {
  searchContent: ReactNode
  mapContent: ReactNode
}) {
  const searchParams = useSearchParams()
  const view = (searchParams.get('view') === 'map' ? 'map' : 'search') as TabId
  const clientId = searchParams.get('clientId')
  const clientQuery = clientId
    ? `&clientId=${encodeURIComponent(clientId)}`
    : ''

  const tabs: { id: TabId; label: string; href: string }[] = [
    {
      id: 'search',
      label: 'Proximity search',
      href: `/client-services/therapist-search?view=search${clientQuery}`,
    },
    {
      id: 'map',
      label: 'Staff & client map',
      href: `/client-services/therapist-search?view=map${clientQuery}`,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Staffing
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Therapist Search
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-quiet">
          Find closest therapists for an address, or view all staff and clients
          on one map to spot staffing gaps spatially.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
        aria-label="Therapist search views"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              view === tab.id
                ? 'bg-[var(--espresso)] text-white shadow-sm'
                : 'text-ink hover:bg-line-2'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === 'map' ? mapContent : searchContent}
    </div>
  )
}
