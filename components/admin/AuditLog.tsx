'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import { Phone, Plus, Trash2, Edit, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'

interface AuditLog {
  id: string
  auditType: string
  dateTime: Date
  notes: string | null
  createdBy: string | null
  createdAt: Date
}

interface AuditLogProps {
  rbtProfileId: string
  rbtName: string
}

export default function AuditLog({ rbtProfileId, rbtName }: AuditLogProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<AuditLog | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    auditType: 'PHONE_CALL',
    dateTime: new Date().toISOString().slice(0, 16),
    notes: '',
  })

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true)
      setFetchError(null)
      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/audit-logs`, { credentials: 'include' })
      if (response.ok) {
        const logs = await response.json()
        setAuditLogs(logs)
      } else {
        const msg = response.status === 403 ? 'You don’t have permission to view audit logs.' : 'Failed to load audit logs.'
        setFetchError(msg)
        showToastRef.current('Failed to load audit logs', 'error')
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      setFetchError('Failed to load audit logs.')
      showToastRef.current('Error loading audit logs', 'error')
    } finally {
      setLoading(false)
    }
  }, [rbtProfileId])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingLog
        ? `/api/admin/rbts/${rbtProfileId}/audit-logs/${editingLog.id}`
        : `/api/admin/rbts/${rbtProfileId}/audit-logs`

      const method = editingLog ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditType: formData.auditType,
          dateTime: formData.dateTime,
          notes: formData.notes || null,
        }),
      })

      if (response.ok) {
        showToast(
          editingLog ? 'Audit log updated successfully' : 'Audit log created successfully',
          'success'
        )
        setDialogOpen(false)
        setEditingLog(null)
        setFormData({
          auditType: 'PHONE_CALL',
          dateTime: new Date().toISOString().slice(0, 16),
          notes: '',
        })
        await fetchAuditLogs()
        router.refresh()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to save audit log', 'error')
      }
    } catch (error) {
      console.error('Error saving audit log:', error)
      showToast('Error saving audit log', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (auditId: string) => {
    if (!confirm('Are you sure you want to delete this audit log?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/admin/rbts/${rbtProfileId}/audit-logs/${auditId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        showToast('Audit log deleted successfully', 'success')
        await fetchAuditLogs()
        router.refresh()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to delete audit log', 'error')
      }
    } catch (error) {
      console.error('Error deleting audit log:', error)
      showToast('Error deleting audit log', 'error')
    }
  }

  const handleEdit = (log: AuditLog) => {
    setEditingLog(log)
    setFormData({
      auditType: log.auditType,
      dateTime: new Date(log.dateTime).toISOString().slice(0, 16),
      notes: log.notes || '',
    })
    setDialogOpen(true)
  }

  const handleNew = () => {
    setEditingLog(null)
    setFormData({
      auditType: 'PHONE_CALL',
      dateTime: new Date().toISOString().slice(0, 16),
      notes: '',
    })
    setDialogOpen(true)
  }

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" />
            Audit Log
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleNew}
                className="dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Audit Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLog ? 'Edit Audit Entry' : 'Add Audit Entry'}
                </DialogTitle>
                <DialogDescription>
                  {editingLog
                    ? 'Update the audit log entry'
                    : `Add a new audit entry for ${rbtName}`}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auditType">Type</Label>
                  <select
                    id="auditType"
                    value={formData.auditType}
                    onChange={(e) =>
                      setFormData({ ...formData, auditType: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="NOTE">Note</option>
                    <option value="MEETING">Meeting</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTime">Date & Time</Label>
                  <Input
                    id="dateTime"
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={(e) =>
                      setFormData({ ...formData, dateTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={4}
                    placeholder="Enter notes about this audit entry..."
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false)
                      setEditingLog(null)
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingLog ? (
                      'Update'
                    ) : (
                      'Add'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-8 text-amber-700 dark:text-[var(--status-warning-text)] bg-amber-50 dark:bg-[var(--status-warning-bg)] rounded-lg border border-amber-200 dark:border-[var(--status-warning-border)] px-4">
            <p className="text-sm font-medium">{fetchError}</p>
            <Button variant="outline" size="sm" className="mt-3 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]" onClick={() => fetchAuditLogs()}>
              Try again
            </Button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
            <Phone className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
            <p className="text-sm">No audit logs yet</p>
            <p className="text-xs text-gray-400 dark:text-[var(--text-disabled)] mt-1">
              Click &quot;Add Audit Entry&quot; to create one
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                        {log.auditType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatDateTime(log.dateTime)}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        {log.notes}
                      </p>
                    )}
                    {log.createdBy && (
                      <p className="text-xs text-gray-500 mt-2">
                        Created by: {log.createdBy}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(log)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(log.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
