// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Intern detail page (for active interns)

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Intern } from '@/lib/intern-storage'

export default function InternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [intern, setIntern] = useState<Intern | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [internId, setInternId] = useState<string>('')

  useEffect(() => {
    async function loadId() {
      const resolved = await params
      setInternId(resolved.id)
    }
    loadId()
  }, [params])

  useEffect(() => {
    if (internId) {
      fetchIntern()
    }
  }, [internId])

  const fetchIntern = async () => {
    try {
      const response = await fetch(`/api/dev/interns/${internId}`)
      if (response.ok) {
        const data = await response.json()
        setIntern(data)
      } else {
        showToast('Failed to load intern', 'error')
        router.push('/admin/interns')
      }
    } catch (error) {
      console.error('Error fetching intern:', error)
      showToast('Error loading intern', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (updates: Partial<Intern>) => {
    if (!intern) return
    setSaving(true)
    try {
      const response = await fetch(`/api/dev/interns/${internId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (response.ok) {
        const updated = await response.json()
        setIntern(updated)
        showToast('Intern updated successfully', 'success')
      } else {
        showToast('Failed to update intern', 'error')
      }
    } catch (error) {
      console.error('Error updating intern:', error)
      showToast('Error updating intern', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!intern) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Intern not found</p>
        <Link href="/admin/interns">
          <Button className="mt-4">Back to Interns</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/interns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{intern.name}</h1>
          <p className="text-gray-600">{intern.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intern Information</CardTitle>
        </CardHeader>
        <CardContent>
          <InternEditForm intern={intern} onUpdate={handleUpdate} disabled={saving} />
        </CardContent>
      </Card>
    </div>
  )
}

function InternEditForm({
  intern,
  onUpdate,
  disabled,
}: {
  intern: Intern
  onUpdate: (updates: Partial<Intern>) => void
  disabled: boolean
}) {
  const [name, setName] = useState(intern.name)
  const [email, setEmail] = useState(intern.email)
  const [phone, setPhone] = useState(intern.phone || '')
  const [role, setRole] = useState(intern.role)
  const [status, setStatus] = useState(intern.status)
  const [expectedHoursPerWeek, setExpectedHoursPerWeek] = useState(
    intern.expectedHoursPerWeek?.toString() || ''
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate({
      name,
      email,
      phone: phone || undefined,
      role,
      status,
      expectedHoursPerWeek: expectedHoursPerWeek ? Number(expectedHoursPerWeek) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select 
            value={status} 
            onValueChange={(value) => setStatus(value as 'Active' | 'Inactive')} 
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="expectedHoursPerWeek">Expected Hours Per Week</Label>
          <Input
            id="expectedHoursPerWeek"
            type="number"
            value={expectedHoursPerWeek}
            onChange={(e) => setExpectedHoursPerWeek(e.target.value)}
            placeholder="e.g., 20"
            disabled={disabled}
          />
        </div>
      </div>
      <Button type="submit" disabled={disabled}>
        {disabled ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </form>
  )
}


