'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import ActionCenterSection from '@/components/admin/ActionCenterSection'
import {
  RefreshCw,
  CheckCircle,
  Loader2,
  Calendar,
  UserPlus,
  Download,
  Mail,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Video,
  FileText,
  BellOff,
  Hand,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { ActionCenterSection as SectionType } from '@/app/api/admin/action-center/route'

const SNOOZE_PREFIX = 'action-snooze:'
const SNOOZE_HOURS = 24

function getSnoozeKey(sectionId: string, entityId: string): string {
  return `${SNOOZE_PREFIX}${sectionId}:${entityId}`
}

function isSnoozed(sectionId: string, entityId: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(getSnoozeKey(sectionId, entityId))
  if (!raw) return false
  try {
    const until = new Date(raw)
    return until > new Date()
  } catch {
    return false
  }
}

function setSnooze(sectionId: string, entityId: string): void {
  const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000)
  localStorage.setItem(getSnoozeKey(sectionId, entityId), until.toISOString())
}

interface ApiResponse {
  sections: SectionType[]
  scheduleCandidates?: Array<{ id: string; firstName: string; lastName: string }>
}

export default function ActionCenterPage() {
  const { showToast } = useToast()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [snoozeVersion, setSnoozeVersion] = useState(0)
  const [completeModal, setCompleteModal] = useState<{ interviewId: string; rbtProfileId: string; candidateName: string } | null>(null)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleCandidateId, setScheduleCandidateId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', interviewerName: '' })
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoadError(false)
    try {
      const res = await fetch('/api/admin/action-center', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setLoadError(true)
        showToast('Admin session expired or you are logged in as RBT. Please log in as admin again.', 'error')
        return
      }
      if (!res.ok) {
        setLoadError(true)
        showToast('Failed to load action center', 'error')
        return
      }
      const json: ApiResponse = await res.json()
      setData(json)
      setLastFetchedAt(new Date())
    } catch {
      setLoadError(true)
      showToast('Failed to load action center', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const urgentCount = data?.sections?.filter((s) => s.severity === 'URGENT').reduce((acc, s) => acc + s.count, 0) ?? 0
  const warningCount = data?.sections?.filter((s) => s.severity === 'WARNING').reduce((acc, s) => acc + s.count, 0) ?? 0
  const infoCount = data?.sections?.filter((s) => s.severity === 'INFO').reduce((acc, s) => acc + s.count, 0) ?? 0

  useEffect(() => {
    const prev = document.title
    document.title = urgentCount > 0 ? `(${urgentCount}) Action Center — Rise and Shine` : 'Action Center — Rise and Shine'
    return () => {
      document.title = prev
    }
  }, [urgentCount])

  const filterSnoozed = useCallback(
    (sectionId: string, items: Record<string, unknown>[], getEntityId: (item: Record<string, unknown>) => string) => {
      return items.filter((item) => !isSnoozed(sectionId, getEntityId(item)))
    },
    []
  )

  const scrollToSection = (severity: string) => {
    const section = data?.sections?.find((s) => s.severity === severity)
    if (section) document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleMarkComplete = async (interviewId: string, decision: 'OFFERED' | 'REJECTED') => {
    if (!interviewId) return
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed')
      showToast('Interview marked complete', 'success')
      setCompleteModal(null)
      fetchData()
    } catch (e) {
      showToast((e as Error).message || 'Failed to complete interview', 'error')
    }
  }

  const handleSendReminder = async (rbtId: string) => {
    if (!rbtId) return
    try {
      const res = await fetch(`/api/admin/rbts/${rbtId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateType: 'MISSING_ONBOARDING' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed')
      showToast('Reminder email sent', 'success')
      fetchData()
    } catch (e) {
      showToast((e as Error).message || 'Failed to send reminder', 'error')
    }
  }

  const handleLeaveAction = async (requestId: string, status: 'APPROVED' | 'DENIED') => {
    if (!requestId) return
    try {
      const res = await fetch(`/api/admin/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(`Leave request ${status.toLowerCase()}`, 'success')
      fetchData()
    } catch {
      showToast('Failed to update leave request', 'error')
    }
  }

  const handleClaimInterview = async (interviewId: string) => {
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/claim`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to claim')
      showToast('Interview claimed', 'success')
      fetchData()
    } catch (e) {
      showToast((e as Error).message || 'Failed to claim interview', 'error')
    }
  }

  const handleMoveStatus = async (rbtId: string, newStatus: string) => {
    if (!rbtId) return
    try {
      const res = await fetch(`/api/admin/rbts/${rbtId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed')
      showToast('Status updated', 'success')
      fetchData()
    } catch (e) {
      showToast((e as Error).message || 'Failed to update status', 'error')
    }
  }

  const handleScheduleSubmit = async () => {
    if (!scheduleCandidateId || !scheduleForm.date || !scheduleForm.time || !scheduleForm.interviewerName) {
      showToast('Please fill date, time, and interviewer', 'error')
      return
    }
    setScheduleSubmitting(true)
    try {
      const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString()
      const res = await fetch('/api/admin/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rbtProfileId: scheduleCandidateId,
          scheduledAt,
          durationMinutes: 30,
          interviewerName: scheduleForm.interviewerName,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to schedule')
      showToast('Interview scheduled', 'success')
      setScheduleModalOpen(false)
      setScheduleCandidateId(null)
      setScheduleForm({ date: '', time: '', interviewerName: '' })
      fetchData()
    } catch (e) {
      showToast((e as Error).message || 'Failed to schedule interview', 'error')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const exportCSV = () => {
    if (!data?.sections) return
    const rows: string[][] = [['Name', 'Issue Type', 'Days Outstanding', 'Phone', 'Email', 'Link']]
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    data.sections.forEach((section) => {
      const filtered = section.items.filter((item) => {
        const id = (item as Record<string, unknown>).id as string
        return !isSnoozed(section.id, id)
      })
      filtered.forEach((item: Record<string, unknown>) => {
        const name =
          (item.candidateName as string) ||
          (item.rbtName as string) ||
          `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim()
        const days =
          (item.daysOverdue as number) ?? (item.daysStale as number) ?? (item.daysSinceHired as number) ?? ''
        const phone = (item.phoneNumber as string) ?? ''
        const email = (item.email as string) ?? ''
        const link = (item.rbtProfileId || item.id) as string
        const profileUrl = link ? `${baseUrl}/admin/rbts/${link}` : ''
        rows.push([name, section.title, String(days), phone, email, profileUrl])
      })
    })
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `action-center-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Export downloaded', 'success')
  }

  const totalVisible =
    data?.sections?.reduce((acc, s) => {
      const getEntityId = (item: Record<string, unknown>) => (item.id as string) ?? ''
      return acc + filterSnoozed(s.id, s.items, getEntityId).length
    }, 0) ?? 0

  if (loading && !data && !loadError) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-8 text-center">
        <p className="text-gray-700 dark:text-[var(--text-secondary)] mb-4">Failed to load action center. Check your connection and try again.</p>
        <Button onClick={() => { setLoading(true); fetchData(); }} className="bg-orange-600 hover:bg-orange-700 text-white">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Action Center</h1>
          <p className="text-orange-50 text-lg">Everything that needs your attention, in one place.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-orange-100 text-sm">
              Last refreshed {lastFetchedAt ? formatDistanceToNow(lastFetchedAt, { addSuffix: true }) : '—'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setLoading(true); fetchData(); }}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => scrollToSection('URGENT')}
          className="rounded-full px-4 py-2 text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
        >
          Urgent ({data?.sections?.filter((s) => s.severity === 'URGENT').reduce((a, s) => a + s.count, 0) ?? 0})
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('WARNING')}
          className="rounded-full px-4 py-2 text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
        >
          Warning ({warningCount})
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('INFO')}
          className="rounded-full px-4 py-2 text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
        >
          Info ({infoCount})
        </button>
      </div>

      {totalVisible === 0 && data && (
        <div className="rounded-xl border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-12 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">
            You&apos;re all caught up! No action items right now.
          </h2>
          <p className="text-gray-500 dark:text-[var(--text-tertiary)]">
            Last refreshed {lastFetchedAt ? formatDistanceToNow(lastFetchedAt, { addSuffix: true }) : '—'}
          </p>
        </div>
      )}

      {totalVisible > 0 && data?.sections?.map((section) => {
        const getEntityId = (item: Record<string, unknown>) => (item.id as string) ?? ''
        const items = filterSnoozed(section.id, section.items, getEntityId)
        const count = items.length
        if (count === 0 && section.items.length > 0) {
          return (
            <ActionCenterSection
              key={section.id}
              id={section.id}
              title={section.title}
              severity={section.severity as 'URGENT' | 'WARNING' | 'INFO'}
              count={0}
            >
              <p className="p-4 text-sm text-gray-500 dark:text-[var(--text-tertiary)]">All items in this section are snoozed.</p>
            </ActionCenterSection>
          )
        }
        if (count === 0) return null

        return (
          <ActionCenterSection
            key={section.id}
            id={section.id}
            title={section.title}
            severity={section.severity as 'URGENT' | 'WARNING' | 'INFO'}
            count={count}
          >
            <div className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)]">
              {section.id === 'interviews-today' &&
                items.map((item: Record<string, unknown>) => {
                  const claimed = !!(item.claimedByUserId as string)
                  return (
                    <div
                      key={String(item.id)}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${claimed ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{item.candidateName as string}</p>
                          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                            {format(new Date(item.scheduledAt as string), 'PPp')} · {claimed ? `Claimed by ${item.claimedByName || item.interviewerName}` : 'Unclaimed'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!claimed && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-400 text-orange-600 hover:bg-orange-50"
                            onClick={() => handleClaimInterview(item.id as string)}
                          >
                            <Hand className="h-3 w-3 mr-1" /> Claim
                          </Button>
                        )}
                        {(item.meetingUrl as string) && (
                          <a
                            href={item.meetingUrl as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-orange-600 dark:text-[var(--orange-primary)]"
                          >
                            <Video className="h-4 w-4" /> Join
                          </a>
                        )}
                        <Link
                          href={`/admin/interviews/${item.id}/notes`}
                          className="inline-flex items-center gap-1 text-sm text-orange-600 dark:text-[var(--orange-primary)]"
                        >
                          <FileText className="h-4 w-4" /> Notes
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSnooze(section.id, String(item.id))
                            setSnoozeVersion((v) => v + 1)
                          }}
                          title="Snooze 24 hours"
                        >
                          <BellOff className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

              {section.id === 'flagged-sessions' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{item.rbtName as string}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        Clock in: {format(new Date(item.clockInTime as string), 'PPp')} · {String(item.hoursElapsed)} hours elapsed
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/admin/attendance">
                        <Button size="sm" variant="outline">Edit Entry</Button>
                      </Link>
                      <Link href={`/admin/rbts/${item.rbtProfileId}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))}

              {section.id === 'interviews-not-complete' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{item.candidateName as string}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        {format(new Date(item.scheduledAt as string), 'PP')} · {item.interviewerName as string} · {item.daysOverdue as number} days overdue
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700"
                        onClick={() =>
                          setCompleteModal({
                            interviewId: item.id as string,
                            rbtProfileId: item.rbtProfileId as string,
                            candidateName: item.candidateName as string,
                          })
                        }
                      >
                        Mark Complete
                      </Button>
                      <Link href={`/admin/rbts/${item.rbtProfileId}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        View Profile
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSnooze(section.id, String(item.id))
                          setSnoozeVersion((v) => v + 1)
                        }}
                        title="Snooze 24 hours"
                      >
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              {section.id === 'onboarding-blocked' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{`${item.firstName} ${item.lastName}`}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        Hired {String(item.daysSinceHired ?? '')} days ago · {String(item.phoneNumber || '—')} · {String(item.email || '—')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => handleSendReminder(item.id as string)}>
                        <Mail className="h-4 w-4 mr-1" /> Send Reminder Email
                      </Button>
                      <Link href={`/admin/rbts/${item.id}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        View Profile
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => { setSnooze(section.id, String(item.id)); setSnoozeVersion((v) => v + 1) }} title="Snooze 24 hours">
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              {section.id === 'stale-candidates' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{`${item.firstName} ${item.lastName}`}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        {(item.group as string) === 'REACH_OUT' ? 'Reach Out' : 'To Interview'} · {String(item.daysStale ?? '')} days stale · {String(item.phoneNumber || '—')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(item.group as string) === 'REACH_OUT' && (
                        <Button size="sm" variant="outline" onClick={() => handleMoveStatus(item.id as string, 'TO_INTERVIEW')}>
                          <ArrowRight className="h-4 w-4 mr-1" /> Move to Next Stage
                        </Button>
                      )}
                      {(item.group as string) === 'TO_INTERVIEW' && (
                        <Link href={`/admin/rbts/${item.id}`}>
                          <Button size="sm" variant="outline">Schedule Interview</Button>
                        </Link>
                      )}
                      <Link href={`/admin/rbts/${item.id}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        View Profile
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => { setSnooze(section.id, String(item.id)); setSnoozeVersion((v) => v + 1) }} title="Snooze 24 hours">
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              {section.id === 'leave-requests' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{item.rbtName as string}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        {String(item.type ?? '')} · {format(new Date(item.startDate as string), 'PP')} – {format(new Date(item.endDate as string), 'PP')}
                        {(item.reason as string) && ` · ${String(item.reason)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleLeaveAction(item.id as string, 'APPROVED')}>
                        <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleLeaveAction(item.id as string, 'DENIED')}>
                        <ThumbsDown className="h-4 w-4 mr-1" /> Deny
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSnooze(section.id, String(item.id)); setSnoozeVersion((v) => v + 1) }} title="Snooze 24 hours">
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              {section.id === 'new-applications' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{`${item.firstName} ${item.lastName}`}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        Applied {formatDistanceToNow(new Date(item.createdAt as string), { addSuffix: true })} · {String(item.source || '—')} · {String(item.locationCity || '')} {String(item.locationState || '')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => handleMoveStatus(item.id as string, 'REACH_OUT')}>
                        Move to Reach Out
                      </Button>
                      <Link href={`/admin/rbts/${item.id}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        Review Application
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => { setSnooze(section.id, String(item.id)); setSnoozeVersion((v) => v + 1) }} title="Snooze 24 hours">
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

              {section.id === 'onboarding-nearly-complete' &&
                items.map((item: Record<string, unknown>) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{`${item.firstName} ${item.lastName}`}</p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        {String(item.percentage ?? '')}% complete · {String(item.tasksRemaining ?? '')} tasks remaining
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/rbts/${item.id}`} className="text-sm text-orange-600 dark:text-[var(--orange-primary)]">
                        View Onboarding
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => { setSnooze(section.id, String(item.id)); setSnoozeVersion((v) => v + 1) }} title="Snooze 24 hours">
                        <BellOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ActionCenterSection>
        )
      })}

      <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center gap-3 border-t border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] px-4 py-3 rounded-lg shadow-lg">
        <Link href="/admin/rbts/new">
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" /> Add New Candidate
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => setScheduleModalOpen(true)}>
          <Calendar className="h-4 w-4 mr-2" /> Schedule Interview
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export Action Items
        </Button>
      </div>

      <Dialog open={!!completeModal} onOpenChange={() => setCompleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark interview complete</DialogTitle>
            <DialogDescription>
              Mark this interview as completed for {completeModal?.candidateName}. Choose the outcome.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteModal(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => completeModal && handleMarkComplete(completeModal.interviewId, 'OFFERED')}
            >
              Offered
            </Button>
            <Button
              variant="destructive"
              onClick={() => completeModal && handleMarkComplete(completeModal.interviewId, 'REJECTED')}
            >
              Rejected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Select a candidate and choose date, time, and interviewer.</DialogDescription>
          </DialogHeader>
          {!scheduleCandidateId ? (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {data?.scheduleCandidates?.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No candidates in Reach Out or To Interview.</p>
              ) : (
                data?.scheduleCandidates?.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setScheduleCandidateId(c.id)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    {c.firstName} {c.lastName}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-[var(--text-secondary)]">
                Scheduling for: {data?.scheduleCandidates?.find((c) => c.id === scheduleCandidateId)?.firstName}{' '}
                {data?.scheduleCandidates?.find((c) => c.id === scheduleCandidateId)?.lastName}
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Interviewer name</label>
                <input
                  type="text"
                  value={scheduleForm.interviewerName}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, interviewerName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className="w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {scheduleCandidateId ? (
              <>
                <Button variant="outline" onClick={() => { setScheduleCandidateId(null); setScheduleForm({ date: '', time: '', interviewerName: '' }) }}>
                  Back
                </Button>
                <Button onClick={handleScheduleSubmit} disabled={scheduleSubmitting}>
                  {scheduleSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Schedule
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
