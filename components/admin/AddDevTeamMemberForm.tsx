'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface AddDevTeamMemberFormProps {
  teamId: string
}

export default function AddDevTeamMemberForm({ teamId }: AddDevTeamMemberFormProps) {
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
      const res = await fetch(`/api/admin/employees/dev-teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: (formData.get('fullName') as string)?.trim(),
          email: (formData.get('email') as string)?.trim() || undefined,
          phone: (formData.get('phone') as string)?.trim() || undefined,
          role: (formData.get('role') as string)?.trim() || undefined,
          notes: (formData.get('notes') as string)?.trim() || undefined,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add member')
        setLoading(false)
        return
      }
      router.refresh()
      form.reset()
    } catch {
      setError('An error occurred.')
    }
    setLoading(false)
  }

  return (
    <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle>Add team member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input id="fullName" name="fullName" required className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role / Title</Label>
              <Input id="role" name="role" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Adding...' : 'Add member'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
