'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Eye, Edit, User } from 'lucide-react'

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
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
      setUsers(data.users ?? [])
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'RBT':
        return 'bg-blue-100 text-blue-800'
      case 'CANDIDATE':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="border-2 border-gray-100 bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900">User Management</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-amber-50 dark:bg-[var(--status-warning-bg)] border border-amber-200 dark:border-[var(--status-warning-border)] px-4 py-2 text-sm text-amber-800 dark:text-[var(--status-warning-text)] mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : users.length === 0 && !error ? (
          <div className="text-center py-8 text-gray-500">No users found</div>
        ) : users.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Last Login</th>
                  <th className="text-left p-2">Last Activity</th>
                  <th className="text-left p-2">Activities</th>
                  <th className="text-left p-2">Sessions</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{user.email || '—'}</div>
                        {user.profile?.fullName && (
                          <div className="text-xs text-gray-500">{user.profile.fullName}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
                    </td>
                    <td className="p-2">
                      {user.lastActivity ? formatDateTime(user.lastActivity) : 'Never'}
                    </td>
                    <td className="p-2">{user.totalActivities}</td>
                    <td className="p-2">{user.activeSessions}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUserId(user.id)}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
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
