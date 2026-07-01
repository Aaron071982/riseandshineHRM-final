'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Mail, Loader2, Eye } from 'lucide-react'

type Recipient = {
  entryId: string
  name: string
  email: string | null
  canEmail: boolean
  totalHours: number
}

export default function HoursConfirmationModal({
  cycleId,
  cycleLabel,
  canSend,
}: {
  cycleId: string
  cycleLabel: string
  canSend: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewRecipient, setPreviewRecipient] = useState<string | null>(null)
  const [recipientCount, setRecipientCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [withIncompleteHours, setWithIncompleteHours] = useState(0)
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(
    null
  )

  const loadPreview = async (entryId?: string) => {
    setLoading(true)
    const q = entryId ? `?entryId=${encodeURIComponent(entryId)}` : ''
    const res = await fetch(`/api/billing/cycles/${cycleId}/hours-confirmation${q}`)
    const data = await res.json()
    if (res.ok) {
      setRecipients(data.recipients ?? [])
      setSelectedEntryId(data.previewEntryId ?? null)
      setPreviewHtml(data.previewHtml)
      setPreviewRecipient(data.previewRecipient)
      setRecipientCount(data.recipientCount)
      setSkippedCount(data.skippedCount)
      setWithIncompleteHours(data.withIncompleteHours)
    }
    setLoading(false)
  }

  const openModal = async () => {
    setResult(null)
    setOpen(true)
    await loadPreview()
  }

  const onSelectRecipient = async (entryId: string) => {
    setSelectedEntryId(entryId)
    await loadPreview(entryId)
  }

  const sendAll = async () => {
    setSending(true)
    const res = await fetch(`/api/billing/cycles/${cycleId}/hours-confirmation`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setResult(data)
      router.refresh()
    }
    setSending(false)
  }

  const selected = recipients.find((r) => r.entryId === selectedEntryId)

  return (
    <>
      <Button variant="outline" onClick={openModal} disabled={!canSend}>
        <Mail className="w-4 h-4 mr-2" />
        Send Hours Confirmation to BTs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hours confirmation — {cycleLabel}</DialogTitle>
          </DialogHeader>

          {loading && !previewHtml && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading preview…
            </p>
          )}

          {!result && previewHtml && (
            <div className="space-y-4">
              <p className="text-sm">
                Preview each email below, then send to all{' '}
                <strong>
                  {recipientCount} BT{recipientCount !== 1 ? 's' : ''}
                </strong>{' '}
                with hours and an email on file.
                {skippedCount > 0 && (
                  <span className="text-gray-500"> ({skippedCount} skipped — no email)</span>
                )}
              </p>
              {withIncompleteHours > 0 && (
                <p className="text-sm text-amber-800">
                  {withIncompleteHours} BT{withIncompleteHours !== 1 ? 's' : ''} have incomplete
                  hours in this batch.
                </p>
              )}

              {recipients.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Preview for</label>
                  <Select
                    value={selectedEntryId ?? undefined}
                    onValueChange={onSelectRecipient}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select BT…" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.map((r) => (
                        <SelectItem key={r.entryId} value={r.entryId}>
                          {r.name}
                          {!r.canEmail ? ' (no email)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selected && (
                <p className="text-xs text-gray-500">
                  To: <strong>{selected.email ?? '—'}</strong> ·{' '}
                  {selected.totalHours.toFixed(2)} payable hrs
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Eye className="w-3.5 h-3.5" />
                Email preview{previewRecipient ? ` for ${previewRecipient}` : ''}
              </div>
              <div
                className="border rounded-lg p-4 bg-gray-50 text-sm overflow-auto max-h-[45vh]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
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
            {!result && previewHtml && (
              <Button
                className="bg-[#0D9488] hover:bg-teal-700 text-white"
                onClick={sendAll}
                disabled={sending || recipientCount === 0}
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

export function HoursConfirmationLog({
  confirmations,
}: {
  confirmations: Array<{
    id: string
    email: string
    status: string
    sentAt: string | Date | null
    rbtProfile: { firstName: string; lastName: string } | null
    payrollOnly: { fullName: string } | null
  }>
}) {
  if (confirmations.length === 0) return null

  return (
    <div className="mt-4 border-t pt-4">
      <p className="text-xs font-medium text-gray-500 mb-2">Hours confirmations sent</p>
      <ul className="text-xs space-y-1 text-gray-600">
        {confirmations.map((c) => {
          const name = c.rbtProfile
            ? `${c.rbtProfile.firstName} ${c.rbtProfile.lastName}`
            : (c.payrollOnly?.fullName ?? c.email)
          return (
            <li key={c.id}>
              {name} — {c.status}
              {c.sentAt ? ` · ${format(new Date(c.sentAt), 'MMM d, h:mm a')}` : ''}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
