'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import {
  PAYABLE_STATUS_OPTIONS,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'

export default function PayableStatusesControl({
  cycleId,
  cycleLocked,
  initialStatuses,
  onUpdated,
}: {
  cycleId: string
  cycleLocked: boolean
  initialStatuses: ArtemisSessionStatusKey[]
  onUpdated: () => void | Promise<void>
}) {
  const [selected, setSelected] = useState<Set<ArtemisSessionStatusKey>>(new Set(initialStatuses))
  const [loading, setLoading] = useState(false)

  const toggle = async (key: ArtemisSessionStatusKey, checked: boolean) => {
    if (cycleLocked) return
    const next = new Set(selected)
    if (checked) next.add(key)
    else next.delete(key)
    if (next.size === 0) return
    setSelected(next)
    setLoading(true)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}/payable-statuses`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payableStatuses: Array.from(next) }),
      })
      if (res.ok) await onUpdated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-teal-200 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-semibold text-sm text-gray-900 dark:text-[var(--text-primary)]">
          Payable Statuses
        </p>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-[#0D9488]" />}
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Choose which session statuses count toward pay this cycle. Cancelled and Deleted are always
        excluded.
      </p>
      <div className="flex flex-wrap gap-4">
        {PAYABLE_STATUS_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={selected.has(opt.key)}
              disabled={cycleLocked || loading}
              onCheckedChange={(v) => void toggle(opt.key, v === true)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
