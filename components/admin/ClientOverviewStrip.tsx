'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function ClientOverviewStrip() {
  const [data, setData] = useState<{
    activeClients: number
    noRbtAssigned: number
    authExpiringSoon: number
    newIntakeThisMonth: number
    hoursRunningLow: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard/client-stats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Link
        href="/admin/clients"
        className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <p className="text-sm text-gray-500">Active Clients</p>
        <p className="text-2xl font-bold">{data.activeClients}</p>
      </Link>
      <div
        className={cn(
          'rounded-xl border p-4 shadow-sm',
          data.noRbtAssigned > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'bg-white dark:bg-[var(--bg-elevated)]'
        )}
      >
        <p className="text-sm text-gray-500">No RBT Assigned</p>
        <p className={cn('text-2xl font-bold', data.noRbtAssigned > 0 && 'text-red-700')}>
          {data.noRbtAssigned}
        </p>
      </div>
      <div
        className={cn(
          'rounded-xl border p-4 shadow-sm',
          data.authExpiringSoon > 0 ? 'border-amber-300 bg-amber-50' : 'bg-white dark:bg-[var(--bg-elevated)]'
        )}
      >
        <p className="text-sm text-gray-500">Auth expiring soon</p>
        <p className={cn('text-2xl font-bold', data.authExpiringSoon > 0 && 'text-amber-800')}>
          {data.authExpiringSoon}
        </p>
      </div>
      <div className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm">
        <p className="text-sm text-gray-500">New intake (month)</p>
        <p className="text-2xl font-bold">{data.newIntakeThisMonth}</p>
      </div>
    </div>
  )
}
