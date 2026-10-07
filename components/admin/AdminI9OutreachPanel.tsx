'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import type { I9OutreachOverview } from '@/lib/compliance/i9Outreach'

type Action = 'test-request' | 'test-reminder' | 'send' | 'reminders'

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '—'
}

export default function AdminI9OutreachPanel() {
  const { showToast } = useToast()
  const [data, setData] = useState<I9OutreachOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [preview, setPreview] = useState<'request' | 'reminder' | null>(null)
  const [showRecipients, setShowRecipients] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/compliance/i9-outreach', { credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Failed to load I-9 outreach')
      return
    }
    setError(null)
    setData(json)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: Action) => {
    if (action === 'send' && data) {
      const ok = window.confirm(
        `Email the Form I-9 request to ${data.pendingRequestCount} staff member(s) who don't have an I-9 on file?\n\nEach person receives the request only once. Day-3 and day-7 reminders then go out automatically to anyone still missing an I-9.`
      )
      if (!ok) return
    }
    setBusy(action)
    try {
      const body =
        action === 'test-request'
          ? { action: 'test', kind: 'request' }
          : action === 'test-reminder'
            ? { action: 'test', kind: 'reminder' }
            : action === 'send'
              ? { action: 'send', confirm: true }
              : { action: 'reminders' }
      const res = await fetch('/api/admin/compliance/i9-outreach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      showToast(json.message || json.error || (res.ok ? 'Done' : 'Failed'), res.ok ? 'success' : 'error')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
      </Card>
    )
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Mail className="h-5 w-5 text-orange-600" />
          I-9 collection outreach
          {data.requestFirstSentAt ? (
            <Badge className="bg-blue-600">First sent {fmt(data.requestFirstSentAt)}</Badge>
          ) : (
            <Badge variant="outline">Not sent yet</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-gray-600 dark:text-[var(--text-secondary)]">
          Emails every hired, currently employed staff member with no Form I-9 on file, asking them to
          upload it at{' '}
          <a href={data.i9TaskLink} className="text-orange-600 underline" target="_blank" rel="noreferrer">
            {data.i9TaskLink}
          </a>
          . Due 7 days after sending. Reminders go out on day 3 and day 7, only to people still missing an
          I-9. Terminated and departed staff are never included.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Missing an I-9 now" value={data.recipients.length} />
          <Stat label="Not yet emailed" value={data.pendingRequestCount} />
          <Stat label="Day-3 reminders sent" value={data.day3SentCount} />
          <Stat label="Day-7 reminders sent" value={data.day7SentCount} />
        </div>

        {!data.resendConfigured && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
            Email sending is not configured in this environment (RESEND_API_KEY missing).
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(preview === 'request' ? null : 'request')}>
            {preview === 'request' ? 'Hide' : 'Preview'} request email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreview(preview === 'reminder' ? null : 'reminder')}>
            {preview === 'reminder' ? 'Hide' : 'Preview'} reminder email
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run('test-request')}>
            {busy === 'test-request' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Send test request to me
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run('test-reminder')}>
            {busy === 'test-reminder' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Send test reminder to me
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRecipients((v) => !v)}>
            {showRecipients ? 'Hide' : 'Show'} recipients
          </Button>
        </div>

        {preview && (
          <iframe
            title={`${preview} email preview`}
            srcDoc={preview === 'request' ? data.requestHtml : data.reminderHtml}
            className="h-[560px] w-full rounded border"
            sandbox=""
          />
        )}

        {showRecipients && (
          <div className="max-h-80 overflow-y-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-left text-gray-500 dark:bg-[var(--bg-elevated)]">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Request sent</th>
                </tr>
              </thead>
              <tbody>
                {data.recipients.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{fmt(r.requestSentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!!busy || data.pendingRequestCount === 0 || !data.resendConfigured}
            onClick={() => run('send')}
          >
            {busy === 'send' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send I-9 request to {data.pendingRequestCount} staff
          </Button>
          {data.requestFirstSentAt && (
            <Button variant="outline" disabled={!!busy} onClick={() => run('reminders')}>
              {busy === 'reminders' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send due reminders now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
