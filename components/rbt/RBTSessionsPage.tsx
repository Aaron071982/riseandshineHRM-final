'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, Timer, AlertCircle } from 'lucide-react'
import { formatDurationHM, formatDurationHMS } from '@/lib/attendance'

type SessionRow = {
  id: string
  clockInTime: string
  clockOutTime: string | null
  totalHours: number | null
  source: 'WEB_MANUAL' | 'MOBILE_APP'
  durationSeconds: number
  durationLabel: string
  status: 'COMPLETE' | 'IN_PROGRESS' | 'FLAGGED'
}

type CurrentSession = {
  id: string
  clockInTime: string
  clockOutTime: string | null
  source: 'WEB_MANUAL' | 'MOBILE_APP'
  durationSeconds: number
  durationLabel: string
  status: 'COMPLETE' | 'IN_PROGRESS' | 'FLAGGED'
}

type HistoryResponse = {
  entries: SessionRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: { hoursThisWeek: number; hoursThisMonth: number; totalSessions: number }
}

function formatETDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatETTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function durationLabelFromHours(totalHours: number | null): string {
  if (totalHours == null) return '—'
  return formatDurationHM(Math.round(totalHours * 3600))
}

export default function RBTSessionsPage() {
  const { showToast } = useToast()
  const [now, setNow] = useState(new Date())
  const [clockInEpochMs, setClockInEpochMs] = useState<number | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [clockActionLoading, setClockActionLoading] = useState(false)
  const [confirmClockOutOpen, setConfirmClockOutOpen] = useState(false)
  const [current, setCurrent] = useState<CurrentSession | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [page, setPage] = useState(1)
  const [completion, setCompletion] = useState<{ duration: string; clockedOutAt: string } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadCurrent = useCallback(async () => {
    setLoadingCurrent(true)
    try {
      const res = await fetch('/api/rbt/sessions/current', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load current session')
      setCurrent(data.current)
      setClockInEpochMs(data.current?.clockInTime ? new Date(data.current.clockInTime).getTime() : null)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoadingCurrent(false)
    }
  }, [showToast])

  const loadHistory = useCallback(async (targetPage: number) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/rbt/sessions/history?page=${targetPage}&limit=30`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load session history')
      setHistory(data)
      setPage(data.pagination.page)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoadingHistory(false)
    }
  }, [showToast])

  useEffect(() => {
    loadCurrent()
    loadHistory(1)
  }, [loadCurrent, loadHistory])

  const elapsedSeconds = useMemo(() => {
    if (!clockInEpochMs) return 0
    // Derive elapsed from persisted DB clockInTime so refreshes continue accurately.
    return Math.max(0, Math.floor((now.getTime() - clockInEpochMs) / 1000))
  }, [clockInEpochMs, now])

  const handleClockIn = async () => {
    setClockActionLoading(true)
    setCompletion(null)
    try {
      const res = await fetch('/api/rbt/sessions/clock-in', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clock in')
      showToast(`Clocked in at ${formatETTime(data.timeEntry.clockInTime)}`, 'success')
      await Promise.all([loadCurrent(), loadHistory(1)])
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setClockActionLoading(false)
    }
  }

  const handleConfirmClockOut = async () => {
    setClockActionLoading(true)
    try {
      const res = await fetch('/api/rbt/sessions/clock-out', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clock out')
      setCompletion({
        duration: data.durationLabel,
        clockedOutAt: formatETTime(data.timeEntry.clockOutTime),
      })
      showToast('Session completed', 'success')
      setConfirmClockOutOpen(false)
      await Promise.all([loadCurrent(), loadHistory(1)])
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setClockActionLoading(false)
    }
  }

  const lastSession = history?.entries?.[0] ?? null
  const isClockedIn = !!current

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Sessions</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Clock in/out and review your recent session history.</p>
      </div>

      <Card className="border-2 border-green-200 dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Timer className="h-6 w-6 text-green-600" />
            Clock In / Out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(loadingCurrent || loadingHistory) && (
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading sessions...</p>
          )}

          {!isClockedIn && !loadingCurrent && (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-[var(--border-subtle)] p-5 bg-white dark:bg-[var(--bg-elevated)]">
                <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Current time (ET)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{formatETDateTime(now)}</p>
                <p className="mt-2 text-gray-700 dark:text-[var(--text-secondary)]">You are not currently clocked in</p>
                <Button
                  onClick={handleClockIn}
                  disabled={clockActionLoading}
                  className="mt-5 h-14 w-full text-lg bg-green-600 hover:bg-green-700 text-white"
                >
                  Clock In
                </Button>
              </div>
              <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                {lastSession ? (
                  <span>
                    Last session: {formatETDateTime(lastSession.clockInTime)} — {durationLabelFromHours(lastSession.totalHours)}
                  </span>
                ) : (
                  <span>No sessions yet</span>
                )}
              </div>
            </>
          )}

          {isClockedIn && current && !loadingCurrent && (
            <div className="rounded-xl border border-green-300 dark:border-green-700 p-5 bg-green-50/60 dark:bg-green-950/20">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold text-green-800 dark:text-green-200">Session in progress</span>
              </div>
              <p className="mt-2 text-gray-700 dark:text-[var(--text-secondary)]">Started at {formatETTime(current.clockInTime)}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{formatDurationHMS(elapsedSeconds)}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Today: {new Date(now).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              {elapsedSeconds >= 8 * 3600 && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-amber-900 text-sm">
                  You&apos;ve been clocked in for over 8 hours. Please clock out if your session has ended.
                </div>
              )}

              <Button
                onClick={() => setConfirmClockOutOpen(true)}
                disabled={clockActionLoading}
                className="mt-5 h-14 w-full text-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Clock Out
              </Button>
            </div>
          )}

          {completion && (
            <div className="rounded-xl border border-green-300 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Session Complete!
              </div>
              <p className="text-sm text-green-800 mt-1">Duration: {completion.duration}</p>
              <p className="text-sm text-green-800">Clocked out at {completion.clockedOutAt}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Session History</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border p-2 dark:border-[var(--border-subtle)]">
              This week: <strong>{(history?.summary.hoursThisWeek ?? 0).toFixed(2)} hours</strong>
            </div>
            <div className="rounded-md border p-2 dark:border-[var(--border-subtle)]">
              This month: <strong>{(history?.summary.hoursThisMonth ?? 0).toFixed(2)} hours</strong>
            </div>
            <div className="rounded-md border p-2 dark:border-[var(--border-subtle)]">
              Total sessions: <strong>{history?.summary.totalSessions ?? 0}</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading history...</p>
          ) : history && history.entries.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b dark:border-[var(--border-subtle)]">
                      <th className="py-2">Date</th>
                      <th className="py-2">Clock In</th>
                      <th className="py-2">Clock Out</th>
                      <th className="py-2">Duration</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.entries.map((entry) => (
                      <tr key={entry.id} className="border-b dark:border-[var(--border-subtle)]">
                        <td className="py-2">{new Date(entry.clockInTime).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td className="py-2">{formatETTime(entry.clockInTime)}</td>
                        <td className="py-2">{entry.clockOutTime ? formatETTime(entry.clockOutTime) : '—'}</td>
                        <td className="py-2">{entry.clockOutTime ? durationLabelFromHours(entry.totalHours) : 'In progress'}</td>
                        <td className="py-2">
                          {entry.status === 'COMPLETE' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>}
                          {entry.status === 'IN_PROGRESS' && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>}
                          {entry.status === 'FLAGGED' && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Flagged
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => loadHistory(Math.max(1, page - 1))}
                  disabled={!history || page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                  Page {history.pagination.page} of {history.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => loadHistory(Math.min(history.pagination.totalPages, page + 1))}
                  disabled={!history || page >= history.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No sessions yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmClockOutOpen} onOpenChange={setConfirmClockOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure you want to clock out?</DialogTitle>
            <DialogDescription>
              You&apos;ve been clocked in for {formatDurationHM(elapsedSeconds)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClockOutOpen(false)}>
              Keep Working
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmClockOut} disabled={clockActionLoading}>
              Clock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
