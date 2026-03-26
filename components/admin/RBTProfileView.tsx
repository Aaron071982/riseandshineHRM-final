'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/utils'
import { CheckCircle2, XCircle, Download, FileText, Trash2, Edit, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'
import RBTScheduleView from './RBTScheduleView'
import InterviewNotesButton from './InterviewNotesButton'
import AdminOnboardingOverride from './AdminOnboardingOverride'
import StatusManager from './StatusManager'
import { trackButtonClick } from '@/lib/activity-tracker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  RBTProfileHeader,
  RBTProfileDocuments,
  RBTProfileAuditLog,
  RBTProfileInterviews,
  RBTProfileOnboarding,
  EditProfileForm,
  InterviewScheduleForm,
} from './rbt-profile'
import type { RBTProfile } from './rbt-profile/types'

interface RBTProfileViewProps {
  rbtProfile: RBTProfile
}

const statusColors: Record<string, string> = {
  NEW: 'bg-gray-500',
  REACH_OUT: 'bg-blue-500',
  REACH_OUT_EMAIL_SENT: 'bg-blue-600',
  TO_INTERVIEW: 'bg-yellow-500',
  INTERVIEW_SCHEDULED: 'bg-purple-500',
  INTERVIEW_COMPLETED: 'bg-indigo-500',
  HIRED: 'bg-green-500',
  ONBOARDING_COMPLETED: 'bg-emerald-500',
  STALLED: 'bg-amber-500',
  REJECTED: 'bg-red-500',
}

