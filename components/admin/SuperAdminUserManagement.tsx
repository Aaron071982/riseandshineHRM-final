'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserWithStats {
  id: string
  email: string | null
  name: string | null
  role: string
  isActive: boolean
  createdAt: string
  profile: {
    fullName: string | null
    phone: string | null
    department: string | null
    title: string | null
  } | null
  lastLogin: string | null
  lastActivity: string | null
  totalActivities: number
  activeSessions: number
}

export default function SuperAdminUserManagement() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/users', { credentials: 'include' })
      if (!response.ok) {
        setError(response.status === 403 ? 'Not authorized to view users.' : 'Failed to load users.')
        setUsers([])
        return
      }

      const data = await response.json()
      const all = data.users ?? []
      setUsers(all.filter((u: UserWithStats) => u.role === 'ADMIN'))
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleAdminCreated = () => {
      fetchUsers()
    }
    window.addEventListener('adminCreated', handleAdminCreated)
    return () => {
      window.removeEventListener('adminCreated', handleAdminCreated)
    }
  }, [])

  const handleDeleteAdmin = async (userId: string, userEmail: string | null) => {
    if (!confirm(`Are you sure you want to remove admin access for ${userEmail || userId}? This will set their role to CANDIDATE.`)) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        showToast(data.error || 'Failed to remove admin', 'error')
        return
      }

      showToast('Admin access removed successfully', 'success')
      await fetchUsers()
    } catch (error) {
      console.error('Error removing admin:', error)
      showToast('Failed to remove admin', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-2 border-gray-100 bg-white dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Admins</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-amber-50 dark:bg-[var(--status-warning-bg)] border border-amber-200 dark:border-[var(--status-warning-border)] px-4 py-2 text-sm text-amber-800 dark:text-[var(--status-warning-text)] mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">Loading...</div>
        ) : users.length === 0 && !error ? (
          <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">No admins yet. Add one with the form on the right.</div>
        ) : users.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-[var(--border-subtle)]">
                  <th className="text-left p-2 text-gray-600 dark:text-[var(--text-tertiary)]">User</th>
                  <th className="text-left p-2 text-gray-600 dark:text-[var(--text-tertiary)]">Status</th>
                  <th className="text-left p-2 text-gray-600 dark:text-[var(--text-tertiary)]">Last Login</th>
                  <th className="text-left p-2 text-gray-600 dark:text-[var(--text-tertiary)]">Admin access</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]">
                    <td className="p-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{user.email || '—'}</div>
                        {user.profile?.fullName && (
                          <div className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">{user.profile.fullName}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={user.isActive ? 'bg-green-100 text-green-800 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]' : 'bg-red-100 text-red-800'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-2 text-gray-600 dark:text-[var(--text-secondary)]">
                      {user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
                    </td>
                    <td className="p-2">
                      <Select
                        value="admin"
                        onValueChange={(value) => {
                          if (value === 'remove') {
                            handleDeleteAdmin(user.id, user.email)
                          }
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-9 border border-gray-200 dark:border-[var(--border-subtle)]">
                          <SelectValue placeholder="Access" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="remove" className="text-red-600 dark:text-red-400">Remove admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
