'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import AvailabilityGridPreview from '@/components/admin/rbt-profile/AvailabilityGridPreview'
import { WEEKDAY_KEYS, WEEKEND_KEYS } from '@/lib/rbt-availability-validation'

const SLOT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const HOURS = Array.from({ length: 8 }, (_, i) => i + 14) // 14–21

function normalizeHm(s: string): string {
  const t = s.trim()
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return t
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function emptyWeekday(): Record<string, boolean> {
  return WEEKDAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<string, boolean>)
}

function emptyWeekend(): Record<string, boolean> {
  return WEEKEND_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<string, boolean>)
}

function parseAvailabilityDraft(aj: unknown): {
  weekday: Record<string, boolean>
  weekend: Record<string, boolean>
  earliestStartTime: string
  latestEndTime: string
} {
  const o = (aj && typeof aj === 'object' && !Array.isArray(aj) ? aj : {}) as Record<string, unknown>
  const wd = (o.weekday && typeof o.weekday === 'object' && o.weekday !== null ? o.weekday : {}) as Record<string, boolean>
  const we = (o.weekend && typeof o.weekend === 'object' && o.weekend !== null ? o.weekend : {}) as Record<string, boolean>
  return {
    weekday: { ...emptyWeekday(), ...wd },
    weekend: { ...emptyWeekend(), ...we },
    earliestStartTime: typeof o.earliestStartTime === 'string' ? o.earliestStartTime : '',
    latestEndTime: typeof o.latestEndTime === 'string' ? o.latestEndTime : '',
  }
}

