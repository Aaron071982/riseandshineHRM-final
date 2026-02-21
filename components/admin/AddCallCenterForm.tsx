'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function AddCallCenterForm() {
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
      const res = await fetch('/api/admin/employees/call-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: (formData.get('fullName') as string)?.trim(),
          email: (formData.get('email') as string)?.trim() || undefined,
          phone: (formData.get('phone') as string)?.trim() || undefined,
          title: (formData.get('title') as string)?.trim() || undefined,
          extension: (formData.get('extension') as string)?.trim() || undefined,
          notes: (formData.get('notes') as string)?.trim() || undefined,
          status: (formData.get('status') as string)?.trim() || undefined,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create call center profile')
        setLoading(false)
        return
      }
      router.push(`/admin/employees/call-center/${data.id}`)
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle>Call Center Team Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Label htmlFor="title">Title / Role</Label>
              <Input id="title" name="title" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension">Extension</Label>
              <Input id="extension" name="extension" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" placeholder="e.g. Active" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Add Call Center'}
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
