'use client'

import { useMemo, useState } from 'react'
import type { ScheduleSlot, ScheduleTherapist, ScheduleClient } from '@/lib/schedule/types'
import {
  DAYS,
  DAY_LABEL,
  hoursOf,
  fmtH,
  minToInput,
  inputToMin,
  findConflicts,
  type Day,
} from '@/lib/schedule/utils'
import { createSlot, updateSlot, deleteSlot } from '@/lib/schedule/actions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function SessionEditor({
  mode,
  slot,
  defaults,
  therapists,
  clients,
  conflicts,
  onClose,
  onSaved,
  onDeleted,
}: {
  mode: 'create' | 'edit'
  slot?: ScheduleSlot
  defaults?: Partial<ScheduleSlot>
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  conflicts: Map<string, string[]>
  onClose: () => void
  onSaved: (slot: ScheduleSlot, isNew: boolean) => void
  onDeleted: (id: string) => void
}) {
  const { showToast } = useToast()
  const [therapistId, setTherapistId] = useState(
    slot?.therapistId ?? defaults?.therapistId ?? therapists[0]?.id ?? ''
  )
  const [clientId, setClientId] = useState(
    slot?.clientId ?? defaults?.clientId ?? clients[0]?.id ?? ''
  )
  const [day, setDay] = useState<Day>((slot?.day ?? defaults?.day ?? 'MON') as Day)
  const [start, setStart] = useState(minToInput(slot?.startMin ?? defaults?.startMin ?? 840))
  const [end, setEnd] = useState(minToInput(slot?.endMin ?? defaults?.endMin ?? 1080))
  const [status, setStatus] = useState<string>(slot?.status ?? defaults?.status ?? 'CONFIRMED')
  const [note, setNote] = useState(slot?.note ?? '')
  const [saving, setSaving] = useState(false)

  const startMin = inputToMin(start)
  const endMin = inputToMin(end)
  const valid = therapistId && clientId && endMin > startMin
  const liveHours = valid ? fmtH((endMin - startMin) / 60) : '—'

  const wouldConflict = useMemo(() => {
    if (!valid) return [] as string[]
    const draft = {
      id: slot?.id ?? 'draft',
      therapistId,
      clientId,
      day,
      startMin,
      endMin,
      status,
    }
    const others = slot ? [] : []
    const map = findConflicts([draft, ...others])
    return map.get('draft') ?? []
  }, [valid, slot, therapistId, clientId, day, startMin, endMin, status])

  const existingConflict = slot ? conflicts.get(slot.id) : undefined

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const payload = {
        therapistId,
        clientId,
        day,
        startMin,
        endMin,
        status,
        note: note || null,
      }
      if (mode === 'edit' && slot) {
        const updated = await updateSlot(slot.id, payload)
        onSaved(updated as ScheduleSlot, false)
      } else {
        const created = await createSlot(payload)
        onSaved(created as ScheduleSlot, true)
      }
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!slot || !confirm('Delete this session?')) return
    setSaving(true)
    try {
      await deleteSlot(slot.id)
      onDeleted(slot.id)
      onClose()
    } catch {
      showToast('Delete failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit session' : 'Add session'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Therapist</Label>
            <Select value={therapistId} onValueChange={setTherapistId}>
              <SelectTrigger>
                <SelectValue placeholder="Select therapist" />
              </SelectTrigger>
              <SelectContent>
                {therapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Day</Label>
            <Select value={day} onValueChange={(v) => setDay(v as Day)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DAY_LABEL[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-[#E7A13A] font-semibold tabular-nums">{liveHours} hours</p>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['CONFIRMED', 'TENTATIVE', 'NEEDS_REVIEW', 'CANCELLED'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          {(wouldConflict.length > 0 || existingConflict?.length) && (
            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
              ⚠ {(wouldConflict.length ? wouldConflict : existingConflict)?.join('; ')}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {mode === 'edit' && (
            <Button variant="destructive" onClick={remove} disabled={saving}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-[#0E4D52]" onClick={save} disabled={!valid || saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
