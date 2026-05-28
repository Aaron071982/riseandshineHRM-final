'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AdminUser = { id: string; name: string; email: string | null; color: string }
type Availability = {
  id: string
  userId: string
  dayOfWeek: number
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  label: string | null
  color: string
}
type AvailabilityOverride = {
  id: string
  userId: string
  date: string
  overrideType: 'BLOCKED' | 'CUSTOM'
  startHour: number | null
  startMinute: number | null
  endHour: number | null
  endMinute: number | null
  reason: string | null
}
type EffectiveAvailability = Availability & {
  date: string
  source: 'RECURRING' | 'CUSTOM_OVERRIDE' | 'BLOCKED_OVERRIDE'
  reason: string | null
  overrideId: string | null
}
type Interview = {
  id: string
  scheduledAt: string
  durationMinutes: number
  interviewerName: string
  meetingUrl: string | null
  status: string
  candidate: { id: string; name: string } | null
  interviewer: { id: string; name: string } | null
}
type CalendarNote = {
  id: string
  userId: string
  date: string
  content: string
  color: string | null
  isPinned: boolean
  createdAt: string
  authorName: string
}
type AdminStatusRow = {
  userId: string
  status: string
  statusEmoji: string | null
  statusMessage: string | null
  statusExpiresAt: string | null
  lastSeenAt: string | null
}
type Conflict = {
  interviewId: string
  date: string
  interviewerUserId: string
  interviewerName: string
  reason: string | null
  message: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7)
const STATUS_ORDER: Record<string, number> = { ONLINE: 0, IN_INTERVIEW: 0, IN_SESSION: 0, AWAY: 1, BUSY: 2, OFFLINE: 3 }
const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-green-500',
  AWAY: 'bg-yellow-400',
  BUSY: 'bg-red-500',
  IN_INTERVIEW: 'bg-blue-500',
  IN_SESSION: 'bg-purple-500',
  OFFLINE: 'bg-gray-400',
}
const EMOJIS = ['🙂', '✅', '📞', '🚗', '🧠', '💬', '🏥', '🧡']
const AVAIL_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#22C55E', '#EF4444', '#14B8A6', '#F59E0B', '#6366F1']

