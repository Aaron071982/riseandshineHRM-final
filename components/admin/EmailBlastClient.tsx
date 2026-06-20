'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BT_THANK_YOU_CAMPAIGN } from '@/lib/email-blast/constants'
import { Loader2, Mail, Send, Users } from 'lucide-react'

type Preview = {
  slug: string
  title: string
  subject: string
  description: string
  recipientCount: number
  recipientsSample: { id: string; firstName: string; lastName: string; email: string }[]
  htmlPreview: string
  alreadySent: boolean
  completedAt: string | null
  sentByName: string | null
  successCount: number | null
  failureCount: number | null
  resendConfigured: boolean
  adminEmail: string | null
}

export default function EmailBlastClient() {
  const slug = BT_THANK_YOU_CAMPAIGN.slug
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/email-blast/${slug}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load campaign')
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  async function handleTestSend() {
    setTesting(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/admin/email-blast/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Test send failed')
      setSendResult(data.message)
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : 'Test send failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/admin/email-blast/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Send failed')
      }
      setSendResult(data.message)
      setConfirmOpen(false)
      await loadPreview()
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : 'Send failed')
      setConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading campaign…
      </div>
    )
  }

  if (error || !preview) {
    return (
      <Card>
        <CardContent className="pt-6 text-destructive">{error ?? 'Campaign unavailable'}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#E4893D]" />
            {preview.title}
          </CardTitle>
          <CardDescription>{preview.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview.alreadySent && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">Manual send required</p>
              <p className="text-blue-800 dark:text-blue-200 mt-1">
                Deploying to Vercel does not send emails. Review the preview below, then click{' '}
                <strong>Send test to me</strong> or confirm the full blast.
              </p>
            </div>
          )}

          {!preview.resendConfigured && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm">
              <p className="font-medium text-red-900 dark:text-red-100">Resend not configured</p>
              <p className="text-red-800 dark:text-red-200 mt-1">
                RESEND_API_KEY is missing in this environment. OTP emails may use a different path — add the key in
                Vercel env vars before blasting.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 dark:border-[var(--border-subtle)]">
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium mt-1">{preview.subject}</p>
            </div>
            <div className="rounded-lg border p-4 dark:border-[var(--border-subtle)]">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Recipients
              </p>
              <p className="font-medium mt-1">
                {preview.recipientCount} actively working BT{preview.recipientCount === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">postHireStage = ACTIVE_DELIVERY, valid email</p>
            </div>
          </div>

          {preview.alreadySent && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">Already sent</p>
              <p className="text-amber-800 dark:text-amber-200 mt-1">
                {preview.completedAt
                  ? `Completed ${new Date(preview.completedAt).toLocaleString()}`
                  : 'Completed'}
                {preview.sentByName ? ` by ${preview.sentByName}` : ''}
                {preview.successCount != null ? ` — ${preview.successCount} delivered` : ''}
                {preview.failureCount ? `, ${preview.failureCount} failed` : ''}
              </p>
            </div>
          )}

          {sendResult && (
            <div className="rounded-lg border p-4 text-sm bg-muted/40">{sendResult}</div>
          )}

          {preview.recipientsSample.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Recipient preview (first {preview.recipientsSample.length})</p>
              <ul className="text-sm space-y-1 max-h-40 overflow-y-auto rounded border p-3 dark:border-[var(--border-subtle)]">
                {preview.recipientsSample.map((r) => (
                  <li key={r.id}>
                    {r.firstName} {r.lastName}{' '}
                    <span className="text-muted-foreground">({r.email})</span>
                  </li>
                ))}
                {preview.recipientCount > preview.recipientsSample.length && (
                  <li className="text-muted-foreground italic">
                    + {preview.recipientCount - preview.recipientsSample.length} more
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleTestSend}
              disabled={!preview.resendConfigured || !preview.adminEmail || testing || sending}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending test…
                </>
              ) : (
                <>Send test to me{preview.adminEmail ? ` (${preview.adminEmail})` : ''}</>
              )}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={preview.alreadySent || preview.recipientCount === 0 || sending}
              className="bg-[#E4893D] hover:bg-[#d97a32] text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send to {preview.recipientCount} BT{preview.recipientCount === 1 ? '' : 's'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border overflow-hidden bg-white dark:border-[var(--border-subtle)]"
            dangerouslySetInnerHTML={{ __html: preview.htmlPreview }}
          />
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm email blast</DialogTitle>
            <DialogDescription>
              Send this email to <strong>{preview.recipientCount}</strong> actively working BT
              {preview.recipientCount === 1 ? '' : 's'}? This is a one-time campaign and cannot be sent again
              after completion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-[#E4893D] hover:bg-[#d97a32] text-white"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                `Send to ${preview.recipientCount} BT${preview.recipientCount === 1 ? '' : 's'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
