'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function AddBCBAForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const certificationExpiresAt = formData.get('certificationExpiresAt') as string
    try {
      const res = await fetch('/api/admin/employees/bcba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: (formData.get('fullName') as string)?.trim(),
          email: (formData.get('email') as string)?.trim() || undefined,
          phone: (formData.get('phone') as string)?.trim() || undefined,
          certificationNumber: (formData.get('certificationNumber') as string)?.trim() || undefined,
          certificationExpiresAt: certificationExpiresAt || undefined,
          isSupervisor: formData.get('isSupervisor') === 'true',
          preferredRegions: (formData.get('preferredRegions') as string)?.trim() || undefined,
          notes: (formData.get('notes') as string)?.trim() || undefined,
          status: (formData.get('status') as string)?.trim() || undefined,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create BCBA')
        setLoading(false)
        return
      }
      router.push(`/admin/employees/bcba/${data.id}`)
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle>BCBA Information</CardTitle>
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
              <Label htmlFor="certificationNumber">Certification Number</Label>
              <Input id="certificationNumber" name="certificationNumber" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="certificationExpiresAt">Certification Expiry Date</Label>
              <Input id="certificationExpiresAt" name="certificationExpiresAt" type="date" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" placeholder="e.g. Active" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="isSupervisor">Supervisor</Label>
            <select
              id="isSupervisor"
              name="isSupervisor"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredRegions">Preferred Regions</Label>
            <Input id="preferredRegions" name="preferredRegions" placeholder="e.g. NY, NJ" className="dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]" />
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
              {loading ? 'Creating...' : 'Add BCBA'}
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
