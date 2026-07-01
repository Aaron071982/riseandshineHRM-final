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
import { Mail, Loader2, Eye } from 'lucide-react'

type PreviewData = {
  name: string
  email: string | null
  canEmail: boolean
  subject: string
  previewHtml: string
  totalHours: number
  incompleteHours: number
}

export default function EntryHoursConfirmationButton({
  entryId,
  recipientName,
  disabled,
}: {
  entryId: string
  recipientName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const loadPreview = async () => {
    setLoading(true)
    setError(null)
    setSent(false)
    try {
      const res = await fetch(`/api/billing/entries/${entryId}/hours-confirmation`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not load preview')
        setOpen(true)
        return
      }
      setPreview(data)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const sendOne = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/billing/entries/${entryId}/hours-confirmation`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Send failed')
        return
      }
      setSent(true)
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={loadPreview}
        disabled={disabled || loading}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Eye className="w-3.5 h-3.5 mr-1.5" />
        )}
        Preview &amp; send hours email
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setPreview(null)
            setError(null)
            setSent(false)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hours confirmation — {recipientName}</DialogTitle>
          </DialogHeader>

          {error && !preview && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {preview && !sent && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-500">To:</span>{' '}
                  {preview.email ? (
                    <strong>{preview.email}</strong>
                  ) : (
                    <span className="text-amber-700">No email on file</span>
                  )}
                </p>
                <p>
                  <span className="text-gray-500">Subject:</span> {preview.subject}
                </p>
                <p>
                  <span className="text-gray-500">Payable hours:</span>{' '}
                  <strong>{preview.totalHours.toFixed(2)}</strong>
                  {preview.incompleteHours > 0 && (
                    <span className="text-amber-700">
                      {' '}
                      · {preview.incompleteHours.toFixed(2)} incomplete
                    </span>
                  )}
                </p>
              </div>

              <div
                className="border rounded-lg p-4 bg-gray-50 text-sm overflow-auto max-h-[50vh]"
                dangerouslySetInnerHTML={{ __html: preview.previewHtml }}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {sent && (
            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 p-4 text-sm">
              <p className="font-medium text-teal-900 dark:text-teal-200">Email sent</p>
              <p className="mt-1">
                Hours confirmation sent to {preview?.email ?? recipientName}.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {sent ? 'Close' : 'Cancel'}
            </Button>
            {!sent && preview && (
              <Button
                className="bg-[#0D9488] hover:bg-teal-700 text-white"
                onClick={sendOne}
                disabled={sending || !preview.canEmail}
                title={!preview.canEmail ? 'No email or no payable hours' : undefined}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send email
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
