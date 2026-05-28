'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type SessionRow = {
  id: string
  title: string
  startTime: string
  endTime: string
  currentAttendees: number
  maxAttendees: number
  status: string
}

export default function TrainingHistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/training/sessions?filter=past', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setSessions(data.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    const lines = [
      ['id', 'title', 'startTime', 'endTime', 'attendees', 'max', 'status'].join(','),
      ...sessions.map((s) =>
        [
          s.id,
          `"${s.title.replace(/"/g, '""')}"`,
          s.startTime,
          s.endTime,
          s.currentAttendees,
          s.maxAttendees,
          s.status,
        ].join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artemis-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h1 className="text-2xl font-bold">History</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sessions.length}>
          Export CSV
        </Button>
      </div>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-[#e36f1e]" />
      ) : (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-gray-500">No past sessions.</p>
          ) : (
            sessions.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex flex-wrap justify-between gap-3 items-center">
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(s.startTime).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
                    </p>
                    <p className="text-sm mt-1">
                      Attendees recorded: {s.currentAttendees} / {s.maxAttendees}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/training/sessions/${s.id}`}>View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
