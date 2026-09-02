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

  if (view === 'map') {
    return (
      <div className="-mx-4 -my-6 flex h-[calc(100vh-3.75rem)] min-h-0 flex-col sm:-mx-6 lg:-mx-8">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white/90 px-3 py-2 backdrop-blur-sm sm:px-4">
          <nav
            className="flex gap-1 rounded-lg border border-line bg-surface p-0.5"
            aria-label="Therapist search views"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  view === tab.id
                    ? 'bg-[var(--espresso)] text-white shadow-sm'
                    : 'text-ink hover:bg-line-2'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <p className="hidden text-xs text-quiet sm:block">
            ● clients by CRM stage · ▲ therapists green = working, red = not
          </p>
        </div>
        <div className="relative min-h-0 flex-1">{mapContent}</div>
      </div>
    )
  }

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

      {searchContent}
    </div>
  )
}
