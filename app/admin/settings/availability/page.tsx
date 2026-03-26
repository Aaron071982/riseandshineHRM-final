'use client'

import { useState, useEffect, useMemo } from 'react'
import { previewAvailabilitySlots } from '@/lib/interview-slot-preview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save, Calendar, Plus, X, Video, User } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import Link from 'next/link'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// 7:00 AM through 8:00 PM in 30-min steps
const TIME_OPTIONS: { hour: number; minute: number; label: string }[] = []
for (let h = 7; h <= 20; h++) {
  for (const m of [0, 30]) {
    if (h === 20 && m === 30) break
    const pad = m === 0 ? '00' : '30'
    const label = h < 12 ? `${h}:${pad} AM` : h === 12 ? `12:${pad} PM` : `${h - 12}:${pad} PM`
    TIME_OPTIONS.push({ hour: h, minute: m, label })
  }
}

type Range = { startHour: number; startMinute: number; endHour: number; endMinute: number }
type DayState = { dayOfWeek: number; dayName: string; enabled: boolean; ranges: Range[] }

type MyAvailability = {
  acceptInterviewBookings: boolean
  slotDurationMinutes: number
  bufferMinutes: number
  availability: DayState[]
}

type UpcomingItem = {
  id: string
  scheduledAt: string
  durationMinutes: number
  meetingUrl: string | null
  rbtProfile: { id: string; firstName: string; lastName: string } | null
}

const defaultDay = (dayOfWeek: number): DayState => ({
  dayOfWeek,
  dayName: DAY_NAMES[dayOfWeek],
  enabled: false,
  ranges: [{ startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 }],
})

const buildDefaultData = (): MyAvailability => ({
  acceptInterviewBookings: true,
  slotDurationMinutes: 15,
  bufferMinutes: 0,
  availability: DAY_NAMES.map((_, dayOfWeek) => defaultDay(dayOfWeek)),
})

