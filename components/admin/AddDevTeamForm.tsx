'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function AddDevTeamForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const res = await fetch('/api/admin/employees/dev-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (formData.get('name') as string)?.trim(),
          description: (formData.get('description') as string)?.trim() || undefined,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create dev team')
        setLoading(false)
        return
      }
      router.push(`/admin/employees/teams/${data.id}`)
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle>New Dev Team</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="name">Team Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Frontend, Backend" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional description of the team"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Team'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/employees')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
