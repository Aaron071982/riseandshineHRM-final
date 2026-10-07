'use client'

import { useMemo, useState } from 'react'
import { Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
import type { ScheduleSlot } from '@/lib/schedule/types'
import { DAYS, DAY_LABEL, findConflicts, fmtH, inputToMin, minToInput, type Day } from '@/lib/schedule/utils'
import { useScheduleMutations } from '../scheduleMutations'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export default function SessionInlineRow({
  slot,
  title,
  allSlots,
  conflictReasons,
  onSaved,
  onDeleted,
  onOpenEditor,
}: {
  slot: ScheduleSlot
  title: string
  allSlots: ScheduleSlot[]
  conflictReasons: string[] | undefined
  onSaved: (slot: ScheduleSlot) => void
  onDeleted: (id: string) => void
  onOpenEditor: (slot: ScheduleSlot) => void
}) {
  const { showToast } = useToast()
  const { updateSlot, deleteSlot } = useScheduleMutations()
  const [day, setDay] = useState<Day>(slot.day as Day)
  const [start, setStart] = useState(minToInput(slot.startMin))
  const [end, setEnd] = useState(minToInput(slot.endMin))
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)

  const startMin = inputToMin(start)
  const endMin = inputToMin(end)
  const dirty = day !== slot.day || startMin !== slot.startMin || endMin !== slot.endMin
  const valid = Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin

  const draftConflicts = useMemo(() => {
    if (!dirty || !valid) return []
    const draft = { ...slot, day, startMin, endMin }
    return findConflicts(allSlots.map((s) => (s.id === slot.id ? draft : s))).get(slot.id) ?? []
  }, [dirty, valid, slot, day, startMin, endMin, allSlots])

  const shownConflicts = dirty ? draftConflicts : conflictReasons ?? []

  const save = async () => {
    if (!valid || !dirty) return
    setBusy('save')
    try {
      onSaved(await updateSlot(slot.id, { day, startMin, endMin }))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete ${title} ${DAY_LABEL[slot.day as Day]} ${minToInput(slot.startMin)}–${minToInput(slot.endMin)}?`)) return
    setBusy('delete')
    try {
      await deleteSlot(slot.id)
      onDeleted(slot.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
      setBusy(null)
    }
  }

  const reset = () => {
    setDay(slot.day as Day)
    setStart(minToInput(slot.startMin))
    setEnd(minToInput(slot.endMin))
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        shownConflicts.length ? 'border-[var(--urgent)] bg-[var(--urgent-bg)]/50' : 'border-[var(--line)] bg-white'
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--ink)]">{title}</span>
        <span className="text-[11px] tabular-nums text-[var(--muted-ink)]">
          {valid ? `${fmtH((endMin - startMin) / 60)}h` : '—'}
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--muted-ink)] hover:bg-[var(--line-2)]"
          title="Status, note and client"
          aria-label="Open full session editor"
          onClick={() => onOpenEditor(slot)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--muted-ink)] hover:bg-[var(--urgent-bg)] hover:text-[var(--urgent)]"
          title="Delete session"
          aria-label="Delete session"
          disabled={busy !== null}
          onClick={() => void remove()}
        >
          {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Day"
          value={day}
          onChange={(e) => setDay(e.target.value as Day)}
          className="h-7 rounded-md border border-[var(--line)] bg-white px-1 text-[12px]"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {DAY_LABEL[d]}
            </option>
          ))}
        </select>
        <input
          aria-label="Start time"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-[var(--line)] px-1 text-[12px] tabular-nums"
        />
        <span className="text-[11px] text-[var(--muted-ink)]">–</span>
        <input
          aria-label="End time"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-[var(--line)] px-1 text-[12px] tabular-nums"
        />
      </div>
      {!valid && <p className="mt-1 text-[11px] text-[var(--urgent)]">End must be after start.</p>}
      {shownConflicts.length > 0 && (
        <p className="mt-1 text-[11px] font-medium text-[var(--urgent)]">⚠ {shownConflicts.join('; ')}</p>
      )}
      {dirty && (
        <div className="mt-1.5 flex justify-end gap-1.5">
          <button type="button" onClick={reset} className="h-6 rounded-md px-2 text-[11.5px] text-[var(--muted-ink)] hover:bg-[var(--line-2)]">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy !== null}
            onClick={() => void save()}
            className="flex h-6 items-center gap-1 rounded-md bg-[var(--brand)] px-2.5 text-[11.5px] font-medium text-white disabled:opacity-50"
          >
            {busy === 'save' && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      )}
    </div>
  )
}