export default function AvailabilitySettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<MyAvailability>(buildDefaultData())
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const myRes = await fetch('/api/admin/availability/my', { credentials: 'include' })
        if (myRes.ok) {
          const myData = await myRes.json()
          setData(myData)
        } else if (myRes.status === 401 || myRes.status === 403) {
          setData(buildDefaultData())
          showToast('You are not authorized to view admin availability settings', 'error')
          return
        } else {
          setData(buildDefaultData())
          showToast('Failed to load availability', 'error')
        }

        const upRes = await fetch('/api/admin/availability/upcoming', { credentials: 'include' })
        if (upRes.ok) {
          const up = await upRes.json()
          setUpcoming(up)
        }
      } catch {
        setData(buildDefaultData())
        showToast('Failed to load availability', 'error')
      } finally {
        setLoading(false)
      }
    }

    load()
    // Intentionally run once on mount to avoid toast/fetch loops.
    // `showToast` identity changes when toast state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (patch: Partial<MyAvailability>) => {
    setData({ ...data, ...patch })
  }

  const setDay = (dayOfWeek: number, updater: (d: DayState) => DayState) => {
    setData({
      ...data,
      availability: data.availability.map((d) => (d.dayOfWeek === dayOfWeek ? updater(d) : d)),
    })
  }

  const addRange = (dayOfWeek: number) => {
    setDay(dayOfWeek, (d) => ({
      ...d,
      ranges: [...d.ranges, { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 }],
    }))
  }

  const removeRange = (dayOfWeek: number, index: number) => {
    setDay(dayOfWeek, (d) => ({
      ...d,
      ranges: d.ranges.length > 1 ? d.ranges.filter((_, i) => i !== index) : d.ranges,
    }))
  }

  const updateRange = (dayOfWeek: number, index: number, field: keyof Range, value: number) => {
    setDay(dayOfWeek, (d) => ({
      ...d,
      ranges: d.ranges.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/availability/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          acceptInterviewBookings: data.acceptInterviewBookings,
          slotDurationMinutes: data.slotDurationMinutes,
          bufferMinutes: data.bufferMinutes,
          availability: data.availability.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            enabled: d.enabled,
            ranges: d.enabled ? d.ranges : [],
          })),
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(result.error || 'Failed to save', 'error')
        return
      }
      showToast('Your availability has been saved', 'success')
      const upRes = await fetch('/api/admin/availability/upcoming', { credentials: 'include' })
      if (upRes.ok) setUpcoming(await upRes.json())
    } catch {
      showToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const slotPreview = useMemo(() => {
    const av = data.availability.length === 7 ? data.availability : DAY_NAMES.map((_, i) => defaultDay(i))
    return previewAvailabilitySlots({
      acceptInterviewBookings: data.acceptInterviewBookings,
      slotDurationMinutes: data.slotDurationMinutes,
      bufferMinutes: data.bufferMinutes,
      availability: av.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        enabled: d.enabled,
        ranges: d.enabled ? d.ranges : [],
      })),
      daysAhead: 7,
    })
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  // Ensure we have 7 days
  const availability = data.availability.length === 7 ? data.availability : DAY_NAMES.map((_, i) => defaultDay(i))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
          <Calendar className="h-8 w-8 text-orange-600 dark:text-[var(--orange-primary)]" />
          Interview Availability
        </h1>
        <p className="mt-1 text-gray-600 dark:text-[var(--text-tertiary)]">
          Set the days and times you&apos;re available to conduct interviews. RBTs will see your name and available slots when scheduling.
        </p>
      </div>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Accept interview bookings</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            If OFF, your name won&apos;t appear to RBTs at all.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Checkbox
              id="acceptBookings"
              checked={data.acceptInterviewBookings}
              onCheckedChange={(c) => update({ acceptInterviewBookings: c === true })}
            />
            <Label htmlFor="acceptBookings" className="cursor-pointer">Accept interview bookings</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Weekly availability</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Enable days and set time ranges. You can add multiple windows per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availability.map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex flex-wrap items-start gap-4 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4"
            >
              <div className="flex items-center gap-2 min-w-[120px]">
                <Checkbox
                  id={`day-${day.dayOfWeek}`}
                  checked={day.enabled}
                  onCheckedChange={(c) => setDay(day.dayOfWeek, (d) => ({ ...d, enabled: c === true }))}
                />
                <Label htmlFor={`day-${day.dayOfWeek}`} className="cursor-pointer font-medium">{day.dayName}</Label>
              </div>
              {day.enabled && (
                <div className="flex-1 space-y-2">
                  {day.ranges.map((range, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <select
                        value={`${range.startHour}-${range.startMinute}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split('-').map(Number)
                          updateRange(day.dayOfWeek, idx, 'startHour', h)
                          updateRange(day.dayOfWeek, idx, 'startMinute', m)
                        }}
                        className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-2 py-1.5 text-sm dark:text-[var(--text-primary)]"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={`${t.hour}-${t.minute}`} value={`${t.hour}-${t.minute}`}>{t.label}</option>
                        ))}
                      </select>
                      <span className="text-gray-500 dark:text-[var(--text-tertiary)]">→</span>
                      <select
                        value={`${range.endHour}-${range.endMinute}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split('-').map(Number)
                          updateRange(day.dayOfWeek, idx, 'endHour', h)
                          updateRange(day.dayOfWeek, idx, 'endMinute', m)
                        }}
                        className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-2 py-1.5 text-sm dark:text-[var(--text-primary)]"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={`${t.hour}-${t.minute}`} value={`${t.hour}-${t.minute}`}>{t.label}</option>
                        ))}
                      </select>
                      {day.ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRange(day.dayOfWeek, idx)}
                          className="text-red-600 hover:text-red-700 p-1 rounded"
                          aria-label="Remove range"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRange(day.dayOfWeek)}
                    className="text-sm text-orange-600 dark:text-[var(--orange-primary)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add another time range
                  </button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Slot settings</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            How availability windows are split into bookable slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="duration">Interview duration</Label>
            <select
              id="duration"
              value={data.slotDurationMinutes}
              onChange={(e) => update({ slotDurationMinutes: Number(e.target.value) })}
              className="mt-2 block w-full max-w-[200px] rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm dark:text-[var(--text-primary)]"
            >
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="buffer">Buffer between interviews</Label>
            <select
              id="buffer"
              value={data.bufferMinutes}
              onChange={(e) => update({ bufferMinutes: Number(e.target.value) })}
              className="mt-2 block w-full max-w-[200px] rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm dark:text-[var(--text-primary)]"
            >
              {[0, 15, 30].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-dashed border-orange-300 dark:border-[var(--border-subtle)] bg-orange-50/40 dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Live preview (next 7 days)</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Sample slots that would be offered to candidates based on your current settings — updates as you change the form (nothing is saved until you click Save).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data.acceptInterviewBookings ? (
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              Turn on &quot;Accept interview bookings&quot; to preview slots.
            </p>
          ) : slotPreview.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              No slots in the next 7 days. Enable at least one day with a valid time range, or check duration/buffer settings.
            </p>
          ) : (
            <ul className="space-y-4 max-h-[min(24rem,50vh)] overflow-y-auto pr-1">
              {slotPreview.map((day) => (
                <li key={day.dateKey} className="rounded-lg border border-orange-100 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] p-3">
                  <div className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">{day.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {day.times.map((t, i) => (
                      <span
                        key={`${day.dateKey}-${i}`}
                        className="inline-block rounded-md bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 px-2 py-0.5 text-xs font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Upcoming interviews</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Interviews booked with you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-gray-500 dark:text-[var(--text-tertiary)] text-sm">No upcoming interviews.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                      {i.rbtProfile ? `${i.rbtProfile.firstName} ${i.rbtProfile.lastName}` : 'Unknown'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                      {new Date(i.scheduledAt).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.meetingUrl && (
                      <a
                        href={i.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
                      >
                        <Video className="h-3 w-3" /> Meeting
                      </a>
                    )}
                    {i.rbtProfile && (
                      <Link
                        href={`/admin/rbts/${i.rbtProfile.id}`}
                        className="text-sm text-orange-600 dark:text-[var(--orange-primary)] hover:underline"
                      >
                        View Profile
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
