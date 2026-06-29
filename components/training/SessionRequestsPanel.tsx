'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { TRAINING_ACCENT } from '@/lib/training/constants'

type SessionRequest = {
  id: string
  message: string | null
  createdAt: string
  rbtProfileId: string
  rbtName: string
  phoneNumber: string
  email: string | null
}

export default function SessionRequestsPanel({ onChange }: { onChange?: () => void }) {
  const { showToast } = useToast()
  const [requests, setRequests] = useState<SessionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/training/session-requests', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolve = async (id: string) => {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/training/session-requests/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      })
      if (!res.ok) {
        showToast('Could not resolve request', 'error')
        return
      }
      showToast('Marked resolved', 'success')
      await load()
      onChange?.()
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: TRAINING_ACCENT }} />
        </CardContent>
      </Card>
    )
  }

  if (requests.length === 0) return null

  return (
    <Card className="border-violet-200 dark:border-violet-900/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2">
          Session Requests
          <Badge style={{ backgroundColor: TRAINING_ACCENT }} className="text-white hover:opacity-90">
            {requests.length} help request{requests.length === 1 ? '' : 's'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 text-sm space-y-2">
            <div className="font-semibold text-base">{r.rbtName}</div>
            {r.message && <p className="text-gray-600 whitespace-pre-wrap">{r.message}</p>}
            <p className="text-xs text-gray-500">
              Requested{' '}
              {new Date(r.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={`tel:${r.phoneNumber}`} className="underline" style={{ color: TRAINING_ACCENT }}>
                {r.phoneNumber}
              </a>
              {r.email && (
                <a href={`mailto:${r.email}`} className="underline" style={{ color: TRAINING_ACCENT }}>
                  {r.email}
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" style={{ backgroundColor: TRAINING_ACCENT }} className="hover:opacity-90">
                <Link href={`/training/trainees?book=${r.rbtProfileId}`}>Book into a session</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={resolvingId === r.id}
                onClick={() => void resolve(r.id)}
              >
                {resolvingId === r.id ? 'Resolving…' : 'Mark Resolved'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
