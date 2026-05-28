'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Booking = {
  id: string
  attendanceStatus: string
  bookedAt: string
  rbtProfile: {
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
    email: string | null
    createdAt: string
  }
}

type Session = {
  id: string
  title: string
  description: string | null
  meetingUrl: string
  startTime: string
  endTime: string
  maxAttendees: number
  currentAttendees: number
  status: string
  notes: string | null
}

export default function TrainingSessionDetailPage({ sessionId }: { sessionId: string }) {
  const { showToast } = useToast()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, bRes] = await Promise.all([
        fetch(`/api/training/sessions/${sessionId}`, { credentials: 'include' }),
        fetch(`/api/training/sessions/${sessionId}/attendees`, { credentials: 'include' }),
      ])
      const sJson = await sRes.json()
      const bJson = await bRes.json()
      if (sRes.ok) setSession(sJson.session)
      if (bRes.ok) setBookings(bJson.bookings ?? [])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  const pct =
    session && session.maxAttendees
      ? Math.min(100, (session.currentAttendees / session.maxAttendees) * 100)
      : 0

  const patchAttendance = async (bookingId: string, attendanceStatus: string) => {
    const res = await fetch(`/api/training/bookings/${bookingId}/attendance`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceStatus }),
    })
    if (!res.ok) {
      const e = await res.json()
      showToast(e.error || 'Update failed', 'error')
      return
    }
    showToast('Updated', 'success')
    await load()
  }

  const bulkAttended = async () => {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (!ids.length) return
    const res = await fetch(`/api/training/sessions/${sessionId}/bulk-attendance`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingIds: ids, attendanceStatus: 'ATTENDED' }),
    })
    if (!res.ok) {
      showToast('Bulk update failed', 'error')
      return
    }
    showToast('Marked attended', 'success')
    setSelected({})
    await load()
  }

  const sendReminderToBook = async () => {
    const res = await fetch(`/api/training/sessions/${sessionId}/notify`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) showToast('Failed', 'error')
    else showToast('Reminder blast sent', 'success')
  }

  const markSessionComplete = async () => {
    const res = await fetch(`/api/training/sessions/${sessionId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    if (!res.ok) showToast('Failed', 'error')
    else {
      showToast('Session marked complete', 'success')
      await load()
    }
  }

  const cancelSession = async () => {
    const res = await fetch(`/api/training/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) showToast('Cancel failed', 'error')
    else {
      showToast('Session cancelled', 'success')
      router.push('/training/sessions')
    }
  }

  if (loading || !session) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
      </div>
    )
  }

  const ended = new Date(session.endTime) < new Date()

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <Link href="/training/sessions" className="text-sm text-[#e36f1e]">
          ← Sessions
        </Link>
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="text-gray-600">
          {new Date(session.startTime).toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York',
          })}{' '}
          –{' '}
          {new Date(session.endTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York',
          })}{' '}
          ET
        </p>
        <Button asChild className="bg-[#E4893D] hover:bg-[#d35f1a]">
          <a href={session.meetingUrl} target="_blank" rel="noreferrer">
            Open meeting
          </a>
        </Button>
        <div>
          <span
            className={cn(
              'inline-block text-xs px-2 py-1 rounded-full',
              session.status === 'SCHEDULED' && 'bg-green-100 text-green-800',
              session.status === 'CANCELLED' && 'bg-red-100 text-red-800',
              session.status === 'COMPLETED' && 'bg-gray-100 text-gray-700'
            )}
          >
            {session.status}
          </span>
        </div>
        <div className="max-w-md">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>
              {session.currentAttendees} / {session.maxAttendees}
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-[#E4893D]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {session.description && <p className="text-gray-700">{session.description}</p>}
        {session.notes && (
          <p className="text-sm text-gray-500 border-l-2 border-[#e36f1e] pl-3">{session.notes}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit session
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
            Cancel session
          </Button>
          {ended && session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
            <Button size="sm" variant="secondary" onClick={() => void markSessionComplete()}>
              Mark session complete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            Booked attendees ({bookings.length} / {session.maxAttendees})
          </CardTitle>
          {bookings.some((b) => selected[b.id]) && (
            <Button size="sm" className="bg-[#e36f1e]" onClick={() => void bulkAttended()}>
              Mark selected as attended
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {bookings.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-gray-500">No one has booked yet.</p>
              <Button variant="outline" size="sm" onClick={() => void sendReminderToBook()}>
                Send email reminder
              </Button>
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="border rounded-lg p-3 flex flex-wrap gap-3 justify-between items-start"
              >
                <div className="flex gap-2 items-start">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!selected[b.id]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))
                    }
                  />
                  <div>
                    <p className="font-medium">
                      {b.rbtProfile.firstName} {b.rbtProfile.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Hired proxy: {new Date(b.rbtProfile.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm">{b.rbtProfile.phoneNumber}</p>
                    {b.rbtProfile.email && (
                      <a href={`mailto:${b.rbtProfile.email}`} className="text-sm text-[#e36f1e]">
                        {b.rbtProfile.email}
                      </a>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Booked {new Date(b.bookedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Select
                    value={b.attendanceStatus}
                    onValueChange={(v) => void patchAttendance(b.id, v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOOKED">Booked</SelectItem>
                      <SelectItem value="ATTENDED">Attended</SelectItem>
                      <SelectItem value="NO_SHOW">No-show</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void patchAttendance(b.id, 'ATTENDED')}
                  >
                    Mark attended
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SessionEditDialog
        session={session}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => load()}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Booked attendees will be emailed.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => void cancelSession()}>
              Confirm cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SessionEditDialog({
  session,
  open,
  onClose,
  onSaved,
}: {
  session: Session
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [title, setTitle] = useState(session.title)
  const [meetingUrl, setMeetingUrl] = useState(session.meetingUrl)
  const [notes, setNotes] = useState(session.notes ?? '')
  useEffect(() => {
    setTitle(session.title)
    setMeetingUrl(session.meetingUrl)
    setNotes(session.notes ?? '')
  }, [session])

  const save = async () => {
    const res = await fetch(`/api/training/sessions/${session.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, meetingUrl, notes }),
    })
    if (!res.ok) showToast('Save failed', 'error')
    else {
      showToast('Saved', 'success')
      onSaved()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Meeting URL</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