export default function RBTProfileView({ rbtProfile: initialRbtProfile }: RBTProfileViewProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [rbtProfile, setRbtProfile] = useState(initialRbtProfile)
  const [loading, setLoading] = useState(false)
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [pendingInterviewData, setPendingInterviewData] = useState<any>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [documents, setDocuments] = useState<Array<{
    id: string
    fileName: string
    fileType: string
    documentType: string | null
    uploadedAt: Date
  }>>(initialRbtProfile.documents || [])
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [clientAssignments, setClientAssignments] = useState<Array<{
    id: string
    clientName: string
    daysOfWeek: number[]
    timeStart: string | null
    timeEnd: string | null
    notes: string | null
  }>>([])
  const [clientAssignmentsLoading, setClientAssignmentsLoading] = useState(true)

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
        setClientAssignments(data.assignments ?? [])
      } catch (e) {
        if (!cancelled) setClientAssignments([])
      } finally {
        if (!cancelled) setClientAssignmentsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [rbtProfile?.id])

  const handleSendReachOutEmail = () => {
    setConfirmMessage(`Are you sure you want to send a reach-out email to ${rbtProfile.firstName} ${rbtProfile.lastName}?`)
    setConfirmAction(async () => {
      trackButtonClick('Send Reach-Out Email', {
        resourceType: 'RBTProfile',
        resourceId: rbtProfile.id,
        rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}`,
      })
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateType: 'REACH_OUT' }),
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok) {
          showToast('Reach-out email sent successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
        } else {
          showToast(`Failed to send email: ${data.error || 'Unknown error'}`, 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error sending email:', error)
        showToast('An error occurred while sending the email', 'error')
        // Keep dialog open on error so user can see the error message
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleHire = () => {
    trackButtonClick('Hire RBT', {
      resourceType: 'RBTProfile',
      resourceId: rbtProfile.id,
      rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}`,
    })
    setConfirmMessage('Are you sure you want to hire this candidate? This will send a welcome email and create onboarding tasks.')
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/hire`, {
          method: 'POST',
          credentials: 'include',
        })

        if (response.ok) {
          setRbtProfile({ ...rbtProfile, status: 'HIRED' })
          showToast('Candidate hired successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to hire candidate', 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error hiring candidate:', error)
        showToast('An error occurred while hiring the candidate', 'error')
        // Keep dialog open on error so user can see the error message
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleReject = () => {
    trackButtonClick('Reject RBT', {
      resourceType: 'RBTProfile',
      resourceId: rbtProfile.id,
      rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}`,
    })
    setConfirmMessage('Are you sure you want to reject this candidate? This will send a rejection email and update their status to REJECTED.')
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/reject`, {
          method: 'POST',
          credentials: 'include',
        })

        if (response.ok) {
          setRbtProfile({ ...rbtProfile, status: 'REJECTED' })
          showToast('Candidate rejected successfully. A rejection email has been sent.', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to reject candidate', 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error rejecting candidate:', error)
        showToast('An error occurred while rejecting the candidate', 'error')
        // Keep dialog open on error so user can see the error message
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleSendMissingOnboardingEmail = () => {
    trackButtonClick('Send Missing Onboarding Reminder', {
      resourceType: 'RBTProfile',
      resourceId: rbtProfile.id,
      rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}`,
    })
    setConfirmMessage(`Are you sure you want to send a missing onboarding reminder email to ${rbtProfile.firstName} ${rbtProfile.lastName}? This will list their incomplete onboarding tasks.`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateType: 'MISSING_ONBOARDING' }),
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok) {
          showToast('Missing onboarding reminder email sent successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
        } else {
          showToast(`Failed to send email: ${data.error || 'Unknown error'}`, 'error')
        }
      } catch (error) {
        console.error('Error sending email:', error)
        showToast('An error occurred while sending the email', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDeleteRBT = () => {
    setDeleteStep(1)
    setDeleteConfirmInput('')
    setConfirmMessage(
      `This will permanently delete ${rbtProfile.firstName} ${rbtProfile.lastName} and all associated data (interviews, documents, audit log). This action cannot be undone. Click "Continue" to confirm.`
    )
    setConfirmAction(async () => {
      setDeleteStep(2)
      setConfirmMessage(`Type DELETE or the candidate's full name or email to enable the delete button.`)
      setConfirmAction(null)
    })
    setConfirmDialogOpen(true)
  }

  const handleDeletePermanently = async () => {
    if (!deleteConfirmMatch) return
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/delete`, { method: 'DELETE', credentials: 'include' })
      if (response.ok) {
        showToast('RBT deleted successfully', 'success')
        setConfirmDialogOpen(false)
        setConfirmAction(null)
        setDeleteStep(0)
        setDeleteConfirmInput('')
        setTimeout(() => router.push('/admin/rbts'), 100)
      } else {
        const errorData = await response.json()
        showToast(`Failed to delete RBT: ${errorData.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting RBT:', error)
      showToast('An error occurred while deleting the RBT. Please try again.', 'error')
    }
  }

  const handleStall = () => {
    setConfirmMessage(`Mark ${rbtProfile.firstName} ${rbtProfile.lastName} as Stalled? This will set their status to Stalled (e.g. no response, on hold).`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'STALLED' }),
          credentials: 'include',
        })
        if (response.ok) {
          setRbtProfile({ ...rbtProfile, status: 'STALLED' })
          showToast('Candidate marked as Stalled.', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to update status', 'error')
        }
      } catch (error) {
        console.error('Error marking stalled:', error)
        showToast('An error occurred. Please try again.', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleCompleteInterview = (interviewId: string) => {
    setConfirmMessage(`Are you sure you want to mark this interview as completed?`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/interviews/${interviewId}/complete`, {
          method: 'PATCH',
          credentials: 'include',
        })

        if (response.ok) {
          showToast('Interview marked as completed!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          setRbtProfile((prev) => ({
            ...prev,
            status: 'INTERVIEW_COMPLETED',
            interviews: prev.interviews.map((i) =>
              i.id === interviewId ? { ...i, status: 'COMPLETED' } : i
            ),
          }))
        } else {
          const errorData = await response.json()
          showToast(errorData.error || 'Failed to complete interview', 'error')
        }
      } catch (error) {
        console.error('Error completing interview:', error)
        showToast('An error occurred while completing the interview', 'error')
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleScheduleInterview = (data: any) => {
    // Store the interview data and close the form dialog
    setPendingInterviewData(data)
    setInterviewDialogOpen(false)
    
    // Format the date/time for confirmation message
    const scheduledDate = new Date(data.scheduledAt)
    const formattedDate = scheduledDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/New_York',
    })
    
    setConfirmMessage(`Schedule interview for ${rbtProfile.firstName} ${rbtProfile.lastName} on ${formattedDate} at ${formattedTime} with ${data.interviewerName}?`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/interviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rbtProfileId: rbtProfile.id,
            ...data,
          }),
          credentials: 'include',
        })

        if (response.ok) {
          const result = await response.json()
          const newId = result?.id ?? ''
          showToast('Interview scheduled successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          setPendingInterviewData(null)
          setRbtProfile((prev) => ({
            ...prev,
            status: 'INTERVIEW_SCHEDULED',
            interviews: [
              ...prev.interviews,
              {
                id: newId,
                scheduledAt: new Date(data.scheduledAt),
                durationMinutes: 30,
                interviewerName: data.interviewerName ?? '',
                status: 'SCHEDULED',
                decision: 'PENDING',
                notes: null,
                meetingUrl: 'https://meet.google.com/gtz-kmij-tvd',
                reminder_15m_sent_at: null,
              },
            ],
          }))
        } else {
          const errorData = await response.json()
          showToast(errorData.error || 'Failed to schedule interview', 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error scheduling interview:', error)
        showToast('An error occurred while scheduling the interview', 'error')
        // Keep dialog open on error so user can see the error message
      }
    })
    setConfirmDialogOpen(true)
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents`, { credentials: 'include' })
      if (response.ok) {
        const docs = await response.json()
        setDocuments(docs)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const [pendingDocumentUpload, setPendingDocumentUpload] = useState<File[]>([])
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')

  const deleteConfirmMatch =
    deleteConfirmInput.trim().toUpperCase() === 'DELETE' ||
    deleteConfirmInput.trim() === `${rbtProfile.firstName} ${rbtProfile.lastName}` ||
    (rbtProfile.email && deleteConfirmInput.trim().toLowerCase() === rbtProfile.email.toLowerCase())

  const handleDocumentUploadClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    // Store files and show confirmation
    setPendingDocumentUpload(files)
    setConfirmMessage(`Upload ${files.length} document(s) for ${rbtProfile.firstName} ${rbtProfile.lastName}?`)
    setConfirmAction(async () => {
      try {
        setUploadingDocuments(true)
        const formData = new FormData()
        files.forEach((file) => {
          formData.append('documents', file)
          formData.append('documentTypes', 'OTHER') // Default type
        })

        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (response.ok) {
          showToast(`✅ ${files.length} document(s) uploaded successfully for ${rbtProfile.firstName} ${rbtProfile.lastName}`, 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          setPendingDocumentUpload([])
          await fetchDocuments()
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to upload documents', 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error uploading documents:', error)
        showToast('An error occurred while uploading documents', 'error')
        // Keep dialog open on error so user can see the error message
      } finally {
        setUploadingDocuments(false)
      }
    })
    setConfirmDialogOpen(true)
    // Reset the file input
    e.target.value = ''
  }

  const handleDeleteDocument = (documentId: string, fileName: string) => {
    setConfirmMessage(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(
          `/api/admin/rbts/${rbtProfile.id}/documents?documentId=${documentId}`,
          { method: 'DELETE', credentials: 'include' }
        )

        if (response.ok) {
          showToast('Document deleted successfully', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          await fetchDocuments()
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to delete document', 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error deleting document:', error)
        showToast('An error occurred while deleting the document', 'error')
        // Keep dialog open on error so user can see the error message
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents/${documentId}/download`, { credentials: 'include' })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showToast('Document downloaded successfully', 'success')
      } else {
        showToast('Failed to download document', 'error')
      }
    } catch (error) {
      console.error('Error downloading document:', error)
      showToast('An error occurred while downloading the document', 'error')
    }
  }

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSendReachOut = rbtProfile.status === 'REACH_OUT' || rbtProfile.status === 'NEW' || rbtProfile.status === 'REACH_OUT_EMAIL_SENT'
  const canScheduleInterview = rbtProfile.status === 'TO_INTERVIEW' || rbtProfile.status === 'REACH_OUT' || rbtProfile.status === 'REACH_OUT_EMAIL_SENT'
  const canHire = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canStall = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canReject = rbtProfile.status !== 'HIRED' && rbtProfile.status !== 'REJECTED'
  const isHired = rbtProfile.status === 'HIRED'

  const completedOnboardingTasks = rbtProfile.onboardingTasks.filter(t => t.isCompleted).length
  const totalOnboardingTasks = rbtProfile.onboardingTasks.length
  const incompleteTasks = rbtProfile.onboardingTasks.filter(t => !t.isCompleted)

  const statusConfig = {
    NEW: { color: 'from-gray-500 to-gray-400' },
    REACH_OUT: { color: 'from-blue-500 to-blue-400' },
    REACH_OUT_EMAIL_SENT: { color: 'from-blue-600 to-blue-500' },
    TO_INTERVIEW: { color: 'from-yellow-500 to-yellow-400' },
    INTERVIEW_SCHEDULED: { color: 'from-purple-500 to-purple-400' },
    INTERVIEW_COMPLETED: { color: 'from-indigo-500 to-indigo-400' },
    HIRED: { color: 'from-green-500 to-green-400' },
    ONBOARDING_COMPLETED: { color: 'from-emerald-500 to-emerald-400' },
    STALLED: { color: 'from-amber-500 to-amber-400' },
    REJECTED: { color: 'from-red-500 to-red-400' },
  }[rbtProfile.status] || { color: 'from-gray-500 to-gray-400' }

  return (
    <div className="space-y-6">
      <RBTProfileHeader rbtProfile={rbtProfile} />

      {/* Profile Information */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Profile Information</CardTitle>
            <Button
              variant="outline"
              onClick={() => setEditingProfile(!editingProfile)}
              className="flex items-center gap-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]"
            >
              {editingProfile ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingProfile ? (
            <EditProfileForm
              rbtProfile={rbtProfile}
              onCancel={() => setEditingProfile(false)}
              onSuccess={() => {
                setEditingProfile(false)
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Phone Number</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.phoneNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Email</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.email || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">City</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.locationCity || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">State</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.locationState || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Zip Code</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.zipCode || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Preferred Service Area</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.preferredServiceArea || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Gender</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.gender || '—'}</p>
              </div>
              {rbtProfile.ethnicity && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Ethnicity</p>
                  <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.ethnicity.replace(/_/g, ' ')}</p>
                </div>
              )}
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Address Line 1</p>
                <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.addressLine1 || '—'}</p>
              </div>
              {rbtProfile.addressLine2 && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Address Line 2</p>
                  <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.addressLine2}</p>
                </div>
              )}
              {rbtProfile.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Notes</p>
                  <p className="font-medium dark:text-[var(--text-primary)] whitespace-pre-wrap">{rbtProfile.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client assignments (Scheduling demo) */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
              Client assignments
            </CardTitle>
            <Badge
              variant="outline"
              className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)] dark:border-[var(--orange-border)]"
            >
              Scheduling demo
            </Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Clients assigned with specific days and hours will appear here.
          </p>
        </CardHeader>
        <CardContent>
          {clientAssignmentsLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assignments…
            </div>
          ) : clientAssignments.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              No client assignments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {clientAssignments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
                        {a.clientName}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {formatDays(a.daysOfWeek)}
                        {(a.timeStart || a.timeEnd) ? (
                          <span className="ml-2">
                            {a.timeStart ?? '—'}–{a.timeEnd ?? '—'}
                          </span>
                        ) : null}
                      </p>
                      {a.notes ? (
                        <p className="mt-2 text-sm text-gray-700 dark:text-[var(--text-secondary)] whitespace-pre-wrap">
                          {a.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      <Link
                        href="/admin/scheduling-beta"
                        className="text-sm font-semibold text-orange-600 hover:underline dark:text-[var(--orange-primary)]"
                      >
                        View scheduling demo →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Application Info */}
      {rbtProfile.source === 'PUBLIC_APPLICATION' && (
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Application Information</CardTitle>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)] dark:border-[var(--orange-border)]">
                Applied Online
              </Badge>
            </div>
            {rbtProfile.submittedAt && (
              <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
                Submitted: {formatDateTime(rbtProfile.submittedAt)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resume Download */}
            {rbtProfile.resumeUrl && (
              <div className="flex items-center justify-between p-4 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border-2 border-gray-200 dark:border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary dark:text-[var(--orange-primary)]" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">Resume</p>
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                      {rbtProfile.resumeFileName || 'Resume file'}
                      {rbtProfile.resumeSize && ` (${(rbtProfile.resumeSize / 1024 / 1024).toFixed(2)} MB)`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/resume`, { credentials: 'include' })
                      if (response.ok) {
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = rbtProfile.resumeFileName || 'resume.pdf'
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                        showToast('Resume downloaded successfully', 'success')
                      } else {
                        showToast('Failed to download resume', 'error')
                      }
                    } catch (error) {
                      console.error('Error downloading resume:', error)
                      showToast('An error occurred while downloading the resume', 'error')
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download Resume
                </Button>
              </div>
            )}

            {/* 40-Hour RBT Course */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">40-Hour RBT Course Completed</p>
              <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{rbtProfile.fortyHourCourseCompleted ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Years of Experience */}
            {(rbtProfile.experienceYearsDisplay != null && rbtProfile.experienceYearsDisplay !== '') || rbtProfile.experienceYears !== null ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Years of Experience</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                    {rbtProfile.experienceYearsDisplay != null && rbtProfile.experienceYearsDisplay !== ''
                      ? rbtProfile.experienceYearsDisplay.includes('year') ? rbtProfile.experienceYearsDisplay : `${rbtProfile.experienceYearsDisplay} years`
                      : rbtProfile.experienceYears != null ? `${rbtProfile.experienceYears} years` : '—'}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Preferred Client Age Groups */}
            {rbtProfile.preferredAgeGroupsJson && Array.isArray(rbtProfile.preferredAgeGroupsJson) && (rbtProfile.preferredAgeGroupsJson as string[]).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Preferred Client Age Groups</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{(rbtProfile.preferredAgeGroupsJson as string[]).join(', ')}</p>
                </div>
              </div>
            )}

            {/* Availability: single box, one Preferred Weekly Hours, time range from availabilityJson */}
            {rbtProfile.availabilityJson && (() => {
              const av = rbtProfile.availabilityJson as { weekday?: Record<string, boolean>; weekend?: Record<string, boolean>; earliestStartTime?: string; latestEndTime?: string } | null
              if (!av) return null
              return (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Availability</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4 space-y-2">
                  {av.weekday && Object.keys(av.weekday).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Weekdays (after 2PM):</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {Object.keys(av.weekday)
                          .filter((day: string) => av.weekday?.[day])
                          .sort()
                          .join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  {av.weekend && Object.keys(av.weekend).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Weekends:</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {Object.keys(av.weekend)
                          .filter((day: string) => av.weekend?.[day])
                          .sort()
                          .join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  {rbtProfile.preferredHoursRange && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Preferred Weekly Hours:</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{rbtProfile.preferredHoursRange}</p>
                    </div>
                  )}
                  {(av.earliestStartTime || av.latestEndTime) && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Time Range:</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {av.earliestStartTime || '—'} – {av.latestEndTime || '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              )
            })()}

            {/* Languages */}
            {rbtProfile.languagesJson && (rbtProfile.languagesJson as any).languages && (rbtProfile.languagesJson as any).languages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Languages Spoken</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                    {[...((rbtProfile.languagesJson as any).languages || []), (rbtProfile.languagesJson as any).otherLanguage].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Transportation */}
            {rbtProfile.transportation !== null && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Reliable Transportation</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{rbtProfile.transportation ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {/* Compliance */}
            {(rbtProfile.authorizedToWork !== null || rbtProfile.canPassBackgroundCheck !== null || rbtProfile.cprFirstAidCertified) && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Compliance & Eligibility</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4 space-y-2">
                  {rbtProfile.authorizedToWork !== null && (
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Authorized to work in US: {rbtProfile.authorizedToWork ? 'Yes' : 'No'}</p>
                  )}
                  {rbtProfile.canPassBackgroundCheck !== null && (
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Can pass background check: {rbtProfile.canPassBackgroundCheck ? 'Yes' : 'No'}</p>
                  )}
                  {rbtProfile.cprFirstAidCertified && (
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">CPR/First Aid certified: {rbtProfile.cprFirstAidCertified === 'true' ? 'Yes' : rbtProfile.cprFirstAidCertified === 'false' ? 'No' : rbtProfile.cprFirstAidCertified}</p>
                  )}
                </div>
              </div>
            )}

            {/* Additional Notes */}
            {rbtProfile.notes && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Additional Notes</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4">
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] whitespace-pre-wrap">{rbtProfile.notes}</p>
                </div>
              </div>
            )}

            {/* Government-issued ID from documents */}
            {documents.filter((d) => d.documentType === 'GOVERNMENT_ID').length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Government-issued ID</p>
                <div className="space-y-2">
                  {documents.filter((d) => d.documentType === 'GOVERNMENT_ID').map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border-2 border-gray-200 dark:border-[var(--border-subtle)]">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary dark:text-[var(--orange-primary)]" />
                        <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">{doc.fileName}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc.id, doc.fileName)} className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RBT Certificate & CPR Card from documents */}
            {documents.filter((d) => d.documentType === 'RBT_CERTIFICATE').length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">RBT Certificate</p>
                <div className="space-y-2">
                  {documents.filter((d) => d.documentType === 'RBT_CERTIFICATE').map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)]">
                      <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">{doc.fileName}</span>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc.id, doc.fileName)} className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {documents.filter((d) => d.documentType === 'CPR_CARD').length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">CPR/First Aid Card</p>
                <div className="space-y-2">
                  {documents.filter((d) => d.documentType === 'CPR_CARD').map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)]">
                      <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">{doc.fileName}</span>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc.id, doc.fileName)} className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Management */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Status Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusManager
            rbtId={rbtProfile.id}
            initialStatus={rbtProfile.status as 'NEW' | 'REACH_OUT' | 'REACH_OUT_EMAIL_SENT' | 'TO_INTERVIEW' | 'INTERVIEW_SCHEDULED' | 'INTERVIEW_COMPLETED' | 'HIRED' | 'ONBOARDING_COMPLETED' | 'STALLED' | 'REJECTED'}
            onStatusChange={(newStatus) => {
              setRbtProfile({ ...rbtProfile, status: newStatus })
            }}
          />

          {rbtProfile.status === 'INTERVIEW_SCHEDULED' && (
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
              To hire: mark the interview as completed (after the interview date) in Interview History below or from the Interviews page; then Mark as Hired will appear here.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canSendReachOut && (
              <Button 
                onClick={handleSendReachOutEmail} 
                disabled={loading || !rbtProfile.email}
                className="dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0"
              >
                Send Reach-Out Email
              </Button>
            )}
            {canScheduleInterview && (
              <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={loading}
                    className="dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)] border-0"
                  >
                    Schedule Interview
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Interview</DialogTitle>
                    <DialogDescription>
                      Schedule an interview for {rbtProfile.firstName} {rbtProfile.lastName}
                    </DialogDescription>
                  </DialogHeader>
                  <InterviewScheduleForm
                    rbtProfileId={rbtProfile.id}
                    onSubmit={handleScheduleInterview}
                    onCancel={() => setInterviewDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
            {rbtProfile.status === 'INTERVIEW_SCHEDULED' && (
              <Button
                disabled
                title="Mark the interview as completed first"
                variant="outline"
                className="dark:border-[var(--border-subtle)] dark:text-[var(--text-disabled)]"
              >
                Hire Candidate
              </Button>
            )}
            {canHire && (
              <Button 
                onClick={handleHire} 
                disabled={loading} 
                className="dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)] border-0"
              >
                Mark as Hired
              </Button>
            )}
            {canStall && (
              <Button 
                onClick={handleStall} 
                disabled={loading}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-[var(--border-subtle)] dark:text-[var(--status-warning-text)] dark:hover:bg-[var(--status-warning-bg)] rounded-xl px-6"
              >
                Mark as Stalled
              </Button>
            )}
            {canReject && (
              <Button 
                onClick={handleReject} 
                disabled={loading || !rbtProfile.email}
                variant="destructive"
                className="rounded-xl px-6"
              >
                Reject Candidate
              </Button>
            )}
            {isHired && (
              <Button 
                onClick={handleSendMissingOnboardingEmail} 
                disabled={loading || !rbtProfile.email || incompleteTasks.length === 0}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 dark:border-[var(--border-subtle)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--bg-elevated-hover)] rounded-xl px-6"
                title={incompleteTasks.length === 0 ? 'All onboarding tasks are complete' : 'Send reminder about missing onboarding items'}
              >
                Send Missing Onboarding Reminder
              </Button>
            )}
          </div>
          
          {/* Delete RBT Section - Always Visible */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[var(--border-subtle)]">
            <Button 
              onClick={handleDeleteRBT} 
              disabled={loading}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-[var(--status-rejected-border)] dark:text-[var(--status-rejected-text)] dark:hover:bg-[var(--status-rejected-bg)] rounded-xl px-6 w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete RBT
            </Button>
            <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-2">This action cannot be undone. All RBT data will be permanently deleted.</p>
          </div>
        </CardContent>
      </Card>

      <RBTProfileInterviews
        rbtProfile={rbtProfile}
        loading={loading}
        onCompleteInterview={handleCompleteInterview}
        onHire={handleHire}
        onReject={handleReject}
      />

      {/* Admin Onboarding Override */}
      {isHired && (incompleteTasks.length > 0 || !rbtProfile.scheduleCompleted) && (
        <AdminOnboardingOverride
          rbtProfileId={rbtProfile.id}
          rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
          onboardingTasks={rbtProfile.onboardingTasks}
          scheduleCompleted={rbtProfile.scheduleCompleted || false}
        />
      )}

      <RBTProfileOnboarding rbtProfile={rbtProfile} showToast={showToast} />

      {/* RBT Schedule */}
      {isHired && (
        <RBTScheduleView
          rbtProfileId={rbtProfile.id}
          rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
        />
      )}

      {/* Interview Notes Section */}
      {rbtProfile.interviews.some((i) => i.interviewNotes) && (
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Interview Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rbtProfile.interviews
              .filter((i) => i.interviewNotes)
              .map((interview) => (
                <div
                  key={interview.id}
                  className="p-4 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] space-y-3"
                >
                  <div className="flex items-center justify-between border-b dark:border-[var(--border-subtle)] pb-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                        Interview on {formatDateTime(interview.scheduledAt)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
                        Interviewer: {interview.interviewerName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-0.5">
                        15m reminder:{' '}
                        {interview.reminder_15m_sent_at
                          ? `Sent at ${formatDateTime(interview.reminder_15m_sent_at)}`
                          : 'Not sent yet'}
                      </p>
                    </div>
                    <Badge variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                      {interview.status}
                    </Badge>
                  </div>
                  {interview.interviewNotes && (
                    <div className="space-y-3 text-sm">
                      {(interview.interviewNotes.fullName || interview.interviewNotes.phoneNumber || interview.interviewNotes.email || interview.interviewNotes.currentAddress) && (
                        <div className="space-y-1">
                          <p className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Basic Information</p>
                          {interview.interviewNotes.fullName && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Name: </span>{interview.interviewNotes.fullName}</p>}
                          {interview.interviewNotes.phoneNumber && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Phone: </span>{interview.interviewNotes.phoneNumber}</p>}
                          {interview.interviewNotes.email && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Email: </span>{interview.interviewNotes.email}</p>}
                          {interview.interviewNotes.currentAddress && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">City / location: </span>{interview.interviewNotes.currentAddress}</p>}
                        </div>
                      )}
                      {interview.interviewNotes.greetingAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">1. Greeting &amp; Introduction: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.greetingAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.basicInfoAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">2. Basic info notes: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.basicInfoAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.experienceAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">3. Experience &amp; Background: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.experienceAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.heardAboutAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">4. How they heard about us: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.heardAboutAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.abaPlatformsAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">5. ABA platforms: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.abaPlatformsAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.communicationAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">6. Communication: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.communicationAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.availabilityAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">7. Availability: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.availabilityAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.payExpectationsAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">8. Pay expectations: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.payExpectationsAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.previousCompanyAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">9. Previous company / why switching: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.previousCompanyAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.expectationsAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">10. Company expectations: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.expectationsAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.closingNotes && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">11. Closing notes: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.closingNotes}</p>
                        </div>
                      )}
                      <div className="pt-2 border-t dark:border-[var(--border-subtle)]">
                        <InterviewNotesButton
                          interviewId={interview.id}
                          rbtProfileId={rbtProfile.id}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <RBTProfileAuditLog rbtProfileId={rbtProfile.id} rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`} />

      <RBTProfileDocuments
        rbtProfileId={rbtProfile.id}
        rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
        documents={documents}
        onboardingCompletions={rbtProfile.onboardingCompletions}
        uploadingDocuments={uploadingDocuments}
        uploadDisabled={confirmDialogOpen}
        onUploadClick={handleDocumentUploadClick}
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
                  ? { ...c, status: 'NOT_STARTED' as const, signedPdfUrl: null, completedAt: null }
                  : c
              ) ?? [],
          }))
          showToast('Re-upload requested. RBT will receive an email.', 'success')
        }}
      />

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !confirmLoading) {
            setConfirmDialogOpen(false)
            setConfirmAction(null)
            setDeleteStep(0)
            setDeleteConfirmInput('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteStep === 2 ? 'Confirm permanent delete' : 'Confirm Action'}</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
          </DialogHeader>
          {deleteStep === 2 && (
            <div className="space-y-3 py-2">
              <Label htmlFor="delete-confirm">Type DELETE or the candidate&apos;s full name or email</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false)
                setConfirmAction(null)
                setConfirmLoading(false)
                setDeleteStep(0)
                setDeleteConfirmInput('')
              }}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            {deleteStep === 2 ? (
              <Button
                onClick={handleDeletePermanently}
                disabled={!deleteConfirmMatch || confirmLoading}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {confirmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete permanently'}
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (confirmAction) {
                    setConfirmLoading(true)
                    try {
                      await confirmAction()
                      setConfirmLoading(false)
                    } catch {
                      setConfirmLoading(false)
                    }
                  }
                }}
                disabled={confirmLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {confirmLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : deleteStep === 1 ? (
                  'Continue'
                ) : (
                  'Confirm'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

