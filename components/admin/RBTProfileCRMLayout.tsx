'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Trash2,
  Activity,
  Calendar,
  CheckCircle2,
  FolderOpen,
  Grid3x3,
  List,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { trackButtonClick } from '@/lib/activity-tracker'
import { formatRbtDocumentTypeLabel } from '@/lib/rbtDocumentTypes'
import RBTProfileInterviews from './rbt-profile/RBTProfileInterviews'
import RBTProfileOnboarding from './rbt-profile/RBTProfileOnboarding'
import RBTProfileDocuments from './rbt-profile/RBTProfileDocuments'
import AdminOnboardingOverride from './AdminOnboardingOverride'
import InterviewScheduleForm from './rbt-profile/InterviewScheduleForm'
import InterviewNotesButton from './InterviewNotesButton'
import AuditLog from '@/components/admin/AuditLog'
import AvailabilityGridPreview from '@/components/admin/rbt-profile/AvailabilityGridPreview'
import AdminRbtAvailabilityDialog from '@/components/admin/rbt-profile/AdminRbtAvailabilityDialog'
import EditProfileForm from '@/components/admin/rbt-profile/EditProfileForm'
import type { RBTProfile } from './rbt-profile/types'

const STATUS_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  NEW: { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-[var(--bg-elevated)]', darkText: 'dark:text-[var(--text-primary)]' },
  REACH_OUT: { bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'dark:bg-[var(--status-interview-bg)]', darkText: 'dark:text-[var(--status-interview-text)]' },
  REACH_OUT_EMAIL_SENT: { bg: 'bg-blue-100', text: 'text-blue-800', darkBg: 'dark:bg-[var(--status-interview-bg)]', darkText: 'dark:text-[var(--status-interview-text)]' },
  TO_INTERVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', darkBg: 'dark:bg-[var(--status-warning-bg)]', darkText: 'dark:text-[var(--status-warning-text)]' },
  INTERVIEW_SCHEDULED: { bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-[var(--status-onboarding-bg)]', darkText: 'dark:text-[var(--status-onboarding-text)]' },
  INTERVIEW_COMPLETED: { bg: 'bg-indigo-50', text: 'text-indigo-700', darkBg: 'dark:bg-[var(--status-scheduled-bg)]', darkText: 'dark:text-[var(--status-scheduled-text)]' },
  HIRED: { bg: 'bg-green-50', text: 'text-green-700', darkBg: 'dark:bg-[var(--status-hired-bg)]', darkText: 'dark:text-[var(--status-hired-text)]' },
  ONBOARDING_COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', darkBg: 'dark:bg-[var(--status-hired-bg)]', darkText: 'dark:text-[var(--status-hired-text)]' },
  STALLED: { bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'dark:bg-[var(--bg-elevated)]', darkText: 'dark:text-[var(--text-tertiary)]' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', darkBg: 'dark:bg-[var(--status-rejected-bg)]', darkText: 'dark:text-[var(--status-rejected-text)]' },
}

const RBT_STATUSES = ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'ONBOARDING_COMPLETED', 'STALLED', 'REJECTED'] as const
type RBTStatus = (typeof RBT_STATUSES)[number]

const TABS = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'availability', label: 'Availability', icon: Grid3x3 },
  { id: 'interviews', label: 'Interviews', icon: Calendar },
  { id: 'onboarding', label: 'Onboarding', icon: CheckCircle2 },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'audit', label: 'Audit Log', icon: List },
] as const

interface RBTProfileCRMLayoutProps {
  rbtProfile: RBTProfile
  searchParams?: { status?: string; search?: string; type?: string }
}

