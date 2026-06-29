'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, GraduationCap } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import RequestSessionForm from '@/components/rbt/RequestSessionForm'

type SessionCard = {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  meetingUrl: string
  maxAttendees: number
  currentAttendees: number
  seatsLeft: number
  hostName: string | null
}

export default function RbtTrainingPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionCard[]>([])
  const [profile, setProfile] = useState<{
    artemisTrainingCompleted: boolean
    artemisTrainingCompletedAt: string | null
    artemisTrainingSession: { host: { name: string | null } | null } | null
  } | null>(null)
  const [booking, setBooking] = useState<{
    id: string
    bookedAt: string
    session: {
      id: string
      title: string
      startTime: string
      endTime: string
      meetingUrl: string
      host: { name: string | null; email: string | null }
    }
  } | null>(null)
  const [confirmSession, setConfirmSession] = useState<SessionCard | null>(null)
  const [openSessionRequest, setOpenSessionRequest] = useState<{ id: string; createdAt: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        fetch('/api/rbt/training/available-sessions', { credentials: 'include' }),
        fetch('/api/rbt/training/my-booking', { credentials: 'include' }),
      ])
      const sJson = await sRes.json()
      const mJson = await mRes.json()
      if (sRes.ok) setSessions(sJson.sessions ?? [])
      if (mRes.ok) {
        setProfile(mJson.profile ?? null)
        setBooking(mJson.booking ?? null)
        setOpenSessionRequest(mJson.openSessionRequest ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => {
      refresh()
    }, 30000)
    return () => clearInterval(id)
  }, [refresh])

  const book = async () => {
    if (!confirmSession) return
    const res = await fetch('/api/rbt/training/book', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainingSessionId: confirmSession.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || 'Could not book', 'error')
      return
    }
    showToast("You're booked!", 'success')
    setConfirmSession(null)
    await refresh()
  }

  const cancelBooking = async () => {
    const res = await fetch('/api/rbt/training/cancel', {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || 'Cannot cancel', 'error')
      return
    }
    showToast('Booking cancelled', 'success')
    await refresh()
  }

  if (loading && !profile) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
      </div>
    )
  }

  if (profile?.artemisTrainingCompleted) {
    const trainedDate = profile.artemisTrainingCompletedAt
      ? new Date(profile.artemisTrainingCompletedAt).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
        })
      : ''
    const trainerName = profile.artemisTrainingSession?.host?.name
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 space-y-2">
            <p className="text-lg font-semibold text-green-900">
              You completed Artemis Training{trainedDate ? ` on ${trainedDate}` : ''}.
            </p>
            {trainerName && <p className="text-green-800">Trained by: {trainerName}</p>}
            <p className="text-green-800">You&apos;re ready to be assigned to clients.</p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/rbt/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (booking) {
    const start = new Date(booking.session.startTime)
    const end = new Date(booking.session.endTime)
    const msLeft = start.getTime() - Date.now()
    const canJoin = msLeft <= 15 * 60 * 1000 && msLeft > -60 * 60 * 1000
    const cancelCutoff = start.getTime() - 2 * 60 * 60 * 1000
    const canCancel = Date.now() < cancelCutoff

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="rounded-xl bg-gradient-to-r from-[#E4893D] to-[#FF9F5A] text-white p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-8 h-8" />
            <h1 className="text-xl font-bold">You&apos;re booked for Artemis Training</h1>
          </div>
          <p className="opacity-95">
            {start.toLocaleString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/New_York',
            })}{' '}
            ET
          </p>
          <p className="text-sm mt-2 opacity-90">
            Duration:{' '}
            {Math.round((end.getTime() - start.getTime()) / 60000)} minutes
          </p>
        </div>
        {canJoin ? (
          <Button asChild className="w-full bg-[#E4893D] hover:bg-[#d35f1a]">
            <a href={booking.session.meetingUrl} target="_blank" rel="noreferrer">
              Join meeting
            </a>
          </Button>
        ) : (
          <Button type="button" disabled className="w-full opacity-60 cursor-not-allowed">
            Join meeting
          </Button>
        )}
        {!canJoin && (
          <p className="text-xs text-center text-gray-500">
            Join opens 15 minutes before start time.
          </p>
        )}
        {canCancel ? (
          <button
            type="button"
            className="text-sm text-gray-600 underline w-full text-center"
            onClick={() => void cancelBooking()}
          >
            Cancel booking
          </button>
        ) : (
          <p className="text-xs text-center text-gray-500">
            Cancellation closes 2 hours before the session.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="rounded-xl bg-gradient-to-r from-[#E4893D] to-[#FF9F5A] text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Book Your Artemis Training</h1>
        <p className="mt-2 opacity-95">
          Choose a session that works for your schedule. Seats are first-come, first-served.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-600">
            No training sessions available right now. We&apos;ll email you when new sessions are posted.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const pct = s.maxAttendees ? s.seatsLeft / s.maxAttendees : 0
            const seatColor = pct > 0.3 ? 'text-green-700' : 'text-amber-700'
            const start = new Date(s.startTime)
            const end = new Date(s.endTime)
            return (
              <Card key={s.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold">
                      {start.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/New_York',
                      })}
                    </p>
                    <p className="text-gray-700 font-medium">
                      {start.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}{' '}
                      –{' '}
                      {end.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}{' '}
                      ET
                    </p>
                    <p className={cn('text-sm font-semibold mt-2', seatColor)}>
                      {s.seatsLeft} of {s.maxAttendees} spots left
                    </p>
                    <p className="text-xs text-gray-500">
                      ~{Math.round((end.getTime() - start.getTime()) / 60000)} min
                    </p>
                  </div>
                  <Button className="bg-[#E4893D] hover:bg-[#d35f1a] shrink-0" onClick={() => setConfirmSession(s)}>
                    Book this session
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!confirmSession} onOpenChange={(o) => !o && setConfirmSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Artemis Training?</DialogTitle>
          </DialogHeader>
          {confirmSession && (
            <p className="text-sm text-gray-600">
              {new Date(confirmSession.startTime).toLocaleString('en-US', {
                timeZone: 'America/New_York',
              })}{' '}
              ET · ~
              {Math.round(
                (new Date(confirmSession.endTime).getTime() -
                  new Date(confirmSession.startTime).getTime()) /
                  60000
              )}{' '}
              minutes. You can cancel up to 2 hours before start.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmSession(null)}>
              Back
            </Button>
            <Button className="bg-[#E4893D]" onClick={() => void book()}>
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-dashed">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Need help getting trained?</h2>
          {openSessionRequest ? (
            <p className="text-sm text-gray-600">
              Request submitted — training team will reach out.
              {openSessionRequest.createdAt && (
                <span className="block text-xs text-gray-500 mt-1">
                  Submitted{' '}
                  {new Date(openSessionRequest.createdAt).toLocaleDateString('en-US', {
                    timeZone: 'America/New_York',
                  })}
                </span>
              )}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Can&apos;t find a time that works? Ask the training team to help you book.
              </p>
              <RequestSessionForm onSubmitted={() => void refresh()} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
