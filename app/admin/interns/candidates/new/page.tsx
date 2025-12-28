// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Create new intern candidate form

'use client'

import { useState } from 'react'
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

const ROLE_OPTIONS = [
  { value: 'Idris — App Developer', label: 'Idris — App Developer' },
  { value: 'Adham — Backend Developer', label: 'Adham — Backend Developer' },
  { value: 'Eusop — Backend Developer', label: 'Eusop — Backend Developer' },
  { value: 'Kazi — Cybersecurity', label: 'Kazi — Cybersecurity' },
  { value: 'Taheem — Cybersecurity', label: 'Taheem — Cybersecurity' },
  { value: 'Akib — AI / Data Science', label: 'Akib — AI / Data Science' },
  { value: 'Hamza — AI / Data Science', label: 'Hamza — AI / Data Science' },
  { value: 'Jaden — FinTech', label: 'Jaden — FinTech' },
  { value: 'Mahim — FinTech', label: 'Mahim — FinTech' },
  { value: 'Ark (Abdurahman Khan) — TBD', label: 'Ark (Abdurahman Khan) — TBD' },
  { value: 'Other', label: 'Other (custom)' },
]

export default function NewInternCandidatePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [customRole, setCustomRole] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !email || !role) {
      showToast('Name, email, and role are required', 'error')
      return
    }

    setLoading(true)
    try {
      const finalRole = role === 'Other' ? customRole : role
      if (!finalRole) {
        showToast('Please specify a role', 'error')
        setLoading(false)
        return
      }

      const response = await fetch('/api/dev/intern-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          role: finalRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        showToast('Candidate created successfully', 'success')
        router.push(`/admin/interns/candidates/${data.id}`)
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to create candidate', 'error')
      }
    } catch (error) {
      console.error('Error creating candidate:', error)
      showToast('Error creating candidate', 'error')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Add New Intern Candidate</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidate Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={setRole} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role === 'Other' && (
                  <Input
                    className="mt-2"
                    placeholder="Enter custom role"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    disabled={loading}
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Candidate'
                )}
              </Button>
              <Link href="/admin/interns">
                <Button type="button" variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


