'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function RbtOverviewStrip() {
  const [data, setData] = useState<{
    hiredRBTs: number
    inPipeline: number
    awaitingArtemis: number
    onboardingComplete: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard/rbt-stats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return null

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
        <Link
          href="/training/dashboard"
          className="font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
        >
          Artemis training portal
        </Link>
        <span className="text-gray-500 dark:text-gray-400"> — schedule sessions and mark attendance.</span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/admin/rbts"
          className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="text-sm text-gray-500">Hired RBTs</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-500">{data.hiredRBTs}</p>
        </Link>
        <Link
          href="/admin/rbts"
          className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="text-sm text-gray-500">In pipeline</p>
          <p className="text-2xl font-bold">{data.inPipeline}</p>
        </Link>
        <Link
          href="/training/dashboard"
          className={cn(
            'rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow',
            data.awaitingArtemis > 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'bg-white dark:bg-[var(--bg-elevated)]'
          )}
        >
          <p className="text-sm text-gray-500">Awaiting Artemis</p>
          <p className={cn('text-2xl font-bold', data.awaitingArtemis > 0 && 'text-amber-800 dark:text-amber-200')}>
            {data.awaitingArtemis}
          </p>
        </Link>
        <Link
          href="/admin/rbts"
          className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="text-sm text-gray-500">Onboarding complete</p>
          <p className="text-2xl font-bold">{data.onboardingComplete}</p>
        </Link>
      </div>
    </div>
  )
}
