'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

type ProximityRbt = {
  rbtProfileId: string
  firstName: string
  lastName: string
  drivingDistanceMiles: number | null
  drivingDurationMinutes: number | null
  transportation: boolean | null
  availabilityDayOfWeeks: number[]
  activeClientCount: number
}

export default function AssignRbtModal({
  clientId,
  open,
  onClose,
  onAssigned,
}: {
  clientId: string
  open: boolean
  onClose: () => void
  onAssigned: () => void
}) {
  const { showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [rbts, setRbts] = useState<ProximityRbt[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [selected, setSelected] = useState<ProximityRbt | null>(null)

  const [isPrimary, setIsPrimary] = useState(true)
  const [days, setDays] = useState<Record<string, boolean>>({})
  const [timeStart, setTimeStart] = useState('14:00')
  const [timeEnd, setTimeEnd] = useState('17:00')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const loadProximity = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/proximity?limit=5`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load proximity')
      const enriched = (data.rbts ?? []).map(
        (r: ProximityRbt & { activeClientCount?: number }) => ({
          ...r,
          activeClientCount: r.activeClientCount ?? 0,
        })
      )
      setRbts(enriched)
    } catch (e) {
      showToastRef.current(`Proximity failed: ${String(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setSelected(null)
    loadProximity()
  }, [open, loadProximity])

  useEffect(() => {
    if (!open || searchQ.trim().length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/clients/${clientId}/rbt-search?q=${encodeURIComponent(searchQ)}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (res.ok) setSearchResults(data.rbts ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, clientId, open])

  const pickSearchRbt = (r: { id: string; firstName: string; lastName: string }) => {
    setSelected({
      rbtProfileId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      drivingDistanceMiles: null,
      drivingDurationMinutes: null,
      transportation: null,
      availabilityDayOfWeeks: [],
      activeClientCount: 0,
    })
    setStep(2)
  }

  const confirm = async () => {
    if (!selected) return
    const daysOfWeek = DAYS.filter((d) => days[d])
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/rbt-assignments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rbtProfileId: selected.rbtProfileId,
          isPrimary,
          daysOfWeek,
          timeStart,
          timeEnd,
          startDate,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Assignment failed')

      if (data.suggestPromoteToActive) {
        const ok = window.confirm('Move client to Active now that they have an RBT?')
        if (ok) {
          await fetch(`/api/admin/clients/${clientId}/status`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toStatus: 'ACTIVE', reason: 'First RBT assigned' }),
          })
        }
      }

      showToast('RBT assigned', 'success')
      onAssigned()
      onClose()
    } catch (e) {
      showToast(`Error: ${String(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Find nearest RBTs' : 'Configure assignment'}</DialogTitle>
          <DialogDescription className="sr-only">
            {step === 1
              ? 'RBTs ranked by driving distance from the client location.'
              : 'Set days, times, and save the RBT assignment.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {loading && !rbts.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin w-8 h-8 text-orange-500" />
              </div>
            ) : (
              rbts.map((r) => (
                <div
                  key={r.rbtProfileId}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <Link
                      href={`/admin/rbts/${r.rbtProfileId}`}
                      className="font-semibold text-orange-700 hover:underline"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {r.drivingDistanceMiles != null ? `${r.drivingDistanceMiles} mi` : '—'} ·{' '}
                      {r.drivingDurationMinutes != null ? `${r.drivingDurationMinutes} min` : '—'} ·{' '}
                      Active clients: {r.activeClientCount}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => { setSelected(r); setStep(2); }}>
                    Select
                  </Button>
                </div>
              ))
            )}
            <div>
              <Label>Don&apos;t see who you&apos;re looking for?</Label>
              <Input
                placeholder="Search hired RBT by name…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              {searchResults.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b">
                  <span>
                    {r.firstName} {r.lastName}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => pickSearchRbt(r)}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selected && (
          <div className="space-y-3">
            <p className="text-sm">
              Selected:{' '}
              <strong>
                {selected.firstName} {selected.lastName}
              </strong>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Primary RBT
            </label>
            <div>
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={!!days[d]}
                      onChange={(e) => setDays((prev) => ({ ...prev, [d]: e.target.checked }))}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start time</Label>
                <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
              </div>
              <div>
                <Label>End time</Label>
                <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border px-2 py-1 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 2 && (
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={loading || !selected}
              onClick={confirm}
            >
              {loading ? 'Saving…' : 'Confirm assignment'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
