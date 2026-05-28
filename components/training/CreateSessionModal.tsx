'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

export default function CreateSessionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('Artemis Training')
  const [description, setDescription] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:30')
  const [maxAttendees, setMaxAttendees] = useState(10)
  const [meetingUrl, setMeetingUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)

  const toLocalIso = (dateStr: string, timeHm: string) => {
    const [h, m] = timeHm.split(':').map(Number)
    const d = new Date(`${dateStr}T12:00:00`)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }

  const createSessionOnly = async () => {
    setLoading(true)
    try {
      const startIso = toLocalIso(sessionDate, startTime)
      const endIso = toLocalIso(sessionDate, endTime)
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          sessionDate,
          startTime: startIso,
          endTime: endIso,
          maxAttendees,
          meetingUrl,
          notes: notes || null,
          notify: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setCreatedSessionId(data.session.id)
      setStep('confirm')
      showToast('Session created', 'success')
      onCreated()
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const notifyNow = async () => {
    if (!createdSessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/training/sessions/${createdSessionId}/notify`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Notify failed')
      showToast(`Emails queued (${data.sent ?? 0})`, 'success')
      setStep('form')
      setCreatedSessionId(null)
      onClose()
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const finishLater = () => {
    setStep('form')
    setCreatedSessionId(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create session</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Max attendees</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(parseInt(e.target.value, 10) || 10)}
                />
              </div>
              <div>
                <Label>Google Meet URL</Label>
                <Input
                  placeholder="https://meet.google.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-[#E4893D]"
                disabled={loading || !meetingUrl.trim()}
                onClick={() => void createSessionOnly()}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Notify eligible RBTs?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Session created! Would you like to notify eligible RBTs who still need Artemis training?
            </p>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={finishLater}>
                I&apos;ll send later
              </Button>
              <Button className="bg-[#E4893D]" disabled={loading} onClick={() => void notifyNow()}>
                Send email now
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
