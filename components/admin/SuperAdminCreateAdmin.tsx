'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { UserPlus, Save, XCircle } from 'lucide-react'

export default function SuperAdminCreateAdmin() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        showToast(data.error || 'Failed to create admin', 'error')
        return
      }

      const data = await response.json()
      showToast(`Admin ${data.user.email} created successfully`, 'success')

      // Dispatch event to refresh user list
      window.dispatchEvent(new CustomEvent('adminCreated'))

      // Reset form
      setFormData({
        email: '',
        fullName: '',
      })
    } catch (error) {
      console.error('Error creating admin:', error)
      showToast('Failed to create admin', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-2 border-gray-100 bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Create New Admin
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                required
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                required
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="gradient-primary text-white border-0">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Creating...' : 'Create Admin'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  email: '',
                  fullName: '',
                })
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
