'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export default function RequestSessionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { showToast } = useToast()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rbt/training/request-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Could not submit request', 'error')
        return
      }
      showToast(data.message || 'Request submitted', 'success')
      onSubmitted()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm"
        placeholder="Optional message (e.g. preferred times)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={1000}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading}
        onClick={() => void submit()}
      >
        {loading ? 'Submitting…' : 'Request a Session'}
      </Button>
    </div>
  )
}
