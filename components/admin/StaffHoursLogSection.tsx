'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type StaffHoursLogType = 'BCBA' | 'BILLING' | 'MARKETING' | 'CALL_CENTER' | 'DEV_TEAM_MEMBER'

interface LogEntry {
  id: string
  periodStart: string
  periodEnd: string
  hours: number
  note: string | null
  createdAt: string
}

interface StaffHoursLogSectionProps {
  employeeType: StaffHoursLogType
  referenceId: string
}

export default function StaffHoursLogSection({ employeeType, referenceId }: StaffHoursLogSectionProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchLogs() {
      try {
        const res = await fetch(
          `/api/admin/employees/hours?employeeType=${encodeURIComponent(employeeType)}&referenceId=${encodeURIComponent(referenceId)}`,
          { credentials: 'include' }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setLogs(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchLogs()
    return () => { cancelled = true }
  }, [employeeType, referenceId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const periodStart = formData.get('periodStart') as string
    const periodEnd = formData.get('periodEnd') as string
    const hours = parseFloat((formData.get('hours') as string) || '0')
    if (!periodStart || !periodEnd || isNaN(hours) || hours < 0) {
      setError('Please fill period and hours.')
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch('/api/admin/employees/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeType,
          referenceId,
          periodStart,
          periodEnd,
          hours,
          note: (formData.get('note') as string)?.trim() || undefined,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to log hours')
        setSubmitting(false)
        return
      }
      setLogs((prev) => [
        {
          id: data.id,
          periodStart,
          periodEnd,
          hours,
          note: (formData.get('note') as string)?.trim() || null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      form.reset()
    } catch {
      setError('An error occurred.')
    }
    setSubmitting(false)
  }

  return (
    <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle>Log hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="periodStart">Period start</Label>
            <Input id="periodStart" name="periodStart" type="date" required className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodEnd">Period end</Label>
            <Input id="periodEnd" name="periodEnd" type="date" required className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" name="hours" type="number" step="0.25" min="0" required className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" name="note" placeholder="Optional" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </form>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div>
          <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">Logged hours</h4>
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No hours logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center gap-2 text-sm py-2 border-b dark:border-[var(--border-subtle)] last:border-0"
                >
                  <span className="font-medium">{formatDate(log.periodStart)} – {formatDate(log.periodEnd)}</span>
                  <span className="text-gray-600 dark:text-[var(--text-tertiary)]">{log.hours} hrs</span>
                  {log.note && <span className="text-gray-500 dark:text-[var(--text-disabled)]">· {log.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
