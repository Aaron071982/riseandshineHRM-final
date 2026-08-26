'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const REASON_PRESETS = ['Back in school', 'On break', 'Personal', 'Other'] as const

type Props = {
  rbtProfileId: string
  activityState: 'ACTIVE' | 'INACTIVE' | string
  inactiveReason?: string | null
  inactiveUntil?: string | Date | null
  onUpdated?: () => void
}

export function RbtActivityControls({
  rbtProfileId,
  activityState,
  inactiveReason,
  inactiveUntil,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'INACTIVE' | 'ACTIVE'>('INACTIVE')
  const [reason, setReason] = useState<string>(REASON_PRESETS[0])
  const [otherText, setOtherText] = useState('')
  const [until, setUntil] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isInactive = activityState === 'INACTIVE'

  function openSetInactive() {
    setMode('INACTIVE')
    setReason(REASON_PRESETS[0])
    setOtherText('')
    setUntil('')
    setError(null)
    setOpen(true)
  }

  function openReactivate() {
    setMode('ACTIVE')
    setError(null)
    setOpen(true)
  }

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { activityState: mode }
      if (mode === 'INACTIVE') {
        body.inactiveReason =
          reason === 'Other' ? otherText.trim() || 'Other' : reason
        if (until) body.inactiveUntil = new Date(until).toISOString()
      }
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to update')
        return
      }
      setOpen(false)
      onUpdated?.()
      window.location.reload()
    } catch {
      setError('Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {isInactive ? (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" onClick={openReactivate}>
            Reactivate
          </Button>
          {(inactiveReason || inactiveUntil) && (
            <p className="text-xs text-muted-foreground">
              {inactiveReason}
              {inactiveUntil
                ? ` · until ${new Date(inactiveUntil).toLocaleDateString()}`
                : ''}
            </p>
          )}
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={openSetInactive}>
          Set inactive
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'INACTIVE' ? 'Set inactive' : 'Reactivate'}
            </DialogTitle>
          </DialogHeader>
          {mode === 'INACTIVE' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Employment status stays Hired. They will be excluded from staffing
                pools. No email is sent.
              </p>
              <div>
                <Label>Reason</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASON_PRESETS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {reason === 'Other' && (
                <div>
                  <Label>Details</Label>
                  <Input
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Reason"
                  />
                </div>
              )}
              <div>
                <Label>Inactive until (optional)</Label>
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Return this person to the Active staffing pool? No email is sent.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={loading}>
              {loading ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function InactiveBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
      Inactive
    </span>
  )
}
