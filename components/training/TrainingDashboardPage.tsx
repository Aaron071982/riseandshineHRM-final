'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import CreateSessionModal from '@/components/training/CreateSessionModal'

type Summary = {
  stats: {
    upcomingSessions: number
    rbtsTrained: number
    awaitingTraining: number
    thisMonthSessions: number
  }
  upcomingSessions: Array<{
    id: string
    title: string
    startTime: string
    endTime: string
    meetingUrl: string
    maxAttendees: number
    currentAttendees: number
  }>
  awaitingProfiles: Array<{
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
    email: string | null
    updatedAt: string
  }>
  activity: Array<{ type: string; at: string; label: string }>
}

export default function TrainingDashboardPage() {
  const [data, setData] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await fetch('/api/training/summary', { credentials: 'include' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed')
      setData(j)
    } catch (e) {
      setErr(String(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sendReminder = async (rbtId: string) => {
    await fetch(`/api/training/trainees/${rbtId}/email`, { method: 'POST', credentials: 'include' })
    await load()
  }

  const sendToAll = async () => {
    if (!data?.awaitingProfiles.length) return
    for (const p of data.awaitingProfiles) {
      await fetch(`/api/training/trainees/${p.id}/email`, { method: 'POST', credentials: 'include' })
    }
    await load()
  }

  if (err) {
    return <p className="text-red-600">{err}</p>
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e] dark:text-[var(--orange-primary)]" />
      </div>
    )
  }

  const dayMs = 86400000

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-8 shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Training Dashboard</h1>
        <p className="mt-2 text-orange-50 max-w-2xl">
          Manage Artemis training sessions and track RBT progress.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Upcoming Sessions', data.stats.upcomingSessions],
          ['RBTs Trained', data.stats.rbtsTrained],
          ['Awaiting Training', data.stats.awaitingTraining],
          ["This Month's Sessions", data.stats.thisMonthSessions],
        ].map(([label, val]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#e36f1e] dark:text-[var(--orange-primary)]">
                {val as number}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Sessions</CardTitle>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setCreateOpen(true)}
            >
              + Create New Session
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming sessions.</p>
            ) : (
              data.upcomingSessions.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 flex flex-wrap gap-2 justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {new Date(s.startTime).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}{' '}
                      ET
                    </p>
                    <p className="text-sm text-gray-600">
                      {s.currentAttendees} / {s.maxAttendees} seats
                    </p>
                    <a
                      href={s.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[#e36f1e] dark:text-[var(--orange-primary)] underline"
                    >
                      Meeting link
                    </a>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/training/sessions/${s.id}`}>Manage</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>Awaiting Training</CardTitle>
            {data.awaitingProfiles.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={sendToAll}>
                Send to All
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 max-h-[380px] overflow-y-auto">
            {data.awaitingProfiles.length === 0 ? (
              <p className="text-gray-500 text-sm">Everyone hired has completed training.</p>
            ) : (
              data.awaitingProfiles.map((p) => {
                const waitDays = Math.floor(
                  (Date.now() - new Date(p.updatedAt).getTime()) / dayMs
                )
                return (
                  <div key={p.id} className="border rounded-lg p-3 text-sm">
                    <div className="font-medium">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-gray-600">Waiting {waitDays} days</div>
                    <div className="text-gray-600">{p.phoneNumber}</div>
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="text-[#e36f1e] dark:text-[var(--orange-primary)]"
                      >
                        {p.email}
                      </a>
                    )}
                    <Button size="sm" variant="ghost" className="mt-2 h-8" onClick={() => sendReminder(p.id)}>
                      Send reminder email
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent training activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent bookings yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.activity.map((a, i) => (
                <li key={i} className="flex justify-between gap-4 border-b pb-2">
                  <span>{a.label}</span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {new Date(a.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CreateSessionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load()} />
    </div>
  )
}
