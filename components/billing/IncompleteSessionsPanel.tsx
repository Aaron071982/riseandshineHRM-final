'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Copy, Loader2, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { ARTEMIS_STATUS } from '@/lib/billing/sessionStatus'
import type { BreakdownEntry } from '@/components/billing/PayrollStatusBreakdown'

function employeeName(e: BreakdownEntry): string {
  if (e.rbtProfile) return `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.trim()
  if (e.payrollOnly) return e.payrollOnly.fullName
  return e.providerNameRaw
}

function employeeEmail(e: BreakdownEntry): string | null {
  return e.rbtProfile?.email ?? e.payrollOnly?.email ?? null
}

export default function IncompleteSessionsPanel({
  cycleId,
  cycleLocked,
  entries,
}: {
  cycleId: string
  cycleLocked: boolean
  entries: BreakdownEntry[]
}) {
  const [threshold, setThreshold] = useState(1)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const flagged = useMemo(() => {
    return entries
      .filter((e) => !e.isExcluded)
      .map((e) => {
        const incomplete = e.sessions.filter((s) => s.sessionStatus === ARTEMIS_STATUS.INCOMPLETE)
        const hours = incomplete.reduce((sum, s) => sum + s.actualMinutes / 60, 0)
        return {
          entry: e,
          name: employeeName(e),
          email: employeeEmail(e),
          incomplete,
          hours,
        }
      })
      .filter((r) => r.incomplete.length >= threshold)
      .sort((a, b) => b.incomplete.length - a.incomplete.length)
  }, [entries, threshold])

  if (flagged.length === 0) return null

  const copyEmails = () => {
    const emails = flagged.map((r) => r.email).filter(Boolean).join(', ')
    void navigator.clipboard.writeText(emails)
    setMessage('Emails copied to clipboard')
    setTimeout(() => setMessage(null), 2000)
  }

  const sendReminders = async () => {
    setSending(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}/incomplete-reminders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threshold,
          entryIds: flagged.map((r) => r.entry.id),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Send failed')
        return
      }
      setMessage(`Sent ${data.sent} email(s)${data.failed ? `, ${data.failed} failed` : ''}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          RBTs with Incomplete Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-32">
            <Label className="text-xs">Min incomplete sessions</Label>
            <Input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="h-9"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyEmails}>
            <Copy className="w-4 h-4 mr-1" />
            Copy emails
          </Button>
          {!cycleLocked && (
            <Button
              type="button"
              size="sm"
              className="bg-[#0D9488] hover:bg-teal-700 text-white"
              disabled={sending}
              onClick={() => void sendReminders()}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-1" />
              )}
              Send reminder email
            </Button>
          )}
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>
        <div className="space-y-3">
          {flagged.map((r) => (
            <div key={r.entry.id} className="border rounded-lg p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <p className="text-amber-700 font-medium">
                  {r.incomplete.length} session{r.incomplete.length === 1 ? '' : 's'} ·{' '}
                  {r.hours.toFixed(1)} hrs
                </p>
              </div>
              {r.email && (
                <a href={`mailto:${r.email}`} className="text-[#0D9488] text-xs underline">
                  {r.email}
                </a>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Dates:{' '}
                {r.incomplete
                  .map((s) => format(new Date(s.dos), 'M/d/yy'))
                  .join(', ')}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
