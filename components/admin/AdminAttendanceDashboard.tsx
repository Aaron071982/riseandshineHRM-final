'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

type SummaryRow = {
  rbtProfileId: string
  rbtName: string
  email: string | null
  phoneNumber: string | null
  hoursThisWeek: number
  hoursThisMonth: number
  totalSessions: number
  lastClockIn: string | null
  status: 'CLOCKED_IN' | 'CLOCKED_OUT' | 'FORGOT_CLOCK_OUT' | 'LONG_SESSION'
  elapsedHours: number | null
}

type DetailedRow = {
  id: string
  rbtProfileId: string
  rbtName: string
  email: string | null
  phoneNumber: string | null
  clockInTime: string
  clockOutTime: string | null
  totalHours: number | null
  durationHours: number
  durationLabel: string
  source: 'WEB_MANUAL' | 'MOBILE_APP'
  noClockOutFlag: boolean
  longSessionFlag: boolean
}

type DashboardData = {
  summaryRows: SummaryRow[]
  detailedRows: DetailedRow[]
  detailedPagination: { page: number; limit: number; total: number; totalPages: number }
  cards: { totalClockedInNow: number; totalHoursWeekAll: number; totalHoursMonthAll: number; flaggedSessionsCount: number }
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function excelSafeCell(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`
  return value
}

export default function AdminAttendanceDashboard() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'summary' | 'detailed'>('summary')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<'this_week' | 'this_month' | 'custom'>('this_week')
  const [status, setStatus] = useState<'ALL' | 'CLOCKED_IN' | 'FLAGGED'>('ALL')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<DetailedRow | null>(null)
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [deleting, setDeleting] = useState<DetailedRow | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '50')
    params.set('search', search)
    params.set('range', range)
    params.set('status', status)
    if (flaggedOnly) params.set('flaggedOnly', '1')
    if (range === 'custom') {
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
    }
    return params.toString()
  }, [page, search, range, status, flaggedOnly, startDate, endDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/attendance/dashboard?${query}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load attendance')
      setData(json)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [query, showToast])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams(query)
      params.set('page', '1')
      params.set('limit', '10000')
      const res = await fetch(`/api/admin/attendance/dashboard?${params.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to export CSV')
      const rows: DetailedRow[] = json.detailedRows || []
      const csvRows = [
        ['RBT Name', 'Email', 'Phone', 'Date', 'Clock In', 'Clock Out', 'Duration (hours)', 'Duration (h:mm)', 'Source', 'Flagged'],
        ...rows.map((r) => [
          excelSafeCell(r.rbtName),
          excelSafeCell(r.email || ''),
          excelSafeCell(r.phoneNumber || ''),
          new Date(r.clockInTime).toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          fmtDateTime(r.clockInTime),
          r.clockOutTime ? fmtDateTime(r.clockOutTime) : 'Still clocked in',
          String(r.durationHours.toFixed(2)),
          r.durationLabel,
          r.source === 'WEB_MANUAL' ? 'Web Manual' : 'Mobile',
          r.noClockOutFlag || r.longSessionFlag ? 'Yes' : 'No',
        ]),
      ]
      const csv = csvRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const csvWithBom = `\uFEFF${csv}`
      const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const today = new Date().toISOString().slice(0, 10)
      const start = startDate || (range === 'this_week' ? 'this-week' : range === 'this_month' ? 'this-month' : today)
      const end = endDate || today
      a.download = `rise-shine-attendance-${start}-${end}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      showToast(`CSV exported (${rows.length} rows)`, 'success')
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    const body = {
      clockInTime: editClockIn ? new Date(editClockIn).toISOString() : null,
      clockOutTime: editClockOut ? new Date(editClockOut).toISOString() : null,
    }
    const res = await fetch(`/api/admin/attendance/entries/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error || 'Failed to update', 'error')
      return
    }
    setEditing(null)
    showToast('Entry updated', 'success')
    load()
  }

  const deleteEntry = async () => {
    if (!deleting) return
    const res = await fetch(`/api/admin/attendance/entries/${deleting.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error || 'Failed to delete', 'error')
      return
    }
    setDeleting(null)
    showToast('Entry deleted', 'success')
    load()
  }

  const manualClockOut = async (row: DetailedRow) => {
    const res = await fetch(`/api/admin/attendance/entries/${row.id}/clock-out`, {
      method: 'POST',
      credentials: 'include',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error || 'Failed to clock out entry', 'error')
      return
    }
    showToast('Entry clocked out', 'success')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Attendance & Hours</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
            Monitor sessions, flags, and payroll-ready logs. Lists RBTs with status <strong>Hired</strong> only—candidates still in the pipeline are excluded.
          </p>
        </div>
        <Button onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Clocked In Now</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.cards.totalClockedInNow ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Hours This Week</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(data?.cards.totalHoursWeekAll ?? 0).toFixed(2)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Hours This Month</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(data?.cards.totalHoursMonthAll ?? 0).toFixed(2)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Flagged Sessions</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.cards.flaggedSessionsCount ?? 0}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input className="rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" placeholder="Search RBT name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            <select className="rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={range} onChange={(e) => { setRange(e.target.value as any); setPage(1) }}>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="custom">Custom</option>
            </select>
            {range === 'custom' && (
              <>
                <input type="date" className="rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" className="rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </>
            )}
            <select className="rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1) }}>
              <option value="ALL">All statuses</option>
              <option value="CLOCKED_IN">Clocked In</option>
              <option value="FLAGGED">Flagged</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-2">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(1) }} />
              Flagged only
            </label>
            <Button variant="outline" onClick={load}>Apply</Button>
          </div>
          <div className="flex gap-2">
            <Button variant={tab === 'summary' ? 'default' : 'outline'} onClick={() => setTab('summary')}>Summary View</Button>
            <Button variant={tab === 'detailed' ? 'default' : 'outline'} onClick={() => setTab('detailed')}>Detailed Log</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Loading...</p> : null}

      {tab === 'summary' && (
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-[var(--border-subtle)]">
                    <th className="text-left py-2">RBT Name</th>
                    <th className="text-left py-2">Hours This Week</th>
                    <th className="text-left py-2">Hours This Month</th>
                    <th className="text-left py-2">Total Sessions</th>
                    <th className="text-left py-2">Last Clock In</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.summaryRows || []).map((row) => (
                    <tr key={row.rbtProfileId} className="border-b dark:border-[var(--border-subtle)]">
                      <td className="py-2"><Link className="text-orange-600 hover:underline" href={`/admin/rbts/${row.rbtProfileId}`}>{row.rbtName}</Link></td>
                      <td>{row.hoursThisWeek.toFixed(2)}</td>
                      <td>{row.hoursThisMonth.toFixed(2)}</td>
                      <td>{row.totalSessions}</td>
                      <td>{fmtDateTime(row.lastClockIn)}</td>
                      <td>
                        {row.status === 'CLOCKED_IN' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Clocked In</Badge>}
                        {row.status === 'CLOCKED_OUT' && <Badge variant="secondary">Clocked Out</Badge>}
                        {row.status === 'FORGOT_CLOCK_OUT' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Forgot to Clock Out</Badge>}
                        {row.status === 'LONG_SESSION' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Long Session</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'detailed' && (
        <Card>
          <CardHeader><CardTitle>Detailed Log</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-[var(--border-subtle)]">
                    <th className="text-left py-2">RBT Name</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Clock In</th>
                    <th className="text-left py-2">Clock Out</th>
                    <th className="text-left py-2">Duration</th>
                    <th className="text-left py-2">Source</th>
                    <th className="text-left py-2">Flags</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.detailedRows || []).map((row) => (
                    <tr key={row.id} className="border-b dark:border-[var(--border-subtle)]">
                      <td className="py-2"><Link className="text-orange-600 hover:underline" href={`/admin/rbts/${row.rbtProfileId}`}>{row.rbtName}</Link></td>
                      <td>{new Date(row.clockInTime).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td>{fmtDateTime(row.clockInTime)}</td>
                      <td>{row.clockOutTime ? fmtDateTime(row.clockOutTime) : 'Still clocked in'}</td>
                      <td>{row.durationLabel}</td>
                      <td>{row.source === 'WEB_MANUAL' ? 'Web Manual' : 'Mobile'}</td>
                      <td>
                        {row.noClockOutFlag ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100">No clock out</Badge> : null}
                        {row.longSessionFlag ? <Badge className="ml-1 bg-amber-100 text-amber-800 hover:bg-amber-100">Long session</Badge> : null}
                      </td>
                      <td className="space-x-1">
                        {!row.clockOutTime && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => manualClockOut(row)}>
                            Clock Out Now
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(row)
                            setEditClockIn(new Date(row.clockInTime).toISOString().slice(0, 16))
                            setEditClockOut(row.clockOutTime ? new Date(row.clockOutTime).toISOString().slice(0, 16) : '')
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={(data?.detailedPagination.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                Page {data?.detailedPagination.page ?? 1} of {data?.detailedPagination.totalPages ?? 1}
              </span>
              <Button
                variant="outline"
                disabled={(data?.detailedPagination.page ?? 1) >= (data?.detailedPagination.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>Adjust clock in/out values for this record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Clock In</label>
              <input type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Clock Out</label>
              <input type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm dark:bg-[var(--bg-input)]" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteEntry}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
