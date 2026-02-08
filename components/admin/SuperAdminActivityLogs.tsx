'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Search, Download, Filter, Calendar } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface ActivityLog {
  id: string
  activityType: string
  action: string
  resourceType: string | null
  resourceId: string | null
  url: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: string
    email: string | null
    role: string
    name: string | null
  }
}

interface ActivityLogsResponse {
  activities: ActivityLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function SuperAdminActivityLogs() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [userId, setUserId] = useState('')
  const [activityType, setActivityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      })

      if (userId) params.append('userId', userId)
      if (activityType) params.append('activityType', activityType)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (search) params.append('search', search)

      const response = await fetch(`/api/admin/activity-logs?${params}`, { credentials: 'include' })
      if (!response.ok) {
        setError(response.status === 403 ? 'Not authorized to view activity logs.' : 'Failed to load activity logs.')
        setActivities([])
        setPagination({ page: 1, limit: 50, total: 0, totalPages: 0 })
        return
      }

      const data: ActivityLogsResponse = await response.json()
      setActivities(data.activities)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError('Failed to load activity logs.')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityType, startDate, endDate, search])

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Role', 'Activity Type', 'Action', 'Resource', 'URL', 'IP Address'].join(','),
      ...activities.map((a) =>
        [
          formatDateTime(a.createdAt),
          a.user.email || '—',
          a.user.role,
          a.activityType,
          `"${a.action}"`,
          a.resourceType && a.resourceId ? `${a.resourceType}:${a.resourceId}` : '—',
          a.url || '—',
          a.ipAddress || '—',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'LOGIN':
        return 'bg-green-100 text-green-800'
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800'
      case 'PAGE_VIEW':
        return 'bg-blue-100 text-blue-800'
      case 'LINK_CLICK':
        return 'bg-purple-100 text-purple-800'
      case 'BUTTON_CLICK':
        return 'bg-orange-100 text-orange-800'
      case 'FORM_SUBMISSION':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="border-2 border-gray-100 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">Activity Logs</CardTitle>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-amber-50 dark:bg-[var(--status-warning-bg)] border border-amber-200 dark:border-[var(--status-warning-border)] px-4 py-2 text-sm text-amber-800 dark:text-[var(--status-warning-text)]">
            {error}
          </div>
        )}
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="lg:col-span-2"
          />
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="PAGE_VIEW">Page View</option>
            <option value="LINK_CLICK">Link Click</option>
            <option value="BUTTON_CLICK">Button Click</option>
            <option value="FORM_SUBMISSION">Form Submission</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
          </select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start Date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End Date"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No activities found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Timestamp</th>
                    <th className="text-left p-2">User</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Action</th>
                    <th className="text-left p-2">Resource</th>
                    <th className="text-left p-2">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{formatDateTime(activity.createdAt)}</td>
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{activity.user.email || '—'}</div>
                          <div className="text-xs text-gray-500">{activity.user.role}</div>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge className={getActivityTypeColor(activity.activityType)}>
                          {activity.activityType}
                        </Badge>
                      </td>
                      <td className="p-2">{activity.action}</td>
                      <td className="p-2">
                        {activity.resourceType && activity.resourceId
                          ? `${activity.resourceType}:${activity.resourceId.slice(0, 8)}...`
                          : '—'}
                      </td>
                      <td className="p-2">{activity.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} activities
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchActivities(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchActivities(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
