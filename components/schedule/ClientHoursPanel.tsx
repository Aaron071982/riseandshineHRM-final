'use client'

import { useMemo, useState } from 'react'
import type { ScheduleSlot, ScheduleClient } from '@/lib/schedule/types'
import { hoursOf, fmtH } from '@/lib/schedule/utils'
import { updateClientMeta } from '@/lib/schedule/actions'
import { useToast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'

type EditField = 'bcba' | 'insurance' | 'authorized'

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
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null)
  const [saving, setSaving] = useState(false)

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

  const save = async (
    clientId: string,
    field: EditField,
    raw: string,
    current: ScheduleClient
  ) => {
    const trimmed = raw.trim()
    setSaving(true)
    try {
      if (field === 'authorized') {
        const hours = trimmed === '' ? null : parseFloat(trimmed)
        if (hours != null && (isNaN(hours) || hours < 0 || hours > 168)) {
          showToast('Enter a valid hours value (0–168)', 'error')
          return
        }
        if (hours === current.authorizedHoursPerWeek) {
          setEditing(null)
          return
        }
        await updateClientMeta(clientId, { authorizedHoursPerWeek: hours })
      } else if (field === 'bcba') {
        const next = trimmed === '' ? null : trimmed
        if (next === (current.bcba ?? null)) {
          setEditing(null)
          return
        }
        await updateClientMeta(clientId, { bcba: next })
      } else {
        const next = trimmed === '' ? null : trimmed
        if (next === (current.insurance ?? null)) {
          setEditing(null)
          return
        }
        await updateClientMeta(clientId, { insurance: next })
      }
      showToast('Saved', 'success')
      setEditing(null)
      onRefresh()
    } catch {
      showToast('Update failed', 'error')
    } finally {
      setSaving(false)
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

  const editableCell = (
    r: (typeof rows)[number],
    field: EditField,
    display: string,
    inputClassName: string,
    inputType: 'text' | 'number' = 'text'
  ) => {
    const isEditing = editing?.id === r.id && editing.field === field
    if (isEditing) {
      return (
        <Input
          type={inputType}
          step={inputType === 'number' ? '0.5' : undefined}
          className={inputClassName}
          defaultValue={display === '—' || display === 'Set…' ? '' : display}
          autoFocus
          disabled={saving}
          onBlur={(e) => void save(r.id, field, e.target.value, r)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save(r.id, field, (e.target as HTMLInputElement).value, r)
            if (e.key === 'Escape') setEditing(null)
          }}
        />
      )
    }
    return (
      <button
        type="button"
        className="w-full text-left hover:underline decoration-dotted underline-offset-2 disabled:opacity-50"
        disabled={saving}
        onClick={() => setEditing({ id: r.id, field })}
        title={`Edit ${field}`}
      >
        {display}
      </button>
    )
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
              <td className="p-3 text-gray-700 min-w-[9rem]">
                {editableCell(r, 'bcba', r.bcba?.trim() || '—', 'h-8 w-full text-sm')}
              </td>
              <td className="p-3 text-gray-700 min-w-[11rem]">
                {editableCell(r, 'insurance', r.insurance?.trim() || '—', 'h-8 w-full text-sm')}
              </td>
              <td className="p-3 text-right tabular-nums font-medium">{fmtH(r.scheduled)}</td>
              <td className="p-3 text-right min-w-[6rem]">
                {editableCell(
                  r,
                  'authorized',
                  r.authorized != null ? String(r.authorized) : 'Set…',
                  'h-8 w-20 ml-auto text-right',
                  'number'
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
      <p className="text-xs text-gray-400 px-3 py-2 border-t border-[#E4E8E9]">
        Click BCBA, Insurance, or Authorized/wk to edit. Enter to save, Esc to cancel.
      </p>
    </div>
  )
}
