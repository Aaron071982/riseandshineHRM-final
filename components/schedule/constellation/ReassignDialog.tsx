'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { ScheduleSlot } from '@/lib/schedule/types'
import { DAY_LABEL, fmtH, rangeShort, type Day } from '@/lib/schedule/utils'
import {
  BAND_META,
  pairKey,
  previewReassignment,
  utilizationBand,
  type ConstellationModel,
} from '@/lib/schedule/constellation'
import { updateSlot } from '@/lib/schedule/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type ReassignRequest = {
  clientId: string
  /** Therapists currently serving the client that could give up sessions. */
  fromCandidates: string[]
  toTherapistId: string
}

function HoursChange({ name, before, after, target }: { name: string; before: number; after: number; target: number }) {
  const bBefore = BAND_META[utilizationBand(before, target)]
  const bAfter = BAND_META[utilizationBand(after, target)]
  return (
    <div className="rounded-lg border border-[var(--line)] px-3 py-2">
      <p className="truncate text-[12.5px] font-semibold text-[var(--espresso)]">{name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] tabular-nums">
        <span style={{ color: bBefore.color }}>
          {bBefore.symbol} {before.toFixed(1)}
        </span>
        <ArrowRight className="h-3 w-3 text-[var(--muted-ink)]" aria-hidden />
        <span className="font-semibold" style={{ color: bAfter.color }}>
          {bAfter.symbol} {after.toFixed(1)}
        </span>
        <span className="text-[var(--muted-ink)]">/ {fmtH(target)} hrs</span>
      </p>
      <p className="text-[11px]" style={{ color: bAfter.color }}>
        {bAfter.short}
      </p>
    </div>
  )
}

export default function ReassignDialog({
  request,
  model,
  slots,
  onCancel,
  onDone,
}: {
  request: ReassignRequest
  model: ConstellationModel
  slots: ScheduleSlot[]
  onCancel: () => void
  onDone: (result: { moved: number; failed: string[] }) => void
}) {
  const [fromId, setFromId] = useState(request.fromCandidates[0] ?? '')
  const pair = model.pairs.get(pairKey(fromId, request.clientId))
  const [checked, setChecked] = useState<Set<string>>(() => new Set(pair?.slots.map((s) => s.id) ?? []))
  const [saving, setSaving] = useState(false)

  const changeFrom = (id: string) => {
    setFromId(id)
    setChecked(new Set(model.pairs.get(pairKey(id, request.clientId))?.slots.map((s) => s.id) ?? []))
  }

  const preview = useMemo(
    () =>
      previewReassignment({
        slots,
        movingSlotIds: [...checked],
        fromTherapistId: fromId,
        toTherapistId: request.toTherapistId,
        model,
      }),
    [slots, checked, fromId, request.toTherapistId, model]
  )

  const clientName = model.clients.get(request.clientId)?.client.name ?? 'Client'
  const name = (id: string) => model.therapists.get(id)?.therapist.name ?? 'Therapist'

  const confirm = async () => {
    setSaving(true)
    const failed: string[] = []
    let moved = 0
    for (const s of preview.movingSlots) {
      try {
        await updateSlot(s.id, { therapistId: request.toTherapistId })
        moved++
      } catch (e) {
        failed.push(`${DAY_LABEL[s.day as Day]} ${rangeShort(s.startMin, s.endMin)}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    setSaving(false)
    onDone({ moved, failed })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            Move {clientName} to {name(request.toTherapistId)}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {request.fromCandidates.length > 1 && (
            <label className="block text-[12.5px] text-[var(--muted-ink)]">
              Move sessions currently with
              <select
                className="ml-2 h-8 rounded-md border border-[var(--line)] bg-white px-2 text-[12.5px] text-[var(--ink)]"
                value={fromId}
                onChange={(e) => changeFrom(e.target.value)}
              >
                {request.fromCandidates.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-ink)]">Sessions that move</p>
            <div className="space-y-1">
              {(pair?.slots ?? []).map((s) => {
                const newConflict = preview.newConflicts.get(s.id)
                return (
                  <label key={s.id} className="flex items-start gap-2 rounded-md px-1 py-0.5 text-[13px] hover:bg-[var(--line-2)]">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked.has(s.id)}
                      onChange={(e) =>
                        setChecked((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(s.id)
                          else next.delete(s.id)
                          return next
                        })
                      }
                    />
                    <span className="tabular-nums">
                      {DAY_LABEL[s.day as Day]} {rangeShort(s.startMin, s.endMin)}
                      <span className="text-[var(--muted-ink)]"> · {fmtH((s.endMin - s.startMin) / 60)}h</span>
                      {newConflict && checked.has(s.id) && (
                        <span className="block text-[12px] font-medium text-[var(--urgent)]">⚠ New conflict: {newConflict.join('; ')}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HoursChange name={name(fromId)} before={preview.from.hoursBefore} after={preview.from.hoursAfter} target={preview.from.target} />
            <HoursChange name={name(request.toTherapistId)} before={preview.to.hoursBefore} after={preview.to.hoursAfter} target={preview.to.target} />
          </div>

          {preview.newConflicts.size > 0 ? (
            <p className="rounded-md bg-[var(--urgent-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--urgent)]">
              ⚠ {preview.newConflicts.size} session{preview.newConflicts.size === 1 ? '' : 's'} would create a new conflict. You can still
              move them and fix the time afterwards.
            </p>
          ) : (
            <p className="text-[12.5px] text-[var(--green)]">No new conflicts.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button className="bg-[var(--brand)] text-white hover:bg-[var(--brand-2)]" disabled={saving || checked.size === 0} onClick={() => void confirm()}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Move {checked.size} session{checked.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
