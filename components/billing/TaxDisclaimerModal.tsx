'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Mail, Loader2 } from 'lucide-react'

export default function TaxDisclaimerModal({
  cycleId,
  cycleLabel,
  canSend,
}: {
  cycleId: string
  cycleLabel: string
  canSend: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<{
    recipientCount: number
    skippedCount: number
    previewHtml: string | null
    previewRecipient: string | null
  } | null>(null)
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(
    null
  )

  const loadPreview = async () => {
    setLoading(true)
    setResult(null)
    const res = await fetch(`/api/billing/cycles/${cycleId}/tax-disclaimer`)
    const data = await res.json()
    if (res.ok) setPreview(data)
    setLoading(false)
    setOpen(true)
  }

  const sendAll = async () => {
    setSending(true)
    const res = await fetch(`/api/billing/cycles/${cycleId}/tax-disclaimer`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setResult(data)
    setSending(false)
  }

  return (
    <>
      <Button variant="outline" onClick={loadPreview} disabled={!canSend}>
        <Mail className="w-4 h-4 mr-2" />
        Send Tax Disclaimer to BTs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tax disclaimer — {cycleLabel}</DialogTitle>
          </DialogHeader>

          {loading && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading preview…
            </p>
          )}

          {preview && !result && (
            <div className="space-y-4">
              <p className="text-sm">
                This will email{' '}
                <strong>
                  {preview.recipientCount} matched BT{preview.recipientCount !== 1 ? 's' : ''}
                </strong>{' '}
                a notice that federal and state taxes (and other payroll deductions) will be withheld
                from their pay this cycle.
                {preview.skippedCount > 0 && (
                  <span className="text-gray-500">
                    {' '}
                    ({preview.skippedCount} skipped — no email on file)
                  </span>
                )}
              </p>
              {preview.recipientCount === 0 && (
                <p className="text-sm text-amber-700">
                  No BTs with hours and an email on file to send.
                </p>
              )}
              {preview.previewRecipient && (
                <p className="text-xs text-gray-500">
                  Preview for: <strong>{preview.previewRecipient}</strong>
                </p>
              )}
              {preview.previewHtml && (
                <div
                  className="border rounded-lg p-4 bg-gray-50 text-sm overflow-auto max-h-64"
                  dangerouslySetInnerHTML={{ __html: preview.previewHtml }}
                />
              )}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 p-4 text-sm">
              <p className="font-medium text-teal-900 dark:text-teal-200">Send complete</p>
              <p className="mt-1">
                {result.sent} sent · {result.failed} failed · {result.skipped} skipped
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && preview && (
              <Button
                className="bg-[#0D9488] hover:bg-teal-700 text-white"
                onClick={sendAll}
                disabled={sending || preview.recipientCount === 0}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send to All
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
