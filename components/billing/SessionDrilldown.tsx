'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatHours } from '@/lib/billing/format'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import SessionStatusBadge from '@/components/billing/SessionStatusBadge'

type Session = {
  id: string
  clientName: string
  dos: string
  actualMinutes: number
  procedureCode: string | null
  location: string | null
  sessionStatus: string | null
}

export default function SessionDrilldown({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = useState(false)

  if (sessions.length === 0) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[#0D9488] font-medium"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded border border-gray-200 dark:border-[var(--border-subtle)]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Client</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-right">Hours</th>
                <th className="px-2 py-1 text-left">Code</th>
                <th className="px-2 py-1 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 dark:border-[var(--border-subtle)]">
                  <td className="px-2 py-1">{formatCalendarDate(s.dos)}</td>
                  <td className="px-2 py-1">{s.clientName}</td>
                  <td className="px-2 py-1">
                    <SessionStatusBadge status={s.sessionStatus} />
                  </td>
                  <td className="px-2 py-1 text-right">{formatHours(s.actualMinutes / 60)}</td>
                  <td className="px-2 py-1">{s.procedureCode ?? '—'}</td>
                  <td className="px-2 py-1">{s.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
