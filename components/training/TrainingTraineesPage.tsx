'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ArtemisStatusBadge from '@/components/training/ArtemisStatusBadge'
import { getArtemisStatus } from '@/lib/training/artemisStatus'
import { TRAINING_ACCENT } from '@/lib/training/constants'
import { cn } from '@/lib/utils'

type Trainee = {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email: string | null
  artemisTrainingCompleted: boolean
  artemisTrainingCompletedAt: string | null
  updatedAt: string
  activeBooking: {
    sessionId: string
    sessionStart: string
    sessionEnd: string
    sessionTitle: string
  } | null
  lastEmailSentAt: string | null
  lastEmailType: string | null
}

type SessionOpt = { id: string; title: string; startTime: string; seatsLeft: number; maxAttendees: number }

export default function TrainingTraineesPage() {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Trainee[]>([])
  const [loading, setLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState<Trainee | null>(null)
  const [sessions, setSessions] = useState<SessionOpt[]>([])
  const [canOverride, setCanOverride] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter, q })
      const res = await fetch(`/api/training/trainees?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setRows(data.trainees ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter, q])

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [load])

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/training/sessions?filter=upcoming', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) return
    const list = (data.sessions ?? []).map(
      (s: { id: string; title: string; startTime: string; maxAttendees: number; currentAttendees: number }) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        seatsLeft: Math.max(0, s.maxAttendees - s.currentAttendees),
        maxAttendees: s.maxAttendees,
      })
    )
    setSessions(list.filter((s: SessionOpt) => s.seatsLeft > 0))
  }, [])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCanOverride(!!d.canOverrideArtemisTraining))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const bookId = searchParams.get('book')
    if (!bookId || rows.length === 0) return
    const trainee = rows.find((r) => r.id === bookId)
    if (trainee) setBookOpen(trainee)
  }, [searchParams, rows])

  const emailOne = async (id: string) => {
    const res = await fetch(`/api/training/trainees/${id}/email`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      showToast('Email sent', 'success')
      load()
    } else showToast('Failed', 'error')
  }

  useEffect(() => {
    if (bookOpen) loadSessions()
  }, [bookOpen, loadSessions])

  const markTrained = async (rbtId: string) => {
    setMarkingId(rbtId)
    try {
      const res = await fetch(`/api/training/trainees/${rbtId}/mark-trained`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed', 'error')
        return
      }
      showToast('Marked as trained', 'success')
      load()
    } finally {
      setMarkingId(null)
    }
  }

  const bookManual = async (rbtId: string, trainingSessionId: string) => {
    const res = await fetch(`/api/training/trainees/${rbtId}/book`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingSessionId }),
    })
    if (res.ok) {
      showToast('Booked', 'success')
      setBookOpen(null)
      load()
    } else {
      const e = await res.json()
      showToast(e.error || 'Failed', 'error')
    }
  }

  const dayMs = 86400000

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trainees</h1>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name…"
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="trained">Trained</SelectItem>
            <SelectItem value="not_trained">Not trained</SelectItem>
            <SelectItem value="booked">Booked, not attended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: TRAINING_ACCENT }} />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Hire proxy</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Booked session</th>
                  <th className="p-3">Last email</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / dayMs)
                  const redWait = days > 30 && !r.artemisTrainingCompleted
                  const artemisStatus = getArtemisStatus(
                    { status: 'HIRED', artemisTrainingCompleted: r.artemisTrainingCompleted },
                    r.activeBooking
                      ? {
                          attendanceStatus: 'BOOKED',
                          sessionEndTime: new Date(r.activeBooking.sessionEnd),
                        }
                      : null
                  )
                  const badge =
                    artemisStatus === 'TRAINED' ? (
                      <div className="space-y-1">
                        <ArtemisStatusBadge status="TRAINED" />
                        {r.artemisTrainingCompletedAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(r.artemisTrainingCompletedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : artemisStatus === 'BOOKED' ? (
                      <div className="space-y-1">
                        <ArtemisStatusBadge status="BOOKED" />
                        {r.activeBooking && (
                          <p className="text-xs text-gray-500">
                            {new Date(r.activeBooking.sessionStart).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <ArtemisStatusBadge status="NOT_STARTED" />
                    )
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">
                        <Link href={`/admin/rbts/${r.id}`} className="font-medium hover:underline" style={{ color: TRAINING_ACCENT }}>
                          {r.firstName} {r.lastName}
                        </Link>
                      </td>
                      <td className="p-3">{new Date(r.updatedAt).toLocaleDateString()}</td>
                      <td className={cn(redWait && 'text-red-600 font-semibold')}>{days}</td>
                      <td className="p-3">{badge}</td>
                      <td className="p-3 text-xs">
                        {r.activeBooking ? (
                          <>
                            {r.activeBooking.sessionTitle}
                            <br />
                            {new Date(r.activeBooking.sessionStart).toLocaleString()}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        {r.lastEmailSentAt
                          ? `${new Date(r.lastEmailSentAt).toLocaleDateString()} (${r.lastEmailType})`
                          : '—'}
                      </td>
                      <td className="p-3 space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => void emailOne(r.id)}>
                          Email
                        </Button>
                        {!r.artemisTrainingCompleted && (
                          <Button
                            size="sm"
                            className="text-white hover:opacity-90"
                            style={{ backgroundColor: TRAINING_ACCENT }}
                            onClick={() => setBookOpen(r)}
                          >
                            Book manually
                          </Button>
                        )}
                        {canOverride && !r.artemisTrainingCompleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingId === r.id}
                            onClick={() => void markTrained(r.id)}
                          >
                            {markingId === r.id ? 'Saving…' : 'Mark trained (override)'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!bookOpen} onOpenChange={(o) => !o && setBookOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book {bookOpen?.firstName} manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming sessions with seats.</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="flex justify-between items-center border rounded-md p-2">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(s.startTime).toLocaleString()} · {s.seatsLeft} seats left
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => bookOpen && void bookManual(bookOpen.id, s.id)}
                  >
                    Select
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBookOpen(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