export default function RBTProfileCRMLayout({ rbtProfile: initialRbtProfile, searchParams: initialSearchParams }: RBTProfileCRMLayoutProps) {
  const router = useRouter()
  const searchParamsFromUrl = useSearchParams()
  const statusParam = initialSearchParams?.status ?? searchParamsFromUrl.get('status') ?? ''
  const searchParam = initialSearchParams?.search ?? searchParamsFromUrl.get('search') ?? ''

  const { showToast } = useToast()
  const [rbtProfile, setRbtProfile] = useState(initialRbtProfile)
  const [loading, setLoading] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('activity')
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; auditType: string; dateTime: string; notes: string | null; createdBy: string | null }>>([])
  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; templateType: string; sentAt: string; toEmail: string; subject: string }>>([])
  const [documents, setDocuments] = useState<Array<{ id: string; fileName: string; fileType: string; documentType: string | null; uploadedAt: Date }>>(initialRbtProfile.documents || [])
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false)
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false)
  const [pendingInterviewData, setPendingInterviewData] = useState<any>(null)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false)
  const [schedulingExclusion, setSchedulingExclusion] = useState<{
    id: string
    reason: string | null
    expiresAt: string | null
    active: boolean
  } | null>(null)
  const [restoringSchedulingExclusion, setRestoringSchedulingExclusion] = useState(false)

  const [clientAssignments, setClientAssignments] = useState<Array<{
    id: string
    clientName: string
    daysOfWeek: number[]
    timeStart: string | null
    timeEnd: string | null
    hourlyRate: number | null
    notes: string | null
  }>>([])
  const [clientAssignmentsLoading, setClientAssignmentsLoading] = useState(true)
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null)
  const [editDays, setEditDays] = useState<number[]>([])
  const [editTimeStart, setEditTimeStart] = useState('')
  const [editTimeEnd, setEditTimeEnd] = useState('')
  const [editHourlyRate, setEditHourlyRate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [availabilityEditOpen, setAvailabilityEditOpen] = useState(false)
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false)
  const [schedulingClients, setSchedulingClients] = useState<Array<{ id: string; name: string }>>([])
  const [addAssignmentClientId, setAddAssignmentClientId] = useState('')
  const [addAssignmentDays, setAddAssignmentDays] = useState<number[]>([])
  const [addAssignmentTimeStart, setAddAssignmentTimeStart] = useState('')
  const [addAssignmentTimeEnd, setAddAssignmentTimeEnd] = useState('')
  const [addAssignmentHourlyRate, setAddAssignmentHourlyRate] = useState('')
  const [addAssignmentNotes, setAddAssignmentNotes] = useState('')
  const [addAssignmentSubmitting, setAddAssignmentSubmitting] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  const DAYS: Array<{ value: number; label: string }> = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ]

  const formatDays = (daysOfWeek: number[]): string => {
    const set = new Set(daysOfWeek.map((d) => Number(d)))
    return DAYS.filter((d) => set.has(d.value))
      .map((d) => d.label)
      .join(', ')
  }

  const formatHourlyUsd = (n: number | null | undefined): string | null => {
    if (n == null || !Number.isFinite(n)) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  }

  const derivedAvailabilityJson = useMemo(() => {
    // If assignments have concrete hours/days, treat them as an availability window so the grid auto-fills.
    const byDay: Record<string, boolean> = {}
    const weekend: Record<string, boolean> = {}

    const FULL_BY_VALUE: Record<number, string> = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      0: 'Sunday',
    }

    function parseTimeToMinutes(s: string | null | undefined): number | null {
      if (!s) return null
      const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/)
      if (!m) return null
      const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)))
      const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)))
      return hh * 60 + mm
    }

    let minStart: number | null = null
    let maxEnd: number | null = null

    for (const a of clientAssignments) {
      const s = parseTimeToMinutes(a.timeStart)
      const e = parseTimeToMinutes(a.timeEnd)
      if (s != null) minStart = minStart == null ? s : Math.min(minStart, s)
      if (e != null) maxEnd = maxEnd == null ? e : Math.max(maxEnd, e)
      for (const d of a.daysOfWeek || []) {
        const full = FULL_BY_VALUE[Number(d)]
        if (!full) continue
        const isWeekend = full === 'Saturday' || full === 'Sunday'
        if (isWeekend) weekend[full] = true
        else byDay[full] = true
      }
    }

    const hasAny = Object.values(byDay).some(Boolean) || Object.values(weekend).some(Boolean)
    if (!hasAny) return null

    const earliestStartTime =
      minStart == null ? null : `${String(Math.floor(minStart / 60)).padStart(2, '0')}:${String(minStart % 60).padStart(2, '0')}`
    const latestEndTime =
      maxEnd == null ? null : `${String(Math.floor(maxEnd / 60)).padStart(2, '0')}:${String(maxEnd % 60).padStart(2, '0')}`

    return {
      weekday: byDay,
      weekend,
      earliestStartTime,
      latestEndTime,
    }
  }, [clientAssignments])

  const deleteConfirmMatch =
    deleteConfirmInput.trim().toUpperCase() === 'DELETE' ||
    deleteConfirmInput.trim() === `${rbtProfile.firstName} ${rbtProfile.lastName}` ||
    (!!rbtProfile.email && deleteConfirmInput.trim().toLowerCase() === rbtProfile.email.toLowerCase())

  const currentIndex = ids.indexOf(rbtProfile.id)
  const prevId = currentIndex > 0 ? ids[currentIndex - 1] : null
  const nextId = currentIndex >= 0 && currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null
  const backToPipelineHref = statusParam || searchParam
    ? `/admin/employees?type=RBT${statusParam ? `&status=${statusParam}` : ''}${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}`
    : '/admin/employees'

  useEffect(() => {
    if (!rbtProfile?.id || rbtProfile.id === 'null') return
    const params = new URLSearchParams()
    params.set('idsOnly', '1')
    if (statusParam) params.set('status', statusParam)
    if (searchParam) params.set('search', searchParam)
    fetch(`/api/admin/rbts?${params.toString()}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { ids: [] })
      .then((data) => setIds(data.ids || []))
      .catch(() => setIds([]))
  }, [rbtProfile.id, statusParam, searchParam])

  const fetchAuditLogs = useCallback(async () => {
    if (!rbtProfile.id || rbtProfile.id === 'null') return
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/audit-logs`, { credentials: 'include' })
      if (res.ok) {
        const logs = await res.json()
        setAuditLogs(logs)
      }
    } catch (e) {
      console.error(e)
    }
  }, [rbtProfile.id])

  const fetchEmailLogs = useCallback(async () => {
    if (!rbtProfile.id || rbtProfile.id === 'null') return
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/email-logs`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEmailLogs(data.emailLogs || [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [rbtProfile.id])

  useEffect(() => {
    fetchAuditLogs()
    fetchEmailLogs()
  }, [fetchAuditLogs, fetchEmailLogs])

  useEffect(() => {
    if (!rbtProfile.id) return
    fetch(`/api/admin/scheduling/exclusions?rbtProfileId=${encodeURIComponent(rbtProfile.id)}`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : { exclusions: [] }))
      .then((data) => {
        const active = (data.exclusions ?? []).find((x: { active: boolean }) => x.active)
        setSchedulingExclusion(active ?? null)
      })
      .catch(() => setSchedulingExclusion(null))
  }, [rbtProfile.id])

  const handleRestoreSchedulingExclusion = async () => {
    if (!schedulingExclusion) return
    setRestoringSchedulingExclusion(true)
    try {
      const res = await fetch(`/api/admin/scheduling/exclusions/${schedulingExclusion.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        showToast('Failed to restore to scheduling results', 'error')
        return
      }
      setSchedulingExclusion(null)
      showToast('RBT restored to scheduling proximity results', 'success')
    } catch {
      showToast('Failed to restore to scheduling results', 'error')
    } finally {
      setRestoringSchedulingExclusion(false)
    }
  }

  const handleEditProfileSuccess = (updatedProfile?: Partial<RBTProfile> | null) => {
    setEditProfileDialogOpen(false)
    if (!updatedProfile) return
    setRbtProfile((prev) => ({
      ...prev,
      ...(updatedProfile as any),
    }))
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents`, { credentials: 'include' })
      if (res.ok) {
        const docs = await res.json()
        setDocuments(docs)
      }
    } catch (e) {
      console.error(e)
    }
  }, [rbtProfile.id])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleStatusChange = async (newStatus: string) => {
    setStatusDropdownOpen(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      })
      if (res.ok) {
        setRbtProfile({ ...rbtProfile, status: newStatus })
        showToast('Status updated', 'success')
        fetchAuditLogs()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update status', 'error')
      }
    } catch (e) {
      showToast('Failed to update status', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendReachOutEmail = () => {
    setConfirmMessage(`Send reach-out email to ${rbtProfile.firstName} ${rbtProfile.lastName}?`)
    setConfirmAction(async () => {
      trackButtonClick('Send Reach-Out Email', { resourceType: 'RBTProfile', resourceId: rbtProfile.id, rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}` })
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType: 'REACH_OUT' }),
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Reach-out email sent!', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchEmailLogs()
      } else {
        showToast(data.error || 'Failed to send email', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleSendEmailByTemplate = async (templateType: string) => {
    setSendEmailDialogOpen(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType }),
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Email sent!', 'success')
        fetchEmailLogs()
      } else {
        showToast(data.error || 'Failed to send email', 'error')
      }
    } catch (e) {
      showToast('Failed to send email', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleHire = () => {
    setConfirmMessage('Hire this candidate? This will send a welcome email and create onboarding tasks.')
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/hire`, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setRbtProfile({ ...rbtProfile, status: 'HIRED' })
        showToast('Candidate hired!', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchAuditLogs()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to hire', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleReject = () => {
    setConfirmMessage('Reject this candidate? A rejection email will be sent.')
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/reject`, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setRbtProfile({ ...rbtProfile, status: 'REJECTED' })
        showToast('Candidate rejected.', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchAuditLogs()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to reject', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleStall = () => {
    setConfirmMessage(`Mark ${rbtProfile.firstName} ${rbtProfile.lastName} as Stalled?`)
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'STALLED' }),
        credentials: 'include',
      })
      if (res.ok) {
        setRbtProfile({ ...rbtProfile, status: 'STALLED' })
        showToast('Marked as Stalled.', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchAuditLogs()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update status', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleCompleteInterview = (interviewId: string) => {
    setConfirmMessage('Mark this interview as completed?')
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/interviews/${interviewId}/complete`, { method: 'PATCH', credentials: 'include' })
      if (res.ok) {
        showToast('Interview marked completed!', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        setRbtProfile((prev) => ({
          ...prev,
          status: 'INTERVIEW_COMPLETED',
          interviews: prev.interviews.map((i) => (i.id === interviewId ? { ...i, status: 'COMPLETED' } : i)),
        }))
        fetchAuditLogs()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to complete interview', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleScheduleInterview = (data: { scheduledAt: string; durationMinutes: number; interviewerName: string }) => {
    setPendingInterviewData(data)
    setInterviewDialogOpen(false)
    const d = new Date(data.scheduledAt)
    setConfirmMessage(`Schedule interview on ${d.toLocaleDateString()} at ${d.toLocaleTimeString()} with ${data.interviewerName}?`)
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rbtProfileId: rbtProfile.id, ...data }),
        credentials: 'include',
      })
      if (res.ok) {
        const result = await res.json()
        showToast('Interview scheduled!', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        setPendingInterviewData(null)
        setRbtProfile((prev) => ({
          ...prev,
          status: 'INTERVIEW_SCHEDULED',
          interviews: [
            ...prev.interviews,
            {
              id: result?.id ?? '',
              scheduledAt: new Date(data.scheduledAt),
              durationMinutes: data.durationMinutes ?? 30,
              interviewerName: data.interviewerName ?? '',
              status: 'SCHEDULED',
              decision: 'PENDING',
              notes: null,
              meetingUrl: null,
              reminder_15m_sent_at: null,
            },
          ],
        }))
        fetchAuditLogs()
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to schedule', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDocumentFilesSelected = (files: File[], documentType: string) => {
    if (files.length === 0) return
    setConfirmMessage(
      `Upload ${files.length} file(s) as “${formatRbtDocumentTypeLabel(documentType)}” for ${rbtProfile.firstName} ${rbtProfile.lastName}?`
    )
    setConfirmAction(async () => {
      setUploadingDocuments(true)
      const formData = new FormData()
      files.forEach((f) => {
        formData.append('documents', f)
        formData.append('documentTypes', documentType)
      })
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents`, { method: 'POST', body: formData, credentials: 'include' })
      if (res.ok) {
        showToast(`${files.length} document(s) uploaded.`, 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchDocuments()
      } else {
        const data = await res.json()
        showToast(data.error || 'Upload failed', 'error')
      }
      setUploadingDocuments(false)
    })
    setConfirmDialogOpen(true)
  }

  const handleDeleteDocument = (documentId: string, fileName: string) => {
    setConfirmMessage(`Delete "${fileName}"? This cannot be undone.`)
    setConfirmAction(async () => {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents?documentId=${documentId}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        showToast('Document deleted.', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        fetchDocuments()
      } else {
        const data = await res.json()
        showToast(data.error || 'Delete failed', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents/${documentId}/download`, { credentials: 'include' })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showToast('Downloaded.', 'success')
      } else {
        showToast('Download failed', 'error')
      }
    } catch (e) {
      showToast('Download failed', 'error')
    }
  }

  const handleDeleteRBT = () => {
    setDeleteStep(1)
    setDeleteConfirmInput('')
    setConfirmMessage('Permanently delete this candidate and all data? Click Continue to confirm.')
    setConfirmAction(async () => {
      setDeleteStep(2)
      setConfirmMessage("Type DELETE or the candidate's name or email to enable delete.")
      setConfirmAction(null)
    })
    setConfirmDialogOpen(true)
  }

  const handleDeletePermanently = async () => {
    if (!deleteConfirmMatch) return
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/delete`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        showToast('Candidate deleted.', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        setDeleteStep(0)
        setDeleteConfirmInput('')
        setTimeout(() => router.push('/admin/employees'), 100)
      } else {
        const data = await res.json()
        showToast(data.error || 'Delete failed', 'error')
      }
    } catch (e) {
      showToast('Delete failed.', 'error')
    }
  }

  const statusConfig = STATUS_COLORS[rbtProfile.status] || STATUS_COLORS.NEW
  const canSendReachOut = ['REACH_OUT', 'NEW', 'REACH_OUT_EMAIL_SENT'].includes(rbtProfile.status)
  const canScheduleInterview = ['TO_INTERVIEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT'].includes(rbtProfile.status)
  const canHire = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canStall = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canReject = rbtProfile.status !== 'HIRED' && rbtProfile.status !== 'REJECTED'
  const isHired = rbtProfile.status === 'HIRED'
  const incompleteTasks = rbtProfile.onboardingTasks.filter((t) => !t.isCompleted)
  const ssnOnboardingTask = rbtProfile.onboardingTasks.find((t) => t.taskType === 'SOCIAL_SECURITY_DOCUMENT')
  const canSendSsnReminder =
    isHired &&
    !!rbtProfile.email?.trim() &&
    (!ssnOnboardingTask || !ssnOnboardingTask.isCompleted)

  const fullAddress = [rbtProfile.addressLine1, rbtProfile.addressLine2, rbtProfile.locationCity, rbtProfile.locationState, rbtProfile.zipCode].filter(Boolean).join(', ') || '—'
  const daysSinceApplication = rbtProfile.submittedAt
    ? Math.floor((Date.now() - new Date(rbtProfile.submittedAt).getTime()) / (24 * 60 * 60 * 1000))
    : null

  const stageHistoryLogs = auditLogs.filter((l) => l.auditType === 'STATUS_CHANGE').sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
  const stageHistoryRows: { from: string; to: string; days: number }[] = []
  for (let i = 0; i < stageHistoryLogs.length; i++) {
    const notes = stageHistoryLogs[i].notes || ''
    const match = notes.match(/Status changed from (\w+) to (\w+)/)
    if (match) {
      const to = match[2]
      const from = match[1]
      const end = new Date(stageHistoryLogs[i].dateTime).getTime()
      const start = i < stageHistoryLogs.length - 1 ? new Date(stageHistoryLogs[i + 1].dateTime).getTime() : end
      const days = Math.round((end - start) / (24 * 60 * 60 * 1000))
      stageHistoryRows.push({ from, to, days })
    }
  }

  const handleConfirmDialogOpenChange = (open: boolean) => {
    if (!open && !confirmLoading) {
      setConfirmDialogOpen(false)
      setConfirmAction(null)
      setDeleteStep(0)
      setDeleteConfirmInput('')
    }
  }

  useEffect(() => {
    if (!rbtProfile?.id || rbtProfile.id === 'null') {
      setClientAssignmentsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/scheduling-beta/assignments?rbtId=${encodeURIComponent(rbtProfile.id)}`, { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        const list = (data.assignments ?? []) as Array<Record<string, unknown>>
        setClientAssignments(
          list.map((row) => ({
            id: String(row.id),
            clientName: String(row.clientName ?? ''),
            daysOfWeek: (row.daysOfWeek as number[]) ?? [],
            timeStart: (row.timeStart as string | null) ?? null,
            timeEnd: (row.timeEnd as string | null) ?? null,
            hourlyRate: typeof row.hourlyRate === 'number' && Number.isFinite(row.hourlyRate) ? row.hourlyRate : null,
            notes: (row.notes as string | null) ?? null,
          }))
        )
      } catch {
        if (!cancelled) setClientAssignments([])
      } finally {
        if (!cancelled) setClientAssignmentsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [rbtProfile?.id])

  const openEditAssignment = (a: {
    id: string
    daysOfWeek: number[]
    timeStart: string | null
    timeEnd: string | null
    hourlyRate: number | null
    notes: string | null
  }) => {
    setEditAssignmentId(a.id)
    setEditDays((a.daysOfWeek ?? []).slice().sort((x, y) => x - y))
    setEditTimeStart(a.timeStart ?? '')
    setEditTimeEnd(a.timeEnd ?? '')
    setEditHourlyRate(a.hourlyRate != null && Number.isFinite(a.hourlyRate) ? String(a.hourlyRate) : '')
    setEditNotes(a.notes ?? '')
  }

  const removeAssignment = async (id: string) => {
    if (!confirm('Remove this assigned client from this RBT?')) return
    try {
      const res = await fetch(`/api/admin/scheduling-beta/assignments/${id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to remove assignment', 'error')
        return
      }
      setClientAssignments((prev) => prev.filter((a) => a.id !== id))
      showToast('Assignment removed', 'success')
    } catch {
      showToast('Failed to remove assignment', 'error')
    }
  }

  const submitEditAssignment = async () => {
    if (!editAssignmentId) return
    if (editDays.length === 0) {
      showToast('Select at least one day', 'error')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/admin/scheduling-beta/assignments/${editAssignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          daysOfWeek: editDays,
          timeStart: editTimeStart.trim() || null,
          timeEnd: editTimeEnd.trim() || null,
          hourlyRate: editHourlyRate.trim() === '' ? null : editHourlyRate.trim(),
          notes: editNotes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to update assignment', 'error')
        return
      }
      const updated = data.assignment
      setClientAssignments((prev) =>
        prev.map((a) =>
          a.id === updated.id
            ? {
                ...a,
                daysOfWeek: updated.daysOfWeek ?? a.daysOfWeek,
                timeStart: updated.timeStart ?? null,
                timeEnd: updated.timeEnd ?? null,
                hourlyRate: updated.hourlyRate ?? null,
                notes: updated.notes ?? null,
              }
            : a
        )
      )
      setEditAssignmentId(null)
      showToast('Assignment updated', 'success')
    } catch {
      showToast('Failed to update assignment', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  useEffect(() => {
    if (!addAssignmentOpen) return
    setAddAssignmentClientId('')
    setAddAssignmentDays([])
    setAddAssignmentTimeStart('')
    setAddAssignmentTimeEnd('')
    setAddAssignmentHourlyRate('')
    setAddAssignmentNotes('')
    setClientsLoading(true)
    fetch('/api/admin/scheduling-beta/clients', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { clients: [] }))
      .then((data) => {
        const list = (data.clients ?? []) as Array<{ id: string; name: string }>
        setSchedulingClients(list.map((c) => ({ id: c.id, name: c.name })))
      })
      .catch(() => setSchedulingClients([]))
      .finally(() => setClientsLoading(false))
  }, [addAssignmentOpen])

  const submitAddAssignment = async () => {
    if (!addAssignmentClientId) {
      showToast('Select a client', 'error')
      return
    }
    if (addAssignmentDays.length === 0) {
      showToast('Select at least one day', 'error')
      return
    }
    setAddAssignmentSubmitting(true)
    try {
      const res = await fetch('/api/admin/scheduling-beta/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rbtProfileId: rbtProfile.id,
          clientId: addAssignmentClientId,
          daysOfWeek: [...addAssignmentDays].sort((a, b) => a - b),
          timeStart: addAssignmentTimeStart.trim() || null,
          timeEnd: addAssignmentTimeEnd.trim() || null,
          hourlyRate: addAssignmentHourlyRate.trim() === '' ? null : addAssignmentHourlyRate.trim(),
          notes: addAssignmentNotes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to create assignment', 'error')
        return
      }
      const a = data.assignment as {
        id: string
        clientName: string
        daysOfWeek: number[]
        timeStart: string | null
        timeEnd: string | null
        hourlyRate: number | null
        notes: string | null
      }
      if (a?.id) {
        setClientAssignments((prev) => [
          {
            id: a.id,
            clientName: a.clientName,
            daysOfWeek: a.daysOfWeek,
            timeStart: a.timeStart,
            timeEnd: a.timeEnd,
            hourlyRate: a.hourlyRate ?? null,
            notes: a.notes,
          },
          ...prev,
        ])
      }
      setAddAssignmentOpen(false)
      showToast('Assignment added', 'success')
    } catch {
      showToast('Failed to create assignment', 'error')
    } finally {
      setAddAssignmentSubmitting(false)
    }
  }

  // eslint-disable-next-line react/jsx-no-target-blank
  const root = (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              <Link href="/admin/dashboard" className="hover:text-orange-600 dark:hover:text-[var(--orange-primary)]">Dashboard</Link>
              <span>/</span>
              <Link href="/admin/employees" className="hover:text-orange-600 dark:hover:text-[var(--orange-primary)]">Employees &amp; Candidates</Link>
              <span>/</span>
              <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{rbtProfile.firstName} {rbtProfile.lastName}</span>
            </nav>
            <div className="flex items-center gap-2">
              {prevId && (
                <Link href={`/admin/rbts/${prevId}${statusParam ? `?status=${statusParam}` : ''}${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}`}>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
              )}
              {nextId && (
                <Link href={`/admin/rbts/${nextId}${statusParam ? `?status=${statusParam}` : ''}${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}`}>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
                </Link>
              )}
              <Link href={backToPipelineHref}>
                <Button variant="outline" size="sm">Back to Pipeline</Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0 font-medium`}
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              disabled={loading}
            >
              {rbtProfile.status.replace(/_/g, ' ')}
            </Button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 py-1 rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] shadow-lg min-w-[180px]">
                  {RBT_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[var(--bg-elevated-hover)] ${rbtProfile.status === s ? 'font-semibold' : ''}`}
                      onClick={() => handleStatusChange(s)}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-[1600px] mx-auto space-y-4">
        {schedulingExclusion?.active && (
          <div className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="font-medium">
              ⚠️ This RBT is currently excluded from scheduling proximity results
            </p>
            <p className="text-sm mt-1">Reason: {schedulingExclusion.reason?.trim() || '—'}</p>
            <p className="text-sm">
              Expires:{' '}
              {schedulingExclusion.expiresAt
                ? new Date(schedulingExclusion.expiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'America/New_York',
                  })
                : 'No expiry'}
            </p>
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestoreSchedulingExclusion}
                disabled={restoringSchedulingExclusion}
              >
                {restoringSchedulingExclusion ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Restore to Results
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar - 1/3, stacks above on mobile */}
        <aside className="w-full lg:w-1/3 lg:max-w-[400px] order-1 lg:order-1 lg:sticky lg:top-[57px] lg:self-start space-y-4">
          <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
                {rbtProfile.firstName} {rbtProfile.lastName}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0`}>
                  {rbtProfile.status.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="outline" className="dark:border-[var(--border-subtle)]">
                  {rbtProfile.source === 'PUBLIC_APPLICATION' ? 'Applied Online' : 'Admin Created'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {canSendReachOut && (
                  <Button size="sm" variant="outline" onClick={handleSendReachOutEmail} disabled={loading || !rbtProfile.email}>Send Reach Out</Button>
                )}
                {canScheduleInterview && (
                  <Button size="sm" variant="outline" onClick={() => setInterviewDialogOpen(true)} disabled={loading}>Schedule Interview</Button>
                )}
                {canHire && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleHire} disabled={loading}>Hire</Button>}
                {canStall && <Button size="sm" variant="outline" onClick={handleStall} disabled={loading}>Stall</Button>}
                {canReject && <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading || !rbtProfile.email}>Reject</Button>}
                <Button size="sm" variant="outline" onClick={() => setSendEmailDialogOpen(true)} disabled={loading}><Mail className="h-4 w-4 mr-1" />Send Email</Button>
                {rbtProfile.resumeUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/resume`, { credentials: 'include' })
                      if (res.ok) {
                        const blob = await res.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = rbtProfile.resumeFileName || 'resume.pdf'
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                        showToast('Resume downloaded.', 'success')
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />Resume
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Contact</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <p><Phone className="inline h-4 w-4 mr-1 text-gray-500" /><a href={`tel:${rbtProfile.phoneNumber}`} className="text-orange-600 dark:text-[var(--orange-primary)]">{rbtProfile.phoneNumber}</a></p>
              <p><Mail className="inline h-4 w-4 mr-1 text-gray-500" /><a href={rbtProfile.email ? `mailto:${rbtProfile.email}` : '#'} className="text-orange-600 dark:text-[var(--orange-primary)]">{rbtProfile.email || '—'}</a></p>
              <p><MapPin className="inline h-4 w-4 mr-1 text-gray-500" />{fullAddress}</p>
              {rbtProfile.preferredServiceArea && <p>Service area: {rbtProfile.preferredServiceArea}</p>}
              {daysSinceApplication != null && <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Days since application: {daysSinceApplication}</p>}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
            <CardHeader className="py-3 flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Candidate details</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setEditProfileDialogOpen(true)}
                disabled={loading}
              >
                Edit Profile
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-1 text-sm text-gray-700 dark:text-[var(--text-tertiary)]">
              <p>Gender: {rbtProfile.gender || '—'}</p>
              {rbtProfile.ethnicity && <p>Ethnicity: {String(rbtProfile.ethnicity).replace(/_/g, ' ')}</p>}
              {rbtProfile.languagesJson
                ? ((): ReactNode => {
                    const j = rbtProfile.languagesJson as { languages?: string[]; otherLanguage?: string } | null
                    const arr = [...(j?.languages || []), j?.otherLanguage].filter(Boolean) as string[]
                    return arr.length > 0 ? <p>Languages: {arr.join(', ')}</p> : null
                  })()
                : null}
              {rbtProfile.transportation !== null && <p>Transportation: {rbtProfile.transportation ? 'Yes' : 'No'}</p>}
              {rbtProfile.authorizedToWork !== null && <p>Authorized to work: {rbtProfile.authorizedToWork ? 'Yes' : 'No'}</p>}
              {rbtProfile.canPassBackgroundCheck !== null && <p>Background check: {rbtProfile.canPassBackgroundCheck ? 'Yes' : 'No'}</p>}
              {rbtProfile.cprFirstAidCertified && <p>CPR/First Aid: {rbtProfile.cprFirstAidCertified === 'true' ? 'Yes' : rbtProfile.cprFirstAidCertified === 'false' ? 'No' : rbtProfile.cprFirstAidCertified}</p>}
              {(rbtProfile.experienceYears != null || (rbtProfile.experienceYearsDisplay && rbtProfile.experienceYearsDisplay !== '')) && (
                <p>Experience: {rbtProfile.experienceYearsDisplay || (rbtProfile.experienceYears != null ? `${rbtProfile.experienceYears} years` : '—')}</p>
              )}
              <p>40-hour course: {rbtProfile.fortyHourCourseCompleted ? 'Yes' : 'No'}</p>
              {rbtProfile.preferredAgeGroupsJson && Array.isArray(rbtProfile.preferredAgeGroupsJson) && (rbtProfile.preferredAgeGroupsJson as string[]).length > 0
                ? <p>Preferred age groups: {(rbtProfile.preferredAgeGroupsJson as string[]).join(', ')}</p>
                : null}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
            <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Availability</CardTitle>
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className="text-xs font-medium text-orange-600 dark:text-[var(--orange-primary)] hover:underline shrink-0"
              >
                Expand
              </button>
            </CardHeader>
            <CardContent className="pt-0">
              <AvailabilityGridPreview availabilityJson={rbtProfile.availabilityJson} />
              {rbtProfile.preferredHoursRange ? (
                <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-2">
                  Preferred weekly hours: <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">{rbtProfile.preferredHoursRange.replace(/-/g, '–')} hrs</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Stage history</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {stageHistoryRows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">No stage history yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {stageHistoryRows.map((row, i) => (
                    <li key={i} className="text-gray-700 dark:text-[var(--text-tertiary)]">
                      In {row.to.replace(/_/g, ' ')}: {row.days} day{row.days !== 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canReject && (
            <Button variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-[var(--status-rejected-border)] dark:text-[var(--status-rejected-text)]" onClick={handleDeleteRBT} disabled={loading}>
              <Trash2 className="h-4 w-4 mr-2" />Delete candidate
            </Button>
          )}
        </aside>

        {/* Right panel - 2/3 tabs */}
        <main className="flex-1 min-w-0 order-2 lg:order-2">
          <div className="flex border-b border-gray-200 dark:border-[var(--border-subtle)] mb-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 dark:border-[var(--orange-primary)] dark:text-[var(--orange-primary)]'
                    : 'border-transparent text-gray-600 dark:text-[var(--text-tertiary)] hover:text-gray-900 dark:hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="transition-opacity duration-200">
            {activeTab === 'activity' && (
              <ActivityTab
                rbtProfile={rbtProfile}
                auditLogs={auditLogs}
                emailLogs={emailLogs}
                documents={documents}
                onNoteAdded={fetchAuditLogs}
              />
            )}
            {activeTab === 'availability' && (
              <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
                <CardHeader className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                      Weekly availability
                    </CardTitle>
                    <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] mt-1">
                      Days and hourly window from their application. Orange cells = available that hour.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setAvailabilityEditOpen(true)}
                    disabled={loading}
                  >
                    Edit availability &amp; schedule
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <AvailabilityGridPreview availabilityJson={rbtProfile.availabilityJson || derivedAvailabilityJson} />
                  {rbtProfile.preferredHoursRange ? (
                    <p className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                      <span className="font-medium">Preferred weekly hours:</span>{' '}
                      {rbtProfile.preferredHoursRange.replace(/-/g, '–')} hours
                    </p>
                  ) : null}

                  <div className="border-t border-gray-200 dark:border-[var(--border-subtle)] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                        Assigned clients
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddAssignmentOpen(true)}
                          disabled={loading}
                        >
                          Add assignment
                        </Button>
                        <Link
                          href="/admin/scheduling-beta"
                          className="text-xs font-semibold text-orange-600 hover:underline dark:text-[var(--orange-primary)]"
                        >
                          Open scheduling demo →
                        </Link>
                      </div>
                    </div>

                    {clientAssignmentsLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading assignments…
                      </div>
                    ) : clientAssignments.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        No assigned clients yet.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {clientAssignments.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
                                  {a.clientName}
                                </p>
                                <p className="mt-0.5 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                                  {formatDays(a.daysOfWeek)}
                                  {(a.timeStart || a.timeEnd) ? (
                                    <span className="ml-2">
                                      {a.timeStart ?? '—'}–{a.timeEnd ?? '—'}
                                    </span>
                                  ) : null}
                                </p>
                                {formatHourlyUsd(a.hourlyRate) ? (
                                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-[var(--text-primary)]">
                                    RBT hourly rate: {formatHourlyUsd(a.hourlyRate)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditAssignment(a)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => removeAssignment(a.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                            {a.notes ? (
                              <p className="mt-2 text-sm text-gray-700 dark:text-[var(--text-secondary)] whitespace-pre-wrap">
                                {a.notes}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {activeTab === 'interviews' && (
              <div className="space-y-4">
                {rbtProfile.interviews.length === 0 ? (
                  <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
                    <CardContent className="py-12 text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
                      <p className="text-gray-500 dark:text-[var(--text-tertiary)]">No interviews yet.</p>
                      <Button className="mt-3" onClick={() => setInterviewDialogOpen(true)} disabled={loading}>Schedule new interview</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <RBTProfileInterviews
                      rbtProfile={rbtProfile}
                      loading={loading}
                      onCompleteInterview={handleCompleteInterview}
                      onHire={handleHire}
                      onReject={handleReject}
                    />
                    <Button variant="outline" onClick={() => setInterviewDialogOpen(true)} disabled={loading}>Schedule new interview</Button>
                  </>
                )}
              </div>
            )}
            {activeTab === 'onboarding' && (
              <div className="space-y-4">
                {!isHired ? (
                  <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
                    <CardContent className="py-12 text-center text-gray-500 dark:text-[var(--text-tertiary)]">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
                      <p>Onboarding is available after the candidate is hired.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <AdminOnboardingOverride
                      rbtProfileId={rbtProfile.id}
                      rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
                      onboardingTasks={rbtProfile.onboardingTasks}
                      scheduleCompleted={rbtProfile.scheduleCompleted || false}
                      onTasksChange={(nextTasks) =>
                        setRbtProfile((prev) => ({
                          ...prev,
                          onboardingTasks: nextTasks as any,
                        }))
                      }
                      onScheduleCompletedChange={(next) =>
                        setRbtProfile((prev) => ({
                          ...prev,
                          scheduleCompleted: next,
                        }))
                      }
                    />
                    <RBTProfileOnboarding rbtProfile={rbtProfile} showToast={showToast} />
                  </>
                )}
              </div>
            )}
            {activeTab === 'documents' && (
              <RBTProfileDocuments
                rbtProfileId={rbtProfile.id}
                rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
                documents={documents}
                onboardingCompletions={rbtProfile.onboardingCompletions}
                uploadingDocuments={uploadingDocuments}
                uploadDisabled={confirmDialogOpen}
                onFilesSelected={handleDocumentFilesSelected}
                onDownload={handleDownloadDocument}
                onDelete={handleDeleteDocument}
                onRequestReupload={async (completionId) => {
                  const res = await fetch(
                    `/api/admin/rbts/${rbtProfile.id}/documents/request-reupload`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ completionId }),
                    }
                  )
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Failed to request re-upload')
                  }
                  setRbtProfile((prev) => ({
                    ...prev,
                    onboardingCompletions:
                      prev.onboardingCompletions?.map((c) =>
                        c.id === completionId
                          ? {
                              ...c,
                              status: 'NOT_STARTED',
                              signedPdfUrl: null,
                              completedAt: null,
                              hasSignedPdfData: false,
                              hasSignatureCertificate: false,
                            }
                          : c
                      ) ?? [],
                  }))
                  showToast('Re-upload requested. RBT will receive an email.', 'success')
                }}
              />
            )}
            {activeTab === 'audit' && (
              <AuditLog
                rbtProfileId={rbtProfile.id}
                rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
                onLogsChange={fetchAuditLogs}
              />
            )}
          </div>
        </main>
        </div>
      </div>

      {/* Edit profile dialog */}
      <Dialog open={editProfileDialogOpen} onOpenChange={setEditProfileDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update gender/ethnicity and core profile information for {rbtProfile.firstName} {rbtProfile.lastName}.
            </DialogDescription>
          </DialogHeader>
          <EditProfileForm
            rbtProfile={rbtProfile}
            onCancel={() => setEditProfileDialogOpen(false)}
            onSuccess={handleEditProfileSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Interview schedule dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription>Schedule an interview for {rbtProfile.firstName} {rbtProfile.lastName}</DialogDescription>
          </DialogHeader>
          <InterviewScheduleForm
            rbtProfileId={rbtProfile.id}
            onSubmit={handleScheduleInterview}
            onCancel={() => setInterviewDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Send email dialog */}
      <Dialog open={sendEmailDialogOpen} onOpenChange={setSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email</DialogTitle>
            <DialogDescription>Choose template to send to {rbtProfile.email || 'candidate'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {canSendReachOut && <Button variant="outline" className="w-full justify-start" onClick={() => handleSendEmailByTemplate('REACH_OUT')}>Reach out</Button>}
            {isHired && incompleteTasks.length > 0 && (
              <Button variant="outline" className="w-full justify-start" onClick={() => handleSendEmailByTemplate('MISSING_ONBOARDING')}>
                Missing onboarding reminder
              </Button>
            )}
            {canSendSsnReminder && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSendEmailByTemplate('SOCIAL_SECURITY_UPLOAD_REMINDER')}
              >
                Social Security upload reminder
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={handleConfirmDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteStep === 2 ? 'Confirm permanent delete' : 'Confirm'}</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
          </DialogHeader>
          {deleteStep === 2 && (
            <div className="space-y-2">
              <Label>Type DELETE or the candidate&apos;s name or email</Label>
              <Input value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} placeholder="DELETE" className="font-mono" autoComplete="off" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setConfirmAction(null); setConfirmLoading(false); setDeleteStep(0); setDeleteConfirmInput('') }} disabled={confirmLoading}>Cancel</Button>
            {deleteStep === 2 ? (
              <Button variant="destructive" onClick={handleDeletePermanently} disabled={!deleteConfirmMatch || confirmLoading}>{confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete permanently'}</Button>
            ) : (
              <Button
                onClick={async () => {
                  if (confirmAction) {
                    setConfirmLoading(true)
                    try {
                      await confirmAction()
                    } finally {
                      setConfirmLoading(false)
                    }
                  }
                }}
                disabled={confirmLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {confirmLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : deleteStep === 1 ? 'Continue' : 'Confirm'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminRbtAvailabilityDialog
        open={availabilityEditOpen}
        onOpenChange={setAvailabilityEditOpen}
        rbtProfileId={rbtProfile.id}
        availabilityJson={rbtProfile.availabilityJson}
        preferredHoursRange={rbtProfile.preferredHoursRange}
        showToast={showToast}
        onSaved={(data) => {
          setRbtProfile((prev) => ({
            ...prev,
            availabilityJson: data.availabilityJson,
            preferredHoursRange: data.preferredHoursRange,
            scheduleCompleted: data.scheduleCompleted,
          }))
          fetchAuditLogs()
        }}
      />

      <Dialog open={addAssignmentOpen} onOpenChange={setAddAssignmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add client assignment</DialogTitle>
            <DialogDescription>
              Link a scheduling client to this RBT with days and optional times.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client *</Label>
              {clientsLoading ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clients…
                </div>
              ) : schedulingClients.length === 0 ? (
                <p className="text-sm text-amber-700 mt-2">
                  No clients in the list. Add one from{' '}
                  <Link href="/admin/scheduling-beta" className="underline font-medium">
                    scheduling beta
                  </Link>{' '}
                  or create via API.
                </p>
              ) : (
                <Select value={addAssignmentClientId} onValueChange={setAddAssignmentClientId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedulingClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Days of week *</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() =>
                      setAddAssignmentDays((prev) =>
                        prev.includes(d.value)
                          ? prev.filter((x) => x !== d.value)
                          : [...prev, d.value].sort((a, b) => a - b)
                      )
                    }
                    className={`inline-flex items-center justify-center w-10 h-8 rounded text-sm border ${
                      addAssignmentDays.includes(d.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input bg-background'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Time start</Label>
                <Input
                  value={addAssignmentTimeStart}
                  onChange={(e) => setAddAssignmentTimeStart(e.target.value)}
                  placeholder="16:00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time end</Label>
                <Input
                  value={addAssignmentTimeEnd}
                  onChange={(e) => setAddAssignmentTimeEnd(e.target.value)}
                  placeholder="19:00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>RBT salary / hour (USD)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={addAssignmentHourlyRate}
                onChange={(e) => setAddAssignmentHourlyRate(e.target.value)}
                placeholder="e.g. 28.50"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-1">
                Optional. Shown on this Availability tab with the assignment.
              </p>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                value={addAssignmentNotes}
                onChange={(e) => setAddAssignmentNotes(e.target.value)}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddAssignmentOpen(false)} disabled={addAssignmentSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitAddAssignment}
              disabled={addAssignmentSubmitting || clientsLoading || schedulingClients.length === 0 || !addAssignmentClientId || addAssignmentDays.length === 0}
            >
              {addAssignmentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAssignmentId} onOpenChange={(open) => !open && setEditAssignmentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit assigned client</DialogTitle>
            <DialogDescription>
              Update days, times, pay, or notes. Changes save immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Days of week *</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() =>
                      setEditDays((prev) =>
                        prev.includes(d.value)
                          ? prev.filter((x) => x !== d.value)
                          : [...prev, d.value].sort((a, b) => a - b)
                      )
                    }
                    className={`inline-flex items-center justify-center w-10 h-8 rounded text-sm border ${
                      editDays.includes(d.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input bg-background'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Time start</Label>
                <Input value={editTimeStart} onChange={(e) => setEditTimeStart(e.target.value)} placeholder="16:00" />
              </div>
              <div>
                <Label>Time end</Label>
                <Input value={editTimeEnd} onChange={(e) => setEditTimeEnd(e.target.value)} placeholder="19:00" />
              </div>
            </div>
            <div>
              <Label>RBT salary / hour (USD)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={editHourlyRate}
                onChange={(e) => setEditHourlyRate(e.target.value)}
                placeholder="e.g. 28.50"
              />
              <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-1">Leave blank to clear.</p>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditAssignmentId(null)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={submitEditAssignment} disabled={editSubmitting || editDays.length === 0}>
              {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
  return root
}

function ActivityTab({
  rbtProfile,
  auditLogs,
  emailLogs,
  documents,
  onNoteAdded,
}: {
  rbtProfile: RBTProfile
  auditLogs: Array<{ id: string; auditType: string; dateTime: string; notes: string | null; createdBy: string | null }>
  emailLogs: Array<{ id: string; templateType: string; sentAt: string; toEmail: string; subject: string }>
  documents: Array<{ id: string; fileName: string; uploadedAt: Date }>
  onNoteAdded: () => void
}) {
  const { showToast } = useToast()
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [timeline, setTimeline] = useState<Array<{ id: string; type: string; icon: string; description: string; timestamp: Date; who: string | null }>>([])

  useEffect(() => {
    const items: Array<{ id: string; type: string; icon: string; description: string; timestamp: Date; who: string | null }> = []
    auditLogs.forEach((l) => {
      items.push({
        id: `audit-${l.id}`,
        type: l.auditType,
        icon: 'log',
        description: l.notes || l.auditType.replace(/_/g, ' '),
        timestamp: new Date(l.dateTime),
        who: l.createdBy,
      })
    })
    emailLogs.forEach((e) => {
      items.push({
        id: `email-${e.id}`,
        type: 'EMAIL_SENT',
        icon: 'mail',
        description: `${e.templateType.replace(/_/g, ' ')} to ${e.toEmail}`,
        timestamp: new Date(e.sentAt),
        who: null,
      })
    })
    rbtProfile.interviews.forEach((i) => {
      items.push({
        id: `interview-${i.id}`,
        type: 'INTERVIEW',
        icon: 'calendar',
        description: `Interview ${i.status.toLowerCase()} – ${formatDateTime(i.scheduledAt)}`,
        timestamp: new Date(i.scheduledAt),
        who: i.interviewerName,
      })
    })
    rbtProfile.onboardingTasks.filter((t) => t.completedAt).forEach((t) => {
      items.push({
        id: `task-${t.id}`,
        type: 'ONBOARDING',
        icon: 'check',
        description: `Task completed: ${t.title}`,
        timestamp: new Date(t.completedAt!),
        who: null,
      })
    })
    documents.forEach((d) => {
      items.push({
        id: `doc-${d.id}`,
        type: 'DOCUMENT',
        icon: 'file',
        description: `Document uploaded: ${d.fileName}`,
        timestamp: new Date(d.uploadedAt),
        who: null,
      })
    })
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    setTimeline(items)
  }, [auditLogs, emailLogs, rbtProfile.interviews, rbtProfile.onboardingTasks, documents])

  const handleAddNote = async () => {
    const trimmed = noteText.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfile.id}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditType: 'NOTE', dateTime: new Date().toISOString(), notes: trimmed }),
        credentials: 'include',
      })
      if (res.ok) {
        setNoteText('')
        showToast('Note added.', 'success')
        onNoteAdded()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add note', 'error')
      }
    } catch (e) {
      showToast('Failed to add note', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
            className="flex-1"
          />
          <Button onClick={handleAddNote} disabled={!noteText.trim() || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        {timeline.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-[var(--text-tertiary)]">
            <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
            <p>No activity yet. Add a note above or activity will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="flex gap-3 p-3 rounded-lg border border-gray-100 dark:border-[var(--border-subtle)] bg-gray-50/50 dark:bg-[var(--bg-input)]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-[var(--orange-subtle)] flex items-center justify-center">
                  <Activity className="h-4 w-4 text-orange-600 dark:text-[var(--orange-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{item.description}</p>
                  <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-0.5">
                    {formatDateTime(item.timestamp)}
                    {item.who && ` · ${item.who}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
  return content
}
