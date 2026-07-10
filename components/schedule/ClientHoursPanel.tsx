'use client'

import { useMemo, useState } from 'react'
import type { ScheduleSlot, ScheduleClient } from '@/lib/schedule/types'
import { hoursOf, fmtH } from '@/lib/schedule/utils'
import { setAuthorizedHours } from '@/lib/schedule/actions'
import { useToast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function ClientHoursPanel({
  clients,
  slots,
  onRefresh,
}: {
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  onRefresh: () => void
}) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState<string | null>(null)

  const rows = useMemo(() => {
    return clients
      .filter((c) => c.active)
      .map((c) => {
        const scheduled = slots
          .filter((s) => s.clientId === c.id && s.status !== 'CANCELLED')
          .reduce((a, s) => a + hoursOf(s), 0)
        const authorized = c.authorizedHoursPerWeek
        const gap = authorized != null ? authorized - scheduled : null
        return { ...c, scheduled, authorized, gap }
      })
      .sort((a, b) => {
        const ga = a.gap ?? -999
        const gb = b.gap ?? -999
        return gb - ga
      })
  }, [clients, slots])

  const saveAuth = async (clientId: string, value: string) => {
    const hours = value.trim() === '' ? null : parseFloat(value)
    if (hours != null && (isNaN(hours) || hours < 0)) return
    try {
      await setAuthorizedHours(clientId, hours)
      showToast('Authorized hours updated', 'success')
      setEditing(null)
      onRefresh()
    } catch {
      showToast('Update failed', 'error')
    }
  }

  const gapBadge = (gap: number | null) => {
    if (gap == null) return <span className="text-gray-400">—</span>
    if (Math.abs(gap) < 0.5)
      return <span className="text-green-600 font-medium tabular-nums">On target</span>
    if (gap > 0)
      return <span className="text-amber-600 font-medium tabular-nums">−{fmtH(gap)} under</span>
    return <span className="text-red-600 font-medium tabular-nums">+{fmtH(-gap)} over</span>
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-[#E4E8E9] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F4F6F6]">
          <tr>
            <th className="text-left p-3">Client</th>
            <th className="text-left p-3">BCBA</th>
            <th className="text-left p-3">Insurance</th>
            <th className="text-right p-3">Scheduled</th>
            <th className="text-right p-3">Authorized/wk</th>
            <th className="text-right p-3">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#E4E8E9]">
              <td className="p-3">
                <div className="font-medium">{r.name}</div>
                {r.code && <span className="text-xs text-gray-400">{r.code}</span>}
              </td>
              <td className="p-3 text-gray-500">{r.bcba ?? '—'}</td>
              <td className="p-3 text-gray-500">{r.insurance ?? '—'}</td>
              <td className="p-3 text-right tabular-nums font-medium">{fmtH(r.scheduled)}</td>
              <td className="p-3 text-right">
                {editing === r.id ? (
                  <Input
                    type="number"
                    step="0.5"
                    className="h-8 w-20 ml-auto text-right"
                    defaultValue={r.authorized ?? ''}
                    autoFocus
                    onBlur={(e) => saveAuth(r.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveAuth(r.id, (e.target as HTMLInputElement).value)}
                  />
                ) : (
                  <button
                    type="button"
                    className="tabular-nums hover:underline"
                    onClick={() => setEditing(r.id)}
                  >
                    {r.authorized != null ? fmtH(r.authorized) : 'Set…'}
                  </button>
                )}
              </td>
              <td className="p-3 text-right">{gapBadge(r.gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-center text-gray-500 py-12">No clients — add them in Manage.</p>
      )}
    </div>
  )
}
