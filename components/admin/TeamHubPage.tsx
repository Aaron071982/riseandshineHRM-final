'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays, ChevronLeft, ChevronRight, Circle, Pin, Plus, Users } from 'lucide-react'

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7)
const STATUS_ORDER: Record<string, number> = { ONLINE: 0, IN_INTERVIEW: 0, IN_SESSION: 0, AWAY: 1, BUSY: 1, OFFLINE: 2 }
const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-green-500',
  AWAY: 'bg-yellow-400',
  BUSY: 'bg-red-500',
  IN_INTERVIEW: 'bg-blue-500 animate-pulse',
  IN_SESSION: 'bg-purple-500',
  OFFLINE: 'bg-gray-400',
}
const EMOJIS = ['🙂', '✅', '📞', '🚗', '🧠', '💬', '🏥', '🧡']
const AVAIL_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#22C55E', '#EF4444', '#14B8A6', '#F59E0B', '#6366F1']

function toET(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function minutesFrom(hour: number, minute: number) {
  return (hour - 7) * 60 + minute
}

export default function TeamHubPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [statuses, setStatuses] = useState<AdminStatusRow[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusEmoji, setStatusEmoji] = useState('')
  const [noteDraft, setNoteDraft] = useState<{ date: string; content: string; color: string; isPinned: boolean } | null>(null)
  const [showFreeNowOnly, setShowFreeNowOnly] = useState(false)
  const weekScrollRef = useRef<HTMLDivElement | null>(null)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const fetchCalendar = async () => {
    const start = weekStart
    const end = addDays(weekStart, viewMode === 'week' ? 6 : 41)
    const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() })
    const res = await fetch(`/api/admin/team/calendar?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setCurrentUserId(data.currentUserId)
    setAdmins(data.admins ?? [])
    setAvailability(data.availability ?? [])
    setInterviews(data.interviews ?? [])
    setNotes(data.notes ?? [])
    setStatuses(data.statuses ?? [])
  }

  const fetchStatuses = async () => {
    const res = await fetch('/api/admin/team/status', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setCurrentUserId(data.currentUserId)
    const rows = (data.team ?? []).map((x: any) => ({
      userId: x.userId,
      status: x.status,
      statusEmoji: x.statusEmoji,
      statusMessage: x.statusMessage,
      statusExpiresAt: x.statusExpiresAt,
      lastSeenAt: x.lastSeenAt,
    }))
    setStatuses(rows)
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

  const statusByUser = useMemo(() => new Map(statuses.map((s) => [s.userId, s])), [statuses])
  const adminById = useMemo(() => new Map(admins.map((a) => [a.id, a])), [admins])

  const teamRows = useMemo(() => {
    return admins
      .map((a) => ({
        admin: a,
        status: statusByUser.get(a.id)?.status ?? 'OFFLINE',
        row: statusByUser.get(a.id),
        days: Array.from(new Set(availability.filter((x) => x.userId === a.id).map((x) => x.dayOfWeek))).sort((x, y) => x - y),
      }))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2))
  }, [admins, availability, statusByUser])

  const myStatus = statusByUser.get(currentUserId)
  const currentDay = new Date()
  const nowMinutes = minutesFrom(currentDay.getHours(), currentDay.getMinutes())
  const nowTotalMinutes = currentDay.getHours() * 60 + currentDay.getMinutes()
  const totalMinutes = 15 * 60
  const nowDayOfWeek = currentDay.getDay()

  const freeNowUserIds = useMemo(() => {
    return new Set(
      availability
        .filter((a) => a.dayOfWeek === nowDayOfWeek)
        .filter((a) => {
          const start = a.startHour * 60 + a.startMinute
          const end = a.endHour * 60 + a.endMinute
          return nowTotalMinutes >= start && nowTotalMinutes < end
        })
        .map((a) => a.userId)
    )
  }, [availability, nowDayOfWeek, nowTotalMinutes])

  const visibleTeamRows = useMemo(() => {
    if (!showFreeNowOnly) return teamRows
    return teamRows.filter((r) => freeNowUserIds.has(r.admin.id))
  }, [teamRows, showFreeNowOnly, freeNowUserIds])

  useEffect(() => {
    if (viewMode !== 'week') return
    if (!sameDay(weekStart, startOfWeek(new Date()))) return
    const scroller = weekScrollRef.current
    if (!scroller) return
    const target = (nowMinutes / totalMinutes) * scroller.scrollHeight
    scroller.scrollTo({ top: Math.max(0, target - scroller.clientHeight / 2), behavior: 'smooth' })
  }, [viewMode, weekStart, nowMinutes, totalMinutes])

  const setMyStatus = async (status: string) => {
    await fetch('/api/admin/team/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, statusMessage, statusEmoji }),
    })
    fetchStatuses()
  }

  const createNote = async () => {
    if (!noteDraft?.content.trim()) return
    await fetch('/api/admin/team/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(noteDraft),
    })
    setNoteDraft(null)
    fetchCalendar()
  }

  const weekTitle = `${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(weekDays[0])} - ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(weekDays[6])}`

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 p-6 text-white">
        <h1 className="text-2xl font-bold">Team Hub</h1>
        <p className="text-orange-50 mt-1">Availability, status, and coordination for the Rise & Shine admin team</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                    Next Week <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                    Today
                  </Button>
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
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-gray-500">Loading calendar...</p>
              ) : viewMode === 'week' ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-gray-50 border-b">
                    <div className="p-2 text-xs text-gray-500" />
                    {weekDays.map((d, i) => {
                      const dayAvailUsers = Array.from(new Set(availability.filter((a) => a.dayOfWeek === i).map((a) => a.userId))).slice(0, 4)
                      return (
                        <div key={i} className={`p-2 border-l ${sameDay(d, new Date()) ? 'bg-orange-50' : ''}`}>
                          <div className="text-xs text-gray-500">{DAYS[i]}</div>
                          <div className="font-semibold">{new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(d)}</div>
                          <div className="flex -space-x-1 mt-1">
                            {dayAvailUsers.map((uid) => (
                              <div key={uid} title={adminById.get(uid)?.name} className="w-5 h-5 rounded-full border border-white text-[10px] text-white flex items-center justify-center" style={{ backgroundColor: adminById.get(uid)?.color || '#94a3b8' }}>
                                {(adminById.get(uid)?.name || 'A').slice(0, 1).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <button
                            className="mt-1 text-[11px] text-orange-600 hover:underline inline-flex items-center"
                            onClick={() => setNoteDraft({ date: dayISO(d), content: '', color: '#fde68a', isPinned: false })}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add note
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <div ref={weekScrollRef} className="relative max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                      <div>
                        {HOURS.map((h) => (
                          <div key={h} className="h-16 border-b text-[11px] text-gray-500 px-2 pt-1">
                            {h <= 11 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`}
                          </div>
                        ))}
                      </div>
                      {weekDays.map((d, col) => {
                        const dayNotes = notes.filter((n) => sameDay(new Date(n.date), d))
                        return (
                          <div key={col} className="relative border-l">
                            <div className="absolute top-1 left-1 right-1 z-20 flex flex-wrap gap-1">
                              {dayNotes.map((n) => (
                                <div key={n.id} className="text-[10px] rounded px-2 py-0.5 shadow-sm" style={{ backgroundColor: n.color || '#fde68a' }}>
                                  {n.isPinned ? '📌 ' : ''}
                                  {n.content.slice(0, 20)}
                                </div>
                              ))}
                            </div>
                            {HOURS.map((h) => (
                              <button
                                key={h}
                                className="h-16 w-full border-b border-dashed border-gray-200 hover:bg-orange-50/40 transition text-[10px] text-gray-300 text-left px-2"
                                onClick={() => setNoteDraft({ date: dayISO(d), content: '', color: '#fde68a', isPinned: false })}
                              >
                                {h === 12 ? 'Click to add note' : ''}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>

                    {availability.map((a, idx) => {
                      const topPct = (minutesFrom(a.startHour, a.startMinute) / totalMinutes) * 100
                      const heightPct = ((minutesFrom(a.endHour, a.endMinute) - minutesFrom(a.startHour, a.startMinute)) / totalMinutes) * 100
                      const dayColumnOffset = `calc(64px + ${a.dayOfWeek} * ((100% - 64px) / 7))`
                      const dayColumnWidth = `calc((100% - 64px) / 7)`
                      const admin = adminById.get(a.userId)
                      return (
                        <div
                          key={`${a.id}-${idx}`}
                          className="absolute text-[11px] text-slate-800 rounded px-2 py-1 overflow-hidden border"
                          style={{
                            top: `calc(${topPct}% + 2px)`,
                            height: `calc(${heightPct}% - 4px)`,
                            left: `calc(${dayColumnOffset} + 2px)`,
                            width: `calc(${dayColumnWidth} - 4px)`,
                            backgroundColor: `${a.color}66`,
                            borderColor: `${a.color}`,
                            zIndex: 10,
                          }}
                        >
                          <div className="font-medium truncate">{a.label || `${admin?.name || 'Admin'} - Available`}</div>
                        </div>
                      )
                    })}

                    {interviews.map((intv) => {
                      const dt = new Date(intv.scheduledAt)
                      const day = dt.getDay()
                      const mins = dt.getHours() * 60 + dt.getMinutes()
                      const startMins = mins - 7 * 60
                      if (startMins < 0 || startMins > totalMinutes) return null
                      const topPct = (startMins / totalMinutes) * 100
                      const heightPct = ((intv.durationMinutes || 30) / totalMinutes) * 100
                      const dayColumnOffset = `calc(64px + ${day} * ((100% - 64px) / 7))`
                      const dayColumnWidth = `calc((100% - 64px) / 7)`
                      const now = new Date()
                      const msUntil = dt.getTime() - now.getTime()
                      const startsSoon = msUntil >= 0 && msUntil <= 30 * 60 * 1000
                      return (
                        <div
                          key={intv.id}
                          className={`absolute rounded px-2 py-1 text-[11px] text-white bg-orange-500 shadow-md ${startsSoon ? 'animate-pulse ring-2 ring-orange-300' : ''}`}
                          style={{
                            top: `calc(${topPct}% + 2px)`,
                            height: `calc(${heightPct}% - 4px)`,
                            left: `calc(${dayColumnOffset} + 4px)`,
                            width: `calc(${dayColumnWidth} - 8px)`,
                            zIndex: 30,
                          }}
                          title={`${intv.candidate?.name || 'Candidate'} - ${toET(new Date(intv.scheduledAt))}`}
                        >
                          <div className="font-semibold truncate">{intv.candidate?.name || 'Candidate'} - Interview</div>
                          <div className="truncate text-orange-100">{intv.interviewer?.name || intv.interviewerName}</div>
                          {intv.meetingUrl ? (
                            <Link className="underline text-orange-100" href={intv.meetingUrl} target="_blank">
                              Join Meeting
                            </Link>
                          ) : null}
                        </div>
                      )
                    })}

                    {sameDay(weekStart, startOfWeek(new Date())) ? (
                      <div
                        className="absolute left-[64px] right-0 h-0.5 bg-red-500 z-40"
                        style={{ top: `${(nowMinutes / totalMinutes) * 100}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <MonthView
                  weekStart={weekStart}
                  availability={availability}
                  interviews={interviews}
                  notes={notes}
                  adminsById={adminById}
                  onOpenDay={(day) => {
                    setWeekStart(startOfWeek(day))
                    setViewMode('week')
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Team Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <button
                  className={`text-xs px-3 py-1.5 rounded border ${showFreeNowOnly ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'}`}
                  onClick={() => setShowFreeNowOnly((v) => !v)}
                >
                  Who&apos;s free now?
                </button>
                <span className="text-xs text-gray-500">{freeNowUserIds.size} available now</span>
              </div>
              <div className="rounded-lg border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">YOUR STATUS</p>
                <div className="flex flex-wrap gap-2">
                  {['ONLINE', 'AWAY', 'BUSY', 'IN_INTERVIEW', 'OFFLINE'].map((s) => (
                    <button key={s} className={`text-xs px-2 py-1 rounded border ${myStatus?.status === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'}`} onClick={() => setMyStatus(s)}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Input placeholder="Set custom message" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {EMOJIS.map((e) => (
                      <button key={e} className={`w-7 h-7 rounded border ${statusEmoji === e ? 'bg-orange-100 border-orange-400' : 'bg-white'}`} onClick={() => setStatusEmoji(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <button className="text-xs text-gray-500 mt-2 underline" onClick={() => { setStatusMessage(''); setStatusEmoji('') }}>
                    Clear status
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {visibleTeamRows.map(({ admin, status, row, days }) => (
                  <div key={admin.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold" style={{ backgroundColor: admin.color }}>
                        {admin.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{admin.name}</p>
                          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.OFFLINE}`} />
                          <span className="text-[11px] text-gray-500">{status.replace('_', ' ')}</span>
                        </div>
                        {row?.statusMessage ? <p className="text-xs text-gray-600 mt-1">{row.statusEmoji ? `${row.statusEmoji} ` : ''}{row.statusMessage}</p> : null}
                        {(status === 'OFFLINE' || status === 'AWAY') && row?.lastSeenAt ? (
                          <p className="text-[11px] text-gray-500 mt-1">Last seen {toET(new Date(row.lastSeenAt))}</p>
                        ) : null}
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {days.map((d) => (
                            <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{DAYS[d]}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showAvailabilityModal ? (
        <AvailabilityModal
          currentUserId={currentUserId}
          initialRows={availability.filter((a) => a.userId === currentUserId)}
          onClose={() => setShowAvailabilityModal(false)}
          onSaved={() => {
            setShowAvailabilityModal(false)
            fetchCalendar()
          }}
        />
      ) : null}

      {noteDraft ? (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold">Add a note for {new Date(noteDraft.date).toLocaleDateString()}</h3>
            <textarea
              className="mt-3 w-full border rounded-md p-2 text-sm min-h-[110px]"
              value={noteDraft.content}
              onChange={(e) => setNoteDraft({ ...noteDraft, content: e.target.value })}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {['#fde68a', '#bfdbfe', '#fecaca', '#bbf7d0', '#ddd6fe', '#fdba74'].map((c) => (
                  <button key={c} className={`w-6 h-6 rounded border ${noteDraft.color === c ? 'ring-2 ring-orange-500' : ''}`} style={{ backgroundColor: c }} onClick={() => setNoteDraft({ ...noteDraft, color: c })} />
                ))}
              </div>
              <label className="text-xs flex items-center gap-2">
                <input type="checkbox" checked={noteDraft.isPinned} onChange={(e) => setNoteDraft({ ...noteDraft, isPinned: e.target.checked })} />
                Pin this note
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteDraft(null)}>Cancel</Button>
              <Button onClick={createNote}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MonthView({
  weekStart,
  availability,
  interviews,
  notes,
  adminsById,
  onOpenDay,
}: {
  weekStart: Date
  availability: Availability[]
  interviews: Interview[]
  notes: CalendarNote[]
  adminsById: Map<string, AdminUser>
  onOpenDay: (day: Date) => void
}) {
  const first = new Date(weekStart)
  first.setDate(1)
  const gridStart = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b">
        {DAYS.map((d) => <div key={d} className="p-2 text-xs font-semibold text-gray-600">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAvailUsers = Array.from(new Set(availability.filter((a) => a.dayOfWeek === day.getDay()).map((a) => a.userId)))
          const dayInterviews = interviews.filter((i) => sameDay(new Date(i.scheduledAt), day))
          const hasNote = notes.some((n) => sameDay(new Date(n.date), day))
          return (
            <button key={day.toISOString()} className="min-h-[90px] border-b border-r p-2 text-left hover:bg-orange-50/40 transition" onClick={() => onOpenDay(day)}>
              <div className="text-xs text-gray-500">{day.getDate()}</div>
              <div className="flex gap-1 mt-1">
                {dayAvailUsers.slice(0, 5).map((uid) => <Circle key={uid} className="w-2.5 h-2.5 fill-current" style={{ color: adminsById.get(uid)?.color || '#94a3b8' }} />)}
                {dayAvailUsers.length > 5 ? <span className="text-[10px] text-gray-500">+{dayAvailUsers.length - 5}</span> : null}
              </div>
              {dayInterviews.length > 0 ? <div className="mt-1 text-[10px] inline-block rounded bg-orange-100 text-orange-700 px-1.5 py-0.5">{dayInterviews.length} interviews</div> : null}
              {hasNote ? <div className="mt-1 text-[10px] text-gray-500"><Pin className="w-3 h-3 inline mr-0.5" />Note</div> : null}
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
      body: JSON.stringify({
        availability: rows.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startHour: r.startHour,
          startMinute: r.startMinute,
          endHour: r.endHour,
          endMinute: r.endMinute,
          label: r.label,
          color: r.color,
          isActive: true,
        })),
      }),
    })
    onSaved()
  }

  const clearAll = async () => {
    setRows([])
    await fetch('/api/admin/team/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ availability: [] }),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 p-3 sm:p-6 overflow-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-auto">
        <div className="p-5 border-b">
          <h3 className="text-xl font-semibold">Set Your Availability</h3>
          <p className="text-sm text-gray-600 mt-1">Other admins will see when you&apos;re available for interviews and coordination.</p>
        </div>
        <div className="p-5 space-y-3">
          {DAYS.map((day, dayOfWeek) => {
            const dayRows = rows.filter((r) => r.dayOfWeek === dayOfWeek)
            return (
              <div key={day} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{day}</p>
                  <button
                    className="text-xs text-orange-600 underline"
                    onClick={() => setRows((prev) => [...prev, { id: `new-${dayOfWeek}-${prev.length}`, userId: currentUserId, dayOfWeek, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0, label: '', color: AVAIL_COLORS[0] }])}
                  >
                    + Add another time range
                  </button>
                </div>
                {dayRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Input type="time" step={1800} value={`${String(row.startHour).padStart(2, '0')}:${String(row.startMinute).padStart(2, '0')}`} onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number)
                        setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, startHour: h, startMinute: m } : x)))
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input type="time" step={1800} value={`${String(row.endHour).padStart(2, '0')}:${String(row.endMinute).padStart(2, '0')}`} onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number)
                        setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, endHour: h, endMinute: m } : x)))
                      }} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Label</Label>
                      <Input value={row.label || ''} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, label: e.target.value } : x)))} placeholder="Interview only, working remotely..." />
                    </div>
                    <div>
                      <Label className="text-xs">Color</Label>
                      <div className="flex gap-1 mt-2">
                        {AVAIL_COLORS.map((c) => (
                          <button key={c} className={`w-5 h-5 rounded border ${row.color === c ? 'ring-2 ring-gray-700' : ''}`} style={{ backgroundColor: c }} onClick={() => setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, color: c } : x)))} />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <button className="text-xs text-red-600 underline" onClick={() => setRows((prev) => prev.filter((x) => x.id !== row.id))}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-2">Preview</p>
            <div className="flex flex-wrap gap-2">
              {rows.slice(0, 8).map((r) => (
                <div key={r.id} className="text-xs px-2 py-1 rounded border" style={{ backgroundColor: `${r.color}66`, borderColor: r.color }}>
                  {DAYS[r.dayOfWeek]} {String(r.startHour).padStart(2, '0')}:{String(r.startMinute).padStart(2, '0')}-{String(r.endHour).padStart(2, '0')}:{String(r.endMinute).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-between">
          <button className="text-sm text-red-600 underline" onClick={clearAll}>Clear all</button>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
