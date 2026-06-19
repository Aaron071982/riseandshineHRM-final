'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatHours } from '@/lib/billing/format'

type ExcludedEntry = {
  id: string
  providerNameRaw: string
  role: string | null
  totalSessions: number
  totalHours: number
}

export default function ExcludedProvidersSection({ entries }: { entries: ExcludedEntry[] }) {
  const [open, setOpen] = useState(false)

  if (entries.length === 0) return null

  const totalHours = entries.reduce((s, e) => s + e.totalHours, 0)
  const totalSessions = entries.reduce((s, e) => s + e.totalSessions, 0)

  return (
    <div className="mt-6 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50 dark:bg-[var(--bg-elevated)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium text-sm">Excluded (non-RBT)</span>
          <span className="text-xs text-gray-500">
            {entries.length} providers · {totalSessions} sessions · {formatHours(totalHours)} hrs
          </span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4 text-right">Sessions</th>
                <th className="pb-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-200 dark:border-[var(--border-subtle)]">
                  <td className="py-2 pr-4">{e.providerNameRaw}</td>
                  <td className="py-2 pr-4">{e.role ?? '—'}</td>
                  <td className="py-2 pr-4 text-right">{e.totalSessions}</td>
                  <td className="py-2 text-right">{formatHours(e.totalHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