export type AdminAvailabilitySaved = {
  availabilityJson: unknown
  preferredHoursRange: string | null
  scheduleCompleted: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rbtProfileId: string
  availabilityJson: unknown
  preferredHoursRange: string | null | undefined
  onSaved: (data: AdminAvailabilitySaved) => void
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function AdminRbtAvailabilityDialog({
  open,
  onOpenChange,
  rbtProfileId,
  availabilityJson,
  preferredHoursRange,
  onSaved,
  showToast,
}: Props) {
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [weekday, setWeekday] = useState<Record<string, boolean>>(emptyWeekday)
  const [weekend, setWeekend] = useState<Record<string, boolean>>(emptyWeekend)
  const [earliestStartTime, setEarliestStartTime] = useState('')
  const [latestEndTime, setLatestEndTime] = useState('')
  const [preferredHours, setPreferredHours] = useState('')
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())

  const draftPreview = useMemo(
    () => ({
      weekday,
      weekend,
      earliestStartTime: earliestStartTime.trim() || undefined,
      latestEndTime: latestEndTime.trim() || undefined,
    }),
    [weekday, weekend, earliestStartTime, latestEndTime]
  )

  useEffect(() => {
    if (!open) return
    const d = parseAvailabilityDraft(availabilityJson)
    setWeekday(d.weekday)
    setWeekend(d.weekend)
    setEarliestStartTime(d.earliestStartTime)
    setLatestEndTime(d.latestEndTime)
    setPreferredHours(preferredHoursRange?.trim() ?? '')
  }, [open, availabilityJson, preferredHoursRange])

  useEffect(() => {
    if (!open || !rbtProfileId) return
    let cancelled = false
    ;(async () => {
      setLoadingSlots(true)
      try {
        const res = await fetch(`/api/admin/rbts/${rbtProfileId}/availability`, { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const slots: Array<{ dayOfWeek: number; hour: number }> = data.slots || []
        const keys = new Set(slots.map((s) => `${s.dayOfWeek}-${s.hour}`))
        setSelectedSlots(keys)
      } catch {
        if (!cancelled) setSelectedSlots(new Set())
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, rbtProfileId])

  const toggleSlot = (dayOfWeek: number, hour: number) => {
    const key = `${dayOfWeek}-${hour}`
    setSelectedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatHour = (hour: number) => {
    if (hour === 12) return '12:00 PM'
    if (hour < 12) return `${hour}:00 AM`
    return `${hour - 12}:00 PM`
  }

  const handleSave = async () => {
    const es = earliestStartTime.trim() ? normalizeHm(earliestStartTime) : null
    const le = latestEndTime.trim() ? normalizeHm(latestEndTime) : null
    const availabilityJsonPayload = {
      weekday,
      weekend,
      earliestStartTime: es,
      latestEndTime: le,
    }

    const slots = Array.from(selectedSlots).map((key) => {
      const [dayOfWeek, hour] = key.split('-').map(Number)
      return { dayOfWeek, hour }
    })

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          availabilityJson: availabilityJsonPayload,
          preferredHoursRange: preferredHours.trim() || null,
          slots,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to save availability', 'error')
        return
      }
      onSaved({
        availabilityJson: data.availabilityJson ?? availabilityJsonPayload,
        preferredHoursRange: data.preferredHoursRange ?? (preferredHours.trim() || null),
        scheduleCompleted: !!data.scheduleCompleted,
      })
      showToast('Availability and schedule saved', 'success')
      onOpenChange(false)
    } catch {
      showToast('Failed to save availability', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit availability &amp; schedule</DialogTitle>
          <DialogDescription>
            Update application-style weekly availability and the hourly session grid (same as the RBT portal, 2 PM–9 PM).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">Application availability</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-[var(--text-tertiary)] mb-2">Weekdays</p>
                <div className="space-y-2">
                  {WEEKDAY_KEYS.map((day) => (
                    <div key={day} className="flex items-center gap-2">
                      <Checkbox
                        id={`wd-${day}`}
                        checked={!!weekday[day]}
                        onCheckedChange={(c) => setWeekday((prev) => ({ ...prev, [day]: c === true }))}
                      />
                      <Label htmlFor={`wd-${day}`} className="text-sm font-normal cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-[var(--text-tertiary)] mb-2">Weekend</p>
                <div className="space-y-2">
                  {WEEKEND_KEYS.map((day) => (
                    <div key={day} className="flex items-center gap-2">
                      <Checkbox
                        id={`we-${day}`}
                        checked={!!weekend[day]}
                        onCheckedChange={(c) => setWeekend((prev) => ({ ...prev, [day]: c === true }))}
                      />
                      <Label htmlFor={`we-${day}`} className="text-sm font-normal cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label>Earliest start (HH:mm)</Label>
                <Input
                  value={earliestStartTime}
                  onChange={(e) => setEarliestStartTime(e.target.value)}
                  placeholder="09:00"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Latest end (HH:mm)</Label>
                <Input
                  value={latestEndTime}
                  onChange={(e) => setLatestEndTime(e.target.value)}
                  placeholder="17:00"
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>Preferred weekly hours (optional)</Label>
              <Input
                value={preferredHours}
                onChange={(e) => setPreferredHours(e.target.value)}
                placeholder="e.g. 20-30"
                className="mt-1"
              />
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-orange-200 p-3 bg-orange-50/40 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">Preview</p>
              <AvailabilityGridPreview availabilityJson={draftPreview} />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">Session schedule (hourly slots)</h4>
            <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mb-2">
              Toggle cells for each hour block (2 PM – 9 PM). This matches what the RBT sets in their portal.
            </p>
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading schedule…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="grid grid-cols-8 gap-2">
                    <div className="font-semibold text-sm text-gray-700 p-2">Time</div>
                    {SLOT_DAYS.map((day, index) => (
                      <div key={index} className="font-semibold text-sm text-gray-700 p-2 text-center">
                        {day.substring(0, 3)}
                      </div>
                    ))}
                    {HOURS.map((hour) => (
                      <React.Fragment key={hour}>
                        <div className="text-sm text-gray-600 p-2 border-r">
                          {formatHour(hour)} – {formatHour(hour + 1)}
                        </div>
                        {SLOT_DAYS.map((_, dayOfWeek) => {
                          const key = `${dayOfWeek}-${hour}`
                          const isSelected = selectedSlots.has(key)
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleSlot(dayOfWeek, hour)}
                              className={`h-12 border rounded-lg transition-all flex items-center justify-center ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600'
                                  : 'bg-white border-gray-300 hover:bg-orange-50 hover:border-orange-300 dark:bg-[var(--bg-primary)] dark:border-[var(--border-subtle)]'
                              }`}
                            >
                              {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 text-gray-400" />}
                            </button>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {selectedSlots.size} slot{selectedSlots.size !== 1 ? 's' : ''} selected per week
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || loadingSlots} className="bg-orange-600 hover:bg-orange-700">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