function startOfWeek(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay())
  return date
}
function addDays(d: Date, days: number) {
  const n = new Date(d)
  n.setDate(n.getDate() + days)
  return n
}
function dayISO(d: Date) {
  return d.toISOString().slice(0, 10)
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function minutesFrom(hour: number, minute: number) {
  return (hour - 7) * 60 + minute
}
function fmtHours(startHour: number, startMinute: number, endHour: number, endMinute: number) {
  const d1 = new Date()
  d1.setHours(startHour, startMinute, 0, 0)
  const d2 = new Date()
  d2.setHours(endHour, endMinute, 0, 0)
  return `${d1.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${d2.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function uiStatusText(source: EffectiveAvailability['source']) {
  if (source === 'BLOCKED_OVERRIDE') return 'Blocked'
  if (source === 'CUSTOM_OVERRIDE') return 'Custom'
  return 'Available'
}

function getETParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return { dayIndex: dayIndex < 0 ? 0 : dayIndex, hour, minute }
}

export default function TeamHubEnhancedPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [effectiveAvailability, setEffectiveAvailability] = useState<EffectiveAvailability[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [statuses, setStatuses] = useState<AdminStatusRow[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusEmoji, setStatusEmoji] = useState('')
  const [showFreeNowOnly, setShowFreeNowOnly] = useState(false)
  const [selectedDayISO, setSelectedDayISO] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null)
  const [adminFilter, setAdminFilter] = useState<Set<string>>(new Set())
  const [customOverrideDraft, setCustomOverrideDraft] = useState({ start: '09:00', end: '17:00', reason: '' })
  const [newNote, setNewNote] = useState({ content: '', color: '#fde68a', isPinned: false })
  const [isMobile, setIsMobile] = useState(false)
  const [overrideError, setOverrideError] = useState('')
  const weekScrollRef = useRef<HTMLDivElement | null>(null)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const rangeEnd = useMemo(() => addDays(weekStart, viewMode === 'week' ? 6 : 41), [weekStart, viewMode])

  const fetchCalendar = async () => {
    const params = new URLSearchParams({ startDate: weekStart.toISOString(), endDate: rangeEnd.toISOString() })
    const res = await fetch(`/api/admin/team/calendar?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setCurrentUserId(data.currentUserId)
    setAdmins(data.admins ?? [])
    setAvailability(data.availability ?? [])
    setEffectiveAvailability(data.effectiveAvailability ?? [])
    setOverrides(data.overrides ?? [])
    setInterviews(data.interviews ?? [])
    setNotes(data.notes ?? [])
    setStatuses(data.statuses ?? [])
    setConflicts(data.conflicts ?? [])
    setAdminFilter((prev) => (prev.size ? prev : new Set((data.admins ?? []).map((a: AdminUser) => a.id))))
  }

  const fetchStatuses = async () => {
    const res = await fetch('/api/admin/team/status', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setStatuses((data.team ?? []).map((x: any) => ({
      userId: x.userId,
      status: x.status,
      statusEmoji: x.statusEmoji,
      statusMessage: x.statusMessage,
      statusExpiresAt: x.statusExpiresAt,
      lastSeenAt: x.lastSeenAt,
    })))
  }

  useEffect(() => {
    setLoading(true)
    fetchCalendar().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, viewMode])
  useEffect(() => {
    fetchStatuses()
    const id = setInterval(fetchStatuses, 30000)
    return () => clearInterval(id)
  }, [])

  const adminById = useMemo(() => new Map(admins.map((a) => [a.id, a])), [admins])
  const statusByUser = useMemo(() => new Map(statuses.map((s) => [s.userId, s])), [statuses])
  const myStatus = statusByUser.get(currentUserId)
  const totalMinutes = 15 * 60
  const nowMinutes = (() => {
    const p = getETParts()
    return minutesFrom(p.hour, p.minute)
  })()

  const visibleEffective = useMemo(
    () => effectiveAvailability.filter((a) => adminFilter.has(a.userId)),
    [effectiveAvailability, adminFilter]
  )

  const selectedDate = selectedDayISO ? new Date(`${selectedDayISO}T12:00:00`) : new Date()
  const selectedDayAvail = useMemo(
    () => effectiveAvailability.filter((a) => a.date === selectedDayISO),
    [effectiveAvailability, selectedDayISO]
  )
  const selectedDayInterviews = useMemo(
    () => interviews.filter((i) => dayISO(new Date(i.scheduledAt)) === selectedDayISO),
    [interviews, selectedDayISO]
  )
  const selectedDayNotes = useMemo(
    () => notes.filter((n) => dayISO(new Date(n.date)) === selectedDayISO).sort((a, b) => Number(b.isPinned) - Number(a.isPinned)),
    [notes, selectedDayISO]
  )
  const selectedDayConflicts = useMemo(() => conflicts.filter((c) => c.date === selectedDayISO), [conflicts, selectedDayISO])

  const selectedAdminOverride = useMemo(
    () => overrides.find((o) => o.userId === currentUserId && o.date === selectedDayISO) || null,
    [overrides, currentUserId, selectedDayISO]
  )
  const myAvailForSelectedDay = useMemo(
    () => selectedDayAvail.filter((a) => a.userId === currentUserId),
    [selectedDayAvail, currentUserId]
  )

  const etNow = getETParts()
  const freeNowUserIds = useMemo(() => {
    const nowTotal = etNow.hour * 60 + etNow.minute
    const todayIso = dayISO(new Date())
    const blockedUsers = new Set(
      overrides.filter((o) => o.date === todayIso && o.overrideType === 'BLOCKED').map((o) => o.userId)
    )
    return new Set(
      effectiveAvailability
        .filter((a) => a.date === todayIso)
        .filter((a) => !blockedUsers.has(a.userId))
        .filter((a) => {
          const status = statusByUser.get(a.userId)?.status || 'OFFLINE'
          return status !== 'OFFLINE' && status !== 'BUSY'
        })
        .filter((a) => {
          const start = a.startHour * 60 + a.startMinute
          const end = a.endHour * 60 + a.endMinute
          return nowTotal >= start && nowTotal < end
        })
        .map((a) => a.userId)
    )
  }, [effectiveAvailability, overrides, statusByUser, etNow.hour, etNow.minute])

  const teamRows = useMemo(() => {
    return admins
      .map((a) => {
        const status = statusByUser.get(a.id)?.status ?? 'OFFLINE'
        return {
          admin: a,
          status,
          row: statusByUser.get(a.id),
          days: Array.from(new Set(availability.filter((x) => x.userId === a.id).map((x) => x.dayOfWeek))).sort((x, y) => x - y),
        }
      })
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2))
  }, [admins, availability, statusByUser])

  const todayIso = dayISO(new Date())
  const todayInterviews = useMemo(
    () => interviews.filter((i) => dayISO(new Date(i.scheduledAt)) === todayIso),
    [interviews, todayIso]
  )
  const todayAvailCount = useMemo(
    () => new Set(effectiveAvailability.filter((a) => a.date === todayIso && a.source !== 'BLOCKED_OVERRIDE').map((a) => a.userId)).size,
    [effectiveAvailability, todayIso]
  )

  const visibleTeamRows = useMemo(() => {
    if (!showFreeNowOnly) return teamRows
    return teamRows.filter((r) => freeNowUserIds.has(r.admin.id))
  }, [teamRows, showFreeNowOnly, freeNowUserIds])

  useEffect(() => {
    if (viewMode !== 'week') return
    const scroller = weekScrollRef.current
    if (!scroller) return
    const target = (nowMinutes / totalMinutes) * scroller.scrollHeight
    scroller.scrollTo({ top: Math.max(0, target - scroller.clientHeight / 2), behavior: 'smooth' })
  }, [viewMode, nowMinutes, totalMinutes])

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth < 1024)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  const setMyStatus = async (status: string) => {
    await fetch('/api/admin/team/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, statusMessage, statusEmoji }),
    })
    fetchStatuses()
  }

  const saveOverride = async (payload: {
    date: string
    overrideType: 'BLOCKED' | 'CUSTOM'
    startHour?: number
    startMinute?: number
    endHour?: number
    endMinute?: number
    reason?: string
  }) => {
    setOverrideError('')
    const res = await fetch('/api/admin/team/availability/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setOverrideError(data.error || 'Could not save override.')
      return
    }
    fetchCalendar()
  }

  const removeOverride = async (overrideId: string) => {
    setOverrideError('')
    const res = await fetch(`/api/admin/team/availability/override/${overrideId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setOverrideError(data.error || 'Could not remove override.')
      return
    }
    fetchCalendar()
  }

  const createNoteInline = async () => {
    if (!newNote.content.trim()) return
    await fetch('/api/admin/team/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ date: selectedDayISO, content: newNote.content, color: newNote.color, isPinned: newNote.isPinned }),
    })
    setNewNote({ content: '', color: '#fde68a', isPinned: false })
    fetchCalendar()
  }

  const deleteNote = async (id: string) => {
    await fetch(`/api/admin/team/notes/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchCalendar()
  }

  const weekTitle = `${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(weekDays[0])} - ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(weekDays[6])}`
  const panelOpen = Boolean(selectedDayISO)

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 p-6 text-white">
        <h1 className="text-2xl font-bold">Team Hub</h1>
        <p className="text-orange-50 mt-1">Availability, status, and coordination for the Rise & Shine admin team</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className={`${panelOpen && !isMobile ? 'xl:col-span-9' : 'xl:col-span-8'} space-y-4 min-w-0`}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="w-4 h-4 mr-1" /> Previous Week</Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next Week <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-md border p-1 text-sm">
                    <button className={`px-2 py-1 rounded ${viewMode === 'week' ? 'bg-orange-500 text-white' : ''}`} onClick={() => setViewMode('week')}>Week</button>
                    <button className={`px-2 py-1 rounded ${viewMode === 'month' ? 'bg-orange-500 text-white' : ''}`} onClick={() => setViewMode('month')}>Month</button>
                  </div>
                  <Button size="sm" onClick={() => setShowAvailabilityModal(true)}>My Availability</Button>
                </div>
              </div>
              <CardTitle className="text-lg">{weekTitle}</CardTitle>
              <div className="pt-2 space-y-2">
                <div className="text-xs text-gray-500">Showing</div>
                <div className="flex flex-wrap gap-2">
                  {admins.map((a) => (
                    <button
                      key={a.id}
                      className={`px-2 py-1 rounded-full text-xs border inline-flex items-center gap-1 ${adminFilter.has(a.id) ? 'bg-white' : 'bg-gray-100 text-gray-400'}`}
                      onClick={() =>
                        setAdminFilter((prev) => {
                          const next = new Set(prev)
                          if (next.has(a.id)) next.delete(a.id)
                          else next.add(a.id)
                          return next
                        })
                      }
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </button>
                  ))}
                  <span className="px-2 py-1 rounded-full text-xs border bg-orange-100 text-orange-800 font-medium">Interviews</span>
                  <span className="px-2 py-1 rounded-full text-xs border bg-emerald-100 text-emerald-800 font-medium">Available time</span>
                  <span className="px-2 py-1 rounded-full text-xs border bg-[repeating-linear-gradient(135deg,#e5e7eb_0px,#e5e7eb_6px,#f3f4f6_6px,#f3f4f6_12px)]">Blocked day</span>
                  <span className="px-2 py-1 rounded-full text-xs border bg-indigo-50 text-indigo-700">Custom hours</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-gray-500">Loading calendar...</p> : (
                <div className={`flex ${panelOpen && !isMobile ? 'gap-4' : ''}`}>
                  <div className="flex-1 min-w-0">
                    {viewMode === 'week' ? (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-gray-50 border-b">
                          <div className="p-2 text-xs text-gray-500" />
                          {weekDays.map((d, i) => {
                            const dayKey = dayISO(d)
                            const hasBlocked = overrides.some((o) => o.date === dayKey && o.overrideType === 'BLOCKED')
                            const hasConflict = conflicts.some((c) => c.date === dayKey)
                            return (
                              <button key={i} className={`p-2 border-l text-left ${sameDay(d, new Date()) ? 'bg-orange-50' : ''}`} onClick={() => { setSelectedDayISO(dayKey); setSelectedAdminId(null) }}>
                                <div className="text-xs text-gray-500">{DAYS[i]}</div>
                                <div className="font-semibold flex items-center gap-1">
                                  {new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(d)}
                                  {hasBlocked ? <span title="Blocked override exists">🚫</span> : null}
                                  {hasConflict ? <span className="text-red-600" title="Conflict">⚠️</span> : null}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <div ref={weekScrollRef} className="relative max-h-[70vh] overflow-y-auto overflow-x-hidden">
                          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                            <div>{HOURS.map((h) => <div key={h} className="h-16 border-b text-[11px] text-gray-500 px-2 pt-1">{h <= 11 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`}</div>)}</div>
                            {weekDays.map((d, col) => {
                              const dayKey = dayISO(d)
                              const dayNotes = notes.filter((n) => dayISO(new Date(n.date)) === dayKey).slice(0, 2)
                              const hasBlocked = overrides.some((o) => o.date === dayKey && o.overrideType === 'BLOCKED')
                              return (
                                <button key={col} className="relative border-l text-left" onClick={() => { setSelectedDayISO(dayKey); setSelectedAdminId(null) }}>
                                  {hasBlocked ? <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#e5e7eb_0px,#e5e7eb_6px,#f3f4f6_6px,#f3f4f6_12px)] opacity-70" /> : null}
                                  <div className="absolute top-1 left-1 right-1 z-20 flex flex-wrap gap-1">
                                    {dayNotes.map((n) => <div key={n.id} className="text-[10px] rounded px-2 py-0.5 shadow-sm" style={{ backgroundColor: n.color || '#fde68a' }}>{n.isPinned ? '📌 ' : ''}{n.content.slice(0, 18)}</div>)}
                                  </div>
                                  {HOURS.map((h) => <div key={h} className="h-16 w-full border-b border-dashed border-gray-200 hover:bg-orange-50/40" />)}
                                </button>
                              )
                            })}
                          </div>

                          {visibleEffective.filter((a) => weekDays.some((d) => dayISO(d) === a.date)).map((a, idx) => {
                            const topPct = (minutesFrom(a.startHour, a.startMinute) / totalMinutes) * 100
                            const heightPct = ((minutesFrom(a.endHour, a.endMinute) - minutesFrom(a.startHour, a.startMinute)) / totalMinutes) * 100
                            const dayColumnOffset = `calc(64px + ${new Date(`${a.date}T12:00:00`).getDay()} * ((100% - 64px) / 7))`
                            const dayColumnWidth = `calc((100% - 64px) / 7)`
                            const admin = adminById.get(a.userId)
                            const blocked = a.source === 'BLOCKED_OVERRIDE'
                            const custom = a.source === 'CUSTOM_OVERRIDE'
                            const interviewCountInThisSlot = interviews.filter((i) => {
                              const dt = new Date(i.scheduledAt)
                              if (dayISO(dt) !== a.date) return false
                              const m = dt.getHours() * 60 + dt.getMinutes()
                              const start = a.startHour * 60 + a.startMinute
                              const end = a.endHour * 60 + a.endMinute
                              return m >= start && m < end
                            }).length
                            return (
                              <div
                                key={`${a.id}-${idx}`}
                                title={`${admin?.name || 'Admin'} · ${blocked ? 'Blocked' : fmtHours(a.startHour, a.startMinute, a.endHour, a.endMinute)}${a.reason ? ` · ${a.reason}` : ''}`}
                                className={`absolute text-[11px] rounded-md px-2 py-1 overflow-hidden border shadow-sm ${custom ? 'ring-1 ring-indigo-500' : ''}`}
                                style={{
                                  top: `calc(${topPct}% + 2px)`,
                                  height: `calc(${heightPct}% - 4px)`,
                                  left: `calc(${dayColumnOffset} + 2px)`,
                                  width: `calc(${dayColumnWidth} - 4px)`,
                                  background: blocked
                                    ? 'repeating-linear-gradient(135deg,#d1d5db 0px,#d1d5db 6px,#f3f4f6 6px,#f3f4f6 12px)'
                                    : custom
                                      ? `${(admin?.color || '#94a3b8')}99`
                                      : `${(admin?.color || '#94a3b8')}73`,
                                  borderColor: blocked ? '#6b7280' : (admin?.color || '#94a3b8'),
                                  zIndex: 10,
                                  opacity: blocked ? 0.97 : 0.92,
                                }}
                              >
                                <div className="font-semibold truncate text-slate-800">
                                  {(admin?.name || 'A').slice(0, 1)} · {uiStatusText(a.source)}
                                </div>
                                <div className="truncate text-[10px] text-slate-700">
                                  {blocked ? (a.reason || 'Unavailable all day') : fmtHours(a.startHour, a.startMinute, a.endHour, a.endMinute)}
                                </div>
                                {!blocked && interviewCountInThisSlot > 0 ? (
                                  <div className="mt-1 inline-flex rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                                    {interviewCountInThisSlot} interview{interviewCountInThisSlot > 1 ? 's' : ''} in slot
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}

                          {interviews.filter((i) => adminFilter.has(i.interviewer?.id || '') || !i.interviewer?.id).map((intv) => {
                            const dt = new Date(intv.scheduledAt)
                            const day = dt.getDay()
                            const mins = dt.getHours() * 60 + dt.getMinutes()
                            const startMins = mins - 7 * 60
                            if (startMins < 0 || startMins > totalMinutes) return null
                            const topPct = (startMins / totalMinutes) * 100
                            const heightPct = ((intv.durationMinutes || 30) / totalMinutes) * 100
                            const dayColumnOffset = `calc(64px + ${day} * ((100% - 64px) / 7))`
                            const dayColumnWidth = `calc((100% - 64px) / 7)`
                            const hasConflict = conflicts.some((c) => c.interviewId === intv.id)
                            return (
                              <div
                                key={intv.id}
                                className={`absolute rounded-md px-2 py-1 text-[11px] text-white bg-orange-500 shadow-lg border border-orange-300 ${hasConflict ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                                style={{
                                  top: `calc(${topPct}% + 2px)`,
                                  height: `calc(${heightPct}% - 4px)`,
                                  left: `calc(${dayColumnOffset} + 4px)`,
                                  width: `calc(${dayColumnWidth} - 8px)`,
                                  zIndex: 40,
                                }}
                              >
                                <div className="font-semibold truncate">Interview: {intv.candidate?.name || 'Candidate'}</div>
                                <div className="text-[10px] text-orange-100 truncate">
                                  {new Date(intv.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </div>
                                {hasConflict ? <div className="text-[10px]">⚠️ Conflict</div> : null}
                              </div>
                            )
                          })}

                          <div className="absolute left-[64px] right-0 h-0.5 bg-red-500 z-40" style={{ top: `${(nowMinutes / totalMinutes) * 100}%` }} />
                        </div>
                      </div>
                    ) : (
                      <EnhancedMonthView
                        weekStart={weekStart}
                        effectiveAvailability={effectiveAvailability}
                        interviews={interviews}
                        notes={notes}
                        overrides={overrides}
                        conflicts={conflicts}
                        adminsById={adminById}
                        onOpenDay={(day: Date) => setSelectedDayISO(dayISO(day))}
                        setViewMode={setViewMode}
                        setWeekStart={setWeekStart}
                      />
                    )}
                  </div>

                  {panelOpen && !isMobile ? (
                    <DayDetailPanel
                      selectedDate={selectedDate}
                      currentUserId={currentUserId}
                      selectedAdminId={selectedAdminId}
                      admins={admins}
                      statusByUser={statusByUser}
                      availability={availability}
                      selectedDayAvail={selectedDayAvail}
                      selectedDayInterviews={selectedDayInterviews}
                      selectedDayNotes={selectedDayNotes}
                      selectedDayConflicts={selectedDayConflicts}
                      selectedAdminOverride={selectedAdminOverride}
                      onClose={() => { setSelectedAdminId(null); setSelectedDayISO('') }}
                      onBlockDay={(reason: string) => saveOverride({ date: selectedDayISO, overrideType: 'BLOCKED', reason })}
                      onCustomHours={() => {
                        const [sh, sm] = customOverrideDraft.start.split(':').map(Number)
                        const [eh, em] = customOverrideDraft.end.split(':').map(Number)
                        saveOverride({ date: selectedDayISO, overrideType: 'CUSTOM', startHour: sh, startMinute: sm, endHour: eh, endMinute: em, reason: customOverrideDraft.reason })
                      }}
                      onRemoveOverride={() => selectedAdminOverride?.id ? removeOverride(selectedAdminOverride.id) : undefined}
                      customOverrideDraft={customOverrideDraft}
                      setCustomOverrideDraft={setCustomOverrideDraft}
                      newNote={newNote}
                      setNewNote={setNewNote}
                      createNoteInline={createNoteInline}
                      deleteNote={deleteNote}
                      overrideError={overrideError}
                    />
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={`${panelOpen && !isMobile ? 'xl:col-span-3' : 'xl:col-span-4'} space-y-4`}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Team Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <button className={`text-xs px-3 py-1.5 rounded border ${showFreeNowOnly ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'}`} onClick={() => setShowFreeNowOnly((v) => !v)}>Who&apos;s free now?</button>
                <span className="text-xs text-gray-500">{freeNowUserIds.size} admins available right now</span>
              </div>
              <div className="rounded-lg border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">YOUR STATUS</p>
                <div className="flex flex-wrap gap-2">
                  {['ONLINE', 'AWAY', 'BUSY', 'IN_INTERVIEW', 'OFFLINE'].map((s) => (
                    <button key={s} className={`text-xs px-2 py-1 rounded border ${myStatus?.status === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'}`} onClick={() => setMyStatus(s)}>{s.replace('_', ' ')}</button>
                  ))}
                </div>
                <div className="mt-3">
                  <Input placeholder="Set custom message" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} />
                  <div className="flex gap-1 mt-2 flex-wrap">{EMOJIS.map((e) => <button key={e} className={`w-7 h-7 rounded border ${statusEmoji === e ? 'bg-orange-100 border-orange-400' : 'bg-white'}`} onClick={() => setStatusEmoji(e)}>{e}</button>)}</div>
                </div>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {visibleTeamRows.map(({ admin, status, row, days }) => {
                  const freeNow = freeNowUserIds.has(admin.id)
                  return (
                    <button key={admin.id} className={`w-full text-left rounded-lg border p-3 ${freeNow && showFreeNowOnly ? 'bg-green-50 border-green-300' : ''}`} onClick={() => { setSelectedAdminId(admin.id); setSelectedDayISO(dayISO(new Date())); }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold" style={{ backgroundColor: admin.color }}>{admin.name.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{admin.name}</p>
                            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.OFFLINE}`} />
                            <span className="text-[11px] text-gray-500">{status.replace('_', ' ')}</span>
                          </div>
                          {row?.statusMessage ? <p className="text-xs text-gray-600 mt-1">{row.statusEmoji ? `${row.statusEmoji} ` : ''}{row.statusMessage}</p> : null}
                          <div className="mt-2 flex gap-1 flex-wrap">{days.map((d) => <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{DAYS[d]}</span>)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-lg border p-3 bg-orange-50/40">
                <p className="text-xs text-gray-500">TODAY</p>
                <p className="text-sm font-medium mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <p>{todayInterviews.length} interviews scheduled</p>
                  <p>{todayAvailCount} admins effectively available</p>
                </div>
                <Button size="sm" className="mt-3" onClick={() => { setSelectedDayISO(todayIso); setSelectedAdminId(null) }}>
                  Open Today Panel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isMobile && panelOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-auto rounded-t-2xl border bg-white p-4 shadow-2xl">
          <DayDetailPanel
            selectedDate={selectedDate}
            currentUserId={currentUserId}
            selectedAdminId={selectedAdminId}
            admins={admins}
            statusByUser={statusByUser}
            availability={availability}
            selectedDayAvail={selectedDayAvail}
            selectedDayInterviews={selectedDayInterviews}
            selectedDayNotes={selectedDayNotes}
            selectedDayConflicts={selectedDayConflicts}
            selectedAdminOverride={selectedAdminOverride}
            onClose={() => { setSelectedAdminId(null); setSelectedDayISO('') }}
            onBlockDay={(reason: string) => saveOverride({ date: selectedDayISO, overrideType: 'BLOCKED', reason })}
            onCustomHours={() => {
              const [sh, sm] = customOverrideDraft.start.split(':').map(Number)
              const [eh, em] = customOverrideDraft.end.split(':').map(Number)
              saveOverride({ date: selectedDayISO, overrideType: 'CUSTOM', startHour: sh, startMinute: sm, endHour: eh, endMinute: em, reason: customOverrideDraft.reason })
            }}
            onRemoveOverride={() => selectedAdminOverride?.id ? removeOverride(selectedAdminOverride.id) : undefined}
            customOverrideDraft={customOverrideDraft}
            setCustomOverrideDraft={setCustomOverrideDraft}
            newNote={newNote}
            setNewNote={setNewNote}
            createNoteInline={createNoteInline}
            deleteNote={deleteNote}
            overrideError={overrideError}
          />
        </div>
      ) : null}

      {showAvailabilityModal ? (
        <AvailabilityModal
          currentUserId={currentUserId}
          initialRows={availability.filter((a) => a.userId === currentUserId)}
          onClose={() => setShowAvailabilityModal(false)}
          onSaved={() => { setShowAvailabilityModal(false); fetchCalendar() }}
        />
      ) : null}
    </div>
  )
}

function DayDetailPanel(props: any) {
  const today = sameDay(props.selectedDate, new Date())
  const targetAdminId = props.selectedAdminId || props.currentUserId
  const admin = props.admins.find((a: AdminUser) => a.id === targetAdminId)
  const row = props.statusByUser.get(targetAdminId)
  const scopedAvail = props.selectedDayAvail.filter((a: EffectiveAvailability) => a.userId === targetAdminId)
  const blocked = scopedAvail.some((a: EffectiveAvailability) => a.source === 'BLOCKED_OVERRIDE')
  const conflicts = props.selectedDayConflicts
  const weekly = DAYS.map((_, dayOfWeek) => props.availability.filter((a: Availability) => a.userId === targetAdminId && a.dayOfWeek === dayOfWeek))
  return (
    <aside className="w-full lg:w-[380px] shrink-0 border rounded-lg bg-white p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{props.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          {today ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Today</span> : null}
          {admin ? <p className="text-sm text-gray-600 mt-1">{admin.name}</p> : null}
        </div>
        <button onClick={props.onClose}><X className="w-4 h-4" /></button>
      </div>
      {conflicts.length ? (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm p-2">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          {conflicts[0].message}
        </div>
      ) : null}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs text-gray-500">YOUR AVAILABILITY FOR THIS DAY</p>
        {blocked ? <p className="text-sm font-medium text-gray-700">Blocked {props.selectedAdminOverride?.reason ? `- ${props.selectedAdminOverride.reason}` : ''}</p> : null}
        {!blocked && scopedAvail.length ? <p className="text-sm text-green-700">{scopedAvail.map((a: EffectiveAvailability) => fmtHours(a.startHour, a.startMinute, a.endHour, a.endMinute)).join(', ')}</p> : null}
        {!blocked && !scopedAvail.length ? <p className="text-sm text-gray-500">Unavailable</p> : null}
        {!props.selectedAdminId ? (
          <div className="flex flex-wrap gap-2">
            {props.selectedAdminOverride ? (
              <Button size="sm" variant="outline" onClick={props.onRemoveOverride}>Remove override</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => props.onBlockDay('Blocked for this day')}>Block this day</Button>
                <Button size="sm" onClick={props.onCustomHours}>Change hours for this day</Button>
              </>
            )}
          </div>
        ) : null}
        {props.overrideError ? <p className="text-xs text-red-600">{props.overrideError}</p> : null}
        {!props.selectedAdminId ? (
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={props.customOverrideDraft.start} onChange={(e) => props.setCustomOverrideDraft((p: any) => ({ ...p, start: e.target.value }))} />
            <Input type="time" value={props.customOverrideDraft.end} onChange={(e) => props.setCustomOverrideDraft((p: any) => ({ ...p, end: e.target.value }))} />
            <Input className="col-span-2" placeholder="Reason (optional)" value={props.customOverrideDraft.reason} onChange={(e) => props.setCustomOverrideDraft((p: any) => ({ ...p, reason: e.target.value }))} />
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs text-gray-500">WHO ELSE IS AVAILABLE</p>
        {props.selectedDayAvail.map((a: EffectiveAvailability) => {
          const adm = props.admins.find((x: AdminUser) => x.id === a.userId)
          const isBlocked = a.source === 'BLOCKED_OVERRIDE'
          return (
            <div key={a.id} className={`text-sm flex items-center justify-between ${isBlocked ? 'text-gray-400 line-through' : ''}`}>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: adm?.color || '#94a3b8' }} />{adm?.name || 'Admin'}</div>
              <span>{isBlocked ? 'Blocked' : fmtHours(a.startHour, a.startMinute, a.endHour, a.endMinute)}</span>
            </div>
          )
        })}
        {!props.selectedDayConflicts.length ? <p className="text-xs text-green-700">No conflicts</p> : null}
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs text-gray-500">INTERVIEWS ON THIS DAY</p>
        {props.selectedDayInterviews.length ? props.selectedDayInterviews.map((i: Interview) => (
          <div key={i.id} className="text-sm border rounded p-2">
            <div className="font-medium">{i.candidate?.name || 'Candidate'}</div>
            <div className="text-gray-500">{new Date(i.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {i.interviewer?.name || i.interviewerName}</div>
            {i.meetingUrl ? <Link className="text-xs underline text-orange-600" href={i.meetingUrl} target="_blank">Join meeting</Link> : null}
          </div>
        )) : <p className="text-sm text-gray-500">No interviews</p>}
        <Link href={`/admin/interviews?date=${props.selectedDate.toISOString().slice(0, 10)}`} className="text-sm text-orange-600 underline">Schedule Interview</Link>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs text-gray-500">NOTES FOR THIS DAY</p>
        {props.selectedDayNotes.map((n: CalendarNote) => (
          <div key={n.id} className="rounded p-2 text-sm" style={{ backgroundColor: n.color || '#fde68a' }}>
            <div>{n.isPinned ? '📌 ' : ''}{n.content}</div>
            <div className="text-[11px] text-gray-600 mt-1 flex justify-between">
              <span>{n.authorName}</span>
              {n.userId === props.currentUserId ? <button className="underline" onClick={() => props.deleteNote(n.id)}>Delete</button> : null}
            </div>
          </div>
        ))}
        <textarea className="w-full border rounded p-2 text-sm min-h-[80px]" value={props.newNote.content} onChange={(e) => props.setNewNote((p: any) => ({ ...p, content: e.target.value }))} placeholder="Add note..." />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">{['#fde68a', '#bfdbfe', '#fecaca', '#bbf7d0', '#ddd6fe', '#fdba74'].map((c) => <button key={c} className={`w-5 h-5 rounded border ${props.newNote.color === c ? 'ring-2 ring-orange-500' : ''}`} style={{ backgroundColor: c }} onClick={() => props.setNewNote((p: any) => ({ ...p, color: c }))} />)}</div>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={props.newNote.isPinned} onChange={(e) => props.setNewNote((p: any) => ({ ...p, isPinned: e.target.checked }))} /> Pin</label>
          <Button size="sm" onClick={props.createNoteInline}>Save</Button>
        </div>
      </div>

      {props.selectedAdminId ? (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs text-gray-500">WEEKLY SCHEDULE</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {weekly.map((rows: Availability[], i: number) => <div key={i} className="border rounded px-2 py-1"><b>{DAYS[i]}</b> {rows.length ? rows.map((r) => fmtHours(r.startHour, r.startMinute, r.endHour, r.endMinute)).join(', ') : '—'}</div>)}
          </div>
          <Link href={`/admin/messages?userId=${props.selectedAdminId}`} className="text-sm underline text-orange-600">Send message</Link>
        </div>
      ) : null}
    </aside>
  )
}

function EnhancedMonthView({ weekStart, effectiveAvailability, interviews, notes, overrides, conflicts, adminsById, onOpenDay, setViewMode, setWeekStart }: any) {
  const first = new Date(weekStart)
  first.setDate(1)
  const gridStart = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b">{DAYS.map((d) => <div key={d} className="p-2 text-xs font-semibold text-gray-600">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayISO(day)
          const dayAvailUsers = Array.from(
            new Set(
              effectiveAvailability
                .filter((a: EffectiveAvailability) => a.date === key && a.source !== 'BLOCKED_OVERRIDE')
                .map((a: EffectiveAvailability) => a.userId)
            )
          ) as string[]
          const blockedAny = overrides.some((o: AvailabilityOverride) => o.date === key && o.overrideType === 'BLOCKED')
          const dayInterviews = interviews.filter((i: Interview) => dayISO(new Date(i.scheduledAt)) === key)
          const pinned = notes.some((n: CalendarNote) => dayISO(new Date(n.date)) === key && n.isPinned)
          const hasConflict = conflicts.some((c: Conflict) => c.date === key)
          return (
            <button
              key={day.toISOString()}
              className="relative group min-h-[100px] border-b border-r p-2 text-left hover:bg-orange-50/40"
              onClick={() => { setWeekStart(startOfWeek(day)); setViewMode('week'); onOpenDay(day) }}
            >
              <div className="text-xs text-gray-500 flex items-center gap-1">{day.getDate()} {blockedAny ? '🚫' : ''} {pinned ? '📌' : ''} {hasConflict ? '⚠️' : ''}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {dayAvailUsers.slice(0, 4).map((uid: string) => (
                  <span key={uid} className="w-5 h-5 rounded-full text-[10px] text-white inline-flex items-center justify-center" style={{ backgroundColor: adminsById.get(uid)?.color || '#94a3b8' }}>
                    {(adminsById.get(uid)?.name || 'A').slice(0, 1).toUpperCase()}
                  </span>
                ))}
                {dayAvailUsers.length > 4 ? <span className="text-[10px] text-gray-500">+{dayAvailUsers.length - 4} more</span> : null}
              </div>
              {dayInterviews.length ? <div className="mt-1 text-[10px] inline-block rounded bg-orange-100 text-orange-700 px-1.5 py-0.5">{dayInterviews.length} interviews</div> : null}
              <div className="pointer-events-none absolute z-20 hidden group-hover:block left-2 right-2 top-10 rounded-md border bg-white shadow-lg p-2 text-[11px]">
                <div className="font-semibold mb-1">{day.toLocaleDateString()}</div>
                <div>Available: {dayAvailUsers.map((id) => adminsById.get(id)?.name).filter(Boolean).join(', ') || 'None'}</div>
                <div>Interviews: {dayInterviews.length}</div>
                <div>Notes: {notes.filter((n: CalendarNote) => dayISO(new Date(n.date)) === key).length}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AvailabilityModal({
  currentUserId,
  initialRows,
  onClose,
  onSaved,
}: {
  currentUserId: string
  initialRows: Availability[]
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<Availability[]>(
    initialRows.length
      ? initialRows
      : DAYS.map((_, dayOfWeek) => ({
          id: `new-${dayOfWeek}`,
          userId: currentUserId,
          dayOfWeek,
          startHour: 9,
          startMinute: 0,
          endHour: 17,
          endMinute: 0,
          label: '',
          color: AVAIL_COLORS[0],
        }))
  )
  const save = async () => {
    await fetch('/api/admin/team/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ availability: rows.map((r) => ({ dayOfWeek: r.dayOfWeek, startHour: r.startHour, startMinute: r.startMinute, endHour: r.endHour, endMinute: r.endMinute, label: r.label, color: r.color, isActive: true })) }),
    })
    onSaved()
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 p-3 sm:p-6 overflow-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-auto">
        <div className="p-5 border-b"><h3 className="text-xl font-semibold">Set Your Availability</h3></div>
        <div className="p-5 space-y-3">
          {DAYS.map((day, dayOfWeek) => {
            const dayRows = rows.filter((r) => r.dayOfWeek === dayOfWeek)
            return (
              <div key={day} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{day}</p>
                  <button className="text-xs text-orange-600 underline" onClick={() => setRows((prev) => [...prev, { id: `new-${dayOfWeek}-${prev.length}`, userId: currentUserId, dayOfWeek, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0, label: '', color: AVAIL_COLORS[0] }])}>+ Add another time range</button>
                </div>
                {dayRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div><Label className="text-xs">From</Label><Input type="time" step={1800} value={`${String(row.startHour).padStart(2, '0')}:${String(row.startMinute).padStart(2, '0')}`} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, startHour: h, startMinute: m } : x))) }} /></div>
                    <div><Label className="text-xs">To</Label><Input type="time" step={1800} value={`${String(row.endHour).padStart(2, '0')}:${String(row.endMinute).padStart(2, '0')}`} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, endHour: h, endMinute: m } : x))) }} /></div>
                    <div className="md:col-span-2"><Label className="text-xs">Label</Label><Input value={row.label || ''} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, label: e.target.value } : x)))} /></div>
                    <div><Label className="text-xs">Color</Label><div className="flex gap-1 mt-2">{AVAIL_COLORS.map((c) => <button key={c} className={`w-5 h-5 rounded border ${row.color === c ? 'ring-2 ring-gray-700' : ''}`} style={{ backgroundColor: c }} onClick={() => setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, color: c } : x)))} />)}</div></div>
                    <div className="text-right"><button className="text-xs text-red-600 underline" onClick={() => setRows((prev) => prev.filter((x) => x.id !== row.id))}>Remove</button></div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="p-5 border-t flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></div>
      </div>
    </div>
  )
}
