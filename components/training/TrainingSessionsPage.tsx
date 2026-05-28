'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, LayoutList, Calendar as CalIcon } from 'lucide-react'
import CreateSessionModal from '@/components/training/CreateSessionModal'
import { cn } from '@/lib/utils'

type SessionRow = {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  meetingUrl: string
  maxAttendees: number
  currentAttendees: number
  status: string
}

export default function TrainingSessionsPage() {
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all' | 'cancelled'>('upcoming')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const apiFilter = view === 'calendar' ? 'all' : filter

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/training/sessions?filter=${apiFilter}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setSessions(data.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }, [apiFilter])

  useEffect(() => {
    load()
  }, [load])

  const byDay = useMemo(() => {
    const list =
      view === 'calendar'
        ? sessions.filter((s) => {
            const d = new Date(s.startTime)
            return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth()
          })
        : sessions
    const m = new Map<string, SessionRow[]>()
    for (const s of list) {
      const d = new Date(s.startTime)
      const key = d.toDateString()
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    return m
  }, [sessions, calMonth, view])

  const monthGrid = useMemo(() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const firstDow = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return { y, m, cells, daysInMonth }
  }, [calMonth])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === 'list' ? 'default' : 'ghost'}
              className={view === 'list' ? 'bg-[#e36f1e]' : ''}
              onClick={() => setView('list')}
            >
              <LayoutList className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'calendar' ? 'default' : 'ghost'}
              className={view === 'calendar' ? 'bg-[#e36f1e]' : ''}
              onClick={() => setView('calendar')}
            >
              <CalIcon className="w-4 h-4 mr-1" />
              Calendar
            </Button>
          </div>
          <Button className="bg-[#E4893D] hover:bg-[#d35f1a]" onClick={() => setCreateOpen(true)}>
            + Create New Session
          </Button>
        </div>
      </div>

      {view === 'list' && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['upcoming', 'Upcoming'],
              ['past', 'Past'],
              ['all', 'All'],
              ['cancelled', 'Cancelled'],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={filter === k ? 'default' : 'outline'}
              className={filter === k ? 'bg-[#e36f1e]' : ''}
              onClick={() => setFilter(k)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
        </div>
      ) : view === 'list' ? (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-gray-500">No sessions in this view.</p>
          ) : (
            sessions.map((s) => {
              const pct = Math.min(100, (s.currentAttendees / Math.max(1, s.maxAttendees)) * 100)
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-wrap gap-4 justify-between items-start">
                    <div>
                      <p className="text-xl font-bold">
                        {new Date(s.startTime).toLocaleString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'America/New_York',
                        })}{' '}
                        ET
                      </p>
                      <p className="font-medium mt-1">{s.title}</p>
                      {s.description && <p className="text-sm text-gray-600 mt-1">{s.description}</p>}
                      <div className="mt-3 max-w-xs">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>
                            {s.currentAttendees} / {s.maxAttendees} attendees
                          </span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full bg-[#E4893D]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-block mt-2 text-xs px-2 py-0.5 rounded-full',
                          s.status === 'SCHEDULED' && 'bg-green-100 text-green-800',
                          s.status === 'CANCELLED' && 'bg-red-100 text-red-800',
                          s.status === 'COMPLETED' && 'bg-gray-100 text-gray-800'
                        )}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <a
                        href={s.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[#e36f1e] underline"
                      >
                        Meeting URL
                      </a>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/training/sessions/${s.id}`}>View details</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
            >
              ← Prev
            </Button>
            <p className="font-semibold">
              {calMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
            >
              Next →
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />
              const date = new Date(monthGrid.y, monthGrid.m, day)
              const key = date.toDateString()
              const daySessions = byDay.get(key) ?? []
              return (
                <div
                  key={day}
                  className="min-h-[88px] border rounded-md p-1 text-left align-top bg-white dark:bg-[var(--bg-elevated)]"
                >
                  <span className="text-xs text-gray-500">{day}</span>
                  {daySessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/training/sessions/${s.id}`}
                      className="block mt-1 text-[10px] leading-tight px-1 py-0.5 rounded bg-orange-100 text-orange-900 truncate"
                    >
                      {new Date(s.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
          <p className="text-sm text-gray-500">
            Tip: open an empty day with &quot;Create&quot; from the dashboard or list view — calendar shows scheduled Artemis sessions.
          </p>
        </div>
      )}

      <CreateSessionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  )
}
