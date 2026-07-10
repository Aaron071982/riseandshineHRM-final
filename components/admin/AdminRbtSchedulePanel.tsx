'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Pencil, Plus, Trash2, MapPin, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import WeeklyScheduleCalendar from '@/components/schedule/WeeklyScheduleCalendar'
import {
  CALENDAR_DAY_ORDER,
  DAY_LABELS,
  DAY_SHORT,
  formatTime12h,
  hoursBetween,
  weeklyHours,
  type ScheduleAssignmentDTO,
} from '@/lib/rbt-schedule/utils'

type FormState = {
  id?: string
  clientName: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  location: string
  notes: string
}

const emptyForm = (): FormState => ({
  clientName: '',
  daysOfWeek: [],
  startTime: '14:00',
  endTime: '16:00',
  location: '',
  notes: '',
})

interface AdminRbtSchedulePanelProps {
  rbtProfileId: string
  rbtName: string
}

export default function AdminRbtSchedulePanel({ rbtProfileId, rbtName }: AdminRbtSchedulePanelProps) {
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState<ScheduleAssignmentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/schedule`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to load schedule', 'error')
        return
      }
      setAssignments(data.assignments ?? [])
    } catch {
      showToast('Failed to load schedule', 'error')
    } finally {
      setLoading(false)
    }
  }, [rbtProfileId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = (dayOfWeek?: number, startTime?: string) => {
    setEditingId(null)
    setForm({
      ...emptyForm(),
      daysOfWeek: dayOfWeek != null ? [dayOfWeek] : [],
      startTime: startTime ?? '14:00',
      endTime: startTime
        ? (() => {
            const [h, m] = startTime.split(':').map(Number)
            const endH = Math.min(h + 2, 20)
            return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
          })()
        : '16:00',
    })
    setDialogOpen(true)
  }

  const openEdit = (a: ScheduleAssignmentDTO) => {
    setEditingId(a.id)
    setForm({
      id: a.id,
      clientName: a.clientName,
      daysOfWeek: [a.dayOfWeek],
      startTime: a.startTime,
      endTime: a.endTime,
      location: a.location ?? '',
      notes: a.notes ?? '',
    })
    setDialogOpen(true)
  }

  const toggleDay = (day: number) => {
    if (editingId) {
      setForm((f) => ({ ...f, daysOfWeek: [day] }))
      return
    }
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }))
  }

  const handleSave = async () => {
    if (!form.clientName.trim()) {
      showToast('Client name is required', 'error')
      return
    }
    if (form.daysOfWeek.length === 0) {
      showToast('Select at least one day', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/schedule-assignments/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            clientName: form.clientName.trim(),
            dayOfWeek: form.daysOfWeek[0],
            startTime: form.startTime,
            endTime: form.endTime,
            location: form.location.trim() || null,
            notes: form.notes.trim() || null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.error || 'Failed to update', 'error')
          return
        }
        showToast('Assignment updated', 'success')
      } else {
        const res = await fetch(`/api/admin/rbts/${rbtProfileId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            clientName: form.clientName.trim(),
            daysOfWeek: form.daysOfWeek,
            startTime: form.startTime,
            endTime: form.endTime,
            location: form.location.trim() || null,
            notes: form.notes.trim() || null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.error || 'Failed to create', 'error')
          return
        }
        showToast(
          form.daysOfWeek.length > 1
            ? `Created ${form.daysOfWeek.length} assignments`
            : 'Assignment created',
          'success'
        )
      }
      setDialogOpen(false)
      await load()
    } catch {
      showToast('Failed to save assignment', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this assignment from the schedule?')) return
    try {
      const res = await fetch(`/api/admin/schedule-assignments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to delete', 'error')
        return
      }
      showToast('Assignment removed', 'success')
      if (editingId === id) setDialogOpen(false)
      await load()
    } catch {
      showToast('Failed to delete', 'error')
    }
  }

  const hours = weeklyHours(assignments)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
            Weekly schedule — {rbtName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] mt-0.5">
            Planning tool only — not linked to Artemis sessions or payroll.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-[var(--text-secondary)]">
            {assignments.length} slot{assignments.length === 1 ? '' : 's'} · {hours.toFixed(1)} hrs/wk
          </span>
          <Button size="sm" onClick={() => openCreate()} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Assignment
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <WeeklyScheduleCalendar
            assignments={assignments}
            onBlockClick={openEdit}
            onEmptyClick={(day, start) => openCreate(day, start)}
          />

          <Card className="border border-gray-200 dark:border-[var(--border-subtle)]">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Assignments</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {assignments.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No assignments yet. Add one or click an empty slot on the calendar.
                </p>
              ) : (
                assignments
                  .slice()
                  .sort((a, b) => {
                    const ao = CALENDAR_DAY_ORDER.indexOf(a.dayOfWeek as (typeof CALENDAR_DAY_ORDER)[number])
                    const bo = CALENDAR_DAY_ORDER.indexOf(b.dayOfWeek as (typeof CALENDAR_DAY_ORDER)[number])
                    return ao - bo || a.startTime.localeCompare(b.startTime)
                  })
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
                          {a.clientName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                          <span>{DAY_LABELS[a.dayOfWeek]}s</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime12h(a.startTime)}–{formatTime12h(a.endTime)}
                            <span className="text-gray-400">
                              ({hoursBetween(a.startTime, a.endTime).toFixed(1)}h)
                            </span>
                          </span>
                          {a.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {a.location}
                            </span>
                          )}
                        </p>
                        {a.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit assignment' : 'Add assignment'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this schedule block.'
                : 'Select multiple days to create one assignment per day.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                placeholder="Type client name"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>{editingId ? 'Day' : 'Day(s) of week'}</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_DAY_ORDER.map((d) => (
                  <label
                    key={d}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer ${
                      form.daysOfWeek.includes(d)
                        ? 'border-orange-400 bg-orange-50 text-orange-800 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)]'
                        : 'border-gray-200 dark:border-[var(--border-subtle)]'
                    }`}
                  >
                    <Checkbox
                      checked={form.daysOfWeek.includes(d)}
                      onCheckedChange={() => toggleDay(d)}
                    />
                    {DAY_SHORT[d]}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Home, clinic, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingId && (
              <Button
                type="button"
                variant="outline"
                className="text-red-600 mr-auto"
                onClick={() => handleDelete(editingId)}
                disabled={saving}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
