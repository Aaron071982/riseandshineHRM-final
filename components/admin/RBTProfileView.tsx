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
import AuditLog from './AuditLog'
import { trackButtonClick } from '@/lib/activity-tracker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface RBTProfile {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email: string | null
  locationCity: string | null
  locationState: string | null
  zipCode: string | null
  addressLine1: string | null
  addressLine2: string | null
  preferredServiceArea: string | null
  notes: string | null
  gender: string | null
  ethnicity: string | null
  fortyHourCourseCompleted: boolean
  status: string
  scheduleCompleted?: boolean
  source: string | null
  submittedAt: Date | null
  resumeUrl: string | null
  resumeFileName: string | null
  resumeMimeType: string | null
  resumeSize: number | null
  availabilityJson: any
  languagesJson: any
  experienceYears: number | null
  experienceYearsDisplay: string | null
  preferredAgeGroupsJson: any
  authorizedToWork: boolean | null
  canPassBackgroundCheck: boolean | null
  cprFirstAidCertified: string | null
  transportation: boolean | null
  preferredHoursRange: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    role: string
    isActive: boolean
  }
  interviews: Array<{
    id: string
    scheduledAt: Date
    durationMinutes: number
    interviewerName: string
    status: string
    decision: string
    notes: string | null
    meetingUrl: string | null
    reminder_15m_sent_at: Date | null
    interviewNotes?: {
      id: string
      greetingAnswer: string | null
      basicInfoAnswer: string | null
      experienceAnswer: string | null
      heardAboutAnswer: string | null
      abaPlatformsAnswer: string | null
      communicationAnswer: string | null
      availabilityAnswer: string | null
      payExpectationsAnswer: string | null
      previousCompanyAnswer: string | null
      expectationsAnswer: string | null
      closingNotes: string | null
      fullName: string | null
      birthdate: string | null
      currentAddress: string | null
      phoneNumber: string | null
      createdAt: Date
      updatedAt: Date
    } | null
  }>
  onboardingTasks: Array<{
    id: string
    taskType: string
    title: string
    description: string | null
    isCompleted: boolean
    completedAt: Date | null
    uploadUrl: string | null
    documentDownloadUrl: string | null
    sortOrder: number
  }>
  documents?: Array<{
    id: string
    fileName: string
    fileType: string
    documentType: string | null
    uploadedAt: Date
  }>
  onboardingCompletions?: Array<{
    id: string
    documentId: string
    status: string
    completedAt: Date | null
    acknowledgmentJson?: any
    document: {
      id: string
      title: string
      type: string
    }
  }>
}

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
          router.refresh()
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
          // Immediately update status to HIRED in UI
          setRbtProfile({ ...rbtProfile, status: 'HIRED' })
          showToast('Candidate hired successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          router.refresh()
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
          router.refresh()
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
          router.refresh()
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
        router.refresh()
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
          router.refresh()
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
          router.refresh()
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
          showToast('Interview scheduled successfully!', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          setPendingInterviewData(null)
          router.refresh()
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
          router.refresh()
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
          router.refresh()
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
    STALLED: { color: 'from-amber-500 to-amber-400' },
    REJECTED: { color: 'from-red-500 to-red-400' },
  }[rbtProfile.status] || { color: 'from-gray-500 to-gray-400' }

  return (
    <div className="space-y-6">
      {/* Header (simple, like RBTs & Candidates) */}
      <div className="pb-6 border-b dark:border-[var(--border-subtle)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-2">
            {rbtProfile.firstName} {rbtProfile.lastName}
          </h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">RBT Profile & Hiring Pipeline</p>
        </div>
        <Badge className="bg-gray-100 dark:bg-[var(--bg-elevated)] text-gray-800 dark:text-[var(--text-primary)] border dark:border-[var(--border-subtle)] px-4 py-2 text-base font-semibold">
          {rbtProfile.status.replace(/_/g, ' ')}
        </Badge>
      </div>

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
                router.refresh()
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
              {rbtProfile.gender && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Gender</p>
                  <p className="font-medium dark:text-[var(--text-primary)]">{rbtProfile.gender}</p>
                </div>
              )}
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
            {rbtProfile.availabilityJson && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Availability</p>
                <div className="bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] p-4 space-y-2">
                  {rbtProfile.availabilityJson?.weekday && Object.keys(rbtProfile.availabilityJson.weekday).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Weekdays (after 2PM):</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {Object.keys(rbtProfile.availabilityJson.weekday)
                          .filter((day: string) => rbtProfile.availabilityJson?.weekday?.[day])
                          .sort()
                          .join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  {rbtProfile.availabilityJson?.weekend && Object.keys(rbtProfile.availabilityJson.weekend).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Weekends:</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {Object.keys(rbtProfile.availabilityJson.weekend)
                          .filter((day: string) => rbtProfile.availabilityJson?.weekend?.[day])
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
                  {((rbtProfile.availabilityJson as any)?.earliestStartTime || (rbtProfile.availabilityJson as any)?.latestEndTime) && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Time Range:</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {(rbtProfile.availabilityJson as any).earliestStartTime || '—'} – {(rbtProfile.availabilityJson as any).latestEndTime || '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
            initialStatus={rbtProfile.status as 'NEW' | 'REACH_OUT' | 'REACH_OUT_EMAIL_SENT' | 'TO_INTERVIEW' | 'INTERVIEW_SCHEDULED' | 'INTERVIEW_COMPLETED' | 'HIRED' | 'REJECTED'}
            onStatusChange={(newStatus) => {
              setRbtProfile({ ...rbtProfile, status: newStatus })
              router.refresh()
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

      {/* Interviews */}
      {rbtProfile.interviews.length > 0 && (
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Interview History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rbtProfile.interviews.map((interview) => {
                const isScheduled = interview.status === 'SCHEDULED'
                const isCompleted = interview.status === 'COMPLETED'
                const isPast = new Date(interview.scheduledAt) < new Date()
                const canMarkCompleted = isScheduled && isPast
                const canHireOrReject = isCompleted && rbtProfile.status === 'INTERVIEW_COMPLETED'

                return (
                  <div key={interview.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium dark:text-[var(--text-primary)]">
                          {formatDateTime(interview.scheduledAt)} ({interview.durationMinutes} min)
                        </p>
                        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                          Interviewer: {interview.interviewerName}
                        </p>
                        {interview.notes && (
                          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-2">{interview.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.status}</Badge>
                          <Badge variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.decision}</Badge>
                        </div>
                        {canMarkCompleted && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteInterview(interview.id)}
                            disabled={loading}
                            className="dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)] border-0"
                          >
                            Mark as Completed
                          </Button>
                        )}
                        {canHireOrReject && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={handleHire}
                              disabled={loading}
                              className="dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)] border-0"
                            >
                              Hire
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleReject}
                              disabled={loading}
                              variant="destructive"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Onboarding Override */}
      {isHired && (incompleteTasks.length > 0 || !rbtProfile.scheduleCompleted) && (
        <AdminOnboardingOverride
          rbtProfileId={rbtProfile.id}
          rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
          onboardingTasks={rbtProfile.onboardingTasks}
          scheduleCompleted={rbtProfile.scheduleCompleted || false}
        />
      )}

      {/* Onboarding Progress */}
      {isHired && (
        <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium dark:text-[var(--text-tertiary)]">Overall Progress</span>
                  <span className="font-bold dark:text-[var(--text-primary)]">
                    {completedOnboardingTasks} / {totalOnboardingTasks} tasks completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[var(--bg-input)] rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      (completedOnboardingTasks / totalOnboardingTasks) * 100 === 100
                        ? 'bg-green-500'
                        : 'bg-orange-600'
                    }`}
                    style={{
                      width: `${(completedOnboardingTasks / totalOnboardingTasks) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-sm text-gray-600 dark:text-[var(--text-disabled)]">
                  {Math.round((completedOnboardingTasks / totalOnboardingTasks) * 100)}% complete
                </div>
              </div>

              {/* Tasks List - hide "Download Onboarding Documents Folder" task */}
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">Tasks</h3>
                {rbtProfile.onboardingTasks
                  .filter(
                    (task) =>
                      !task.title?.toLowerCase().includes('download onboarding documents folder') &&
                      !task.documentDownloadUrl?.includes('onboarding-package')
                  )
                  .map((task) => (
                  <div key={task.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {task.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-[var(--status-hired-text)]" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                          )}
                          <h4 className="font-medium dark:text-[var(--text-primary)]">{task.title}</h4>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1 ml-7">{task.description}</p>
                        )}
                        {task.isCompleted && task.completedAt && (
                          <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1 ml-7">
                            Completed: {formatDateTime(task.completedAt)}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={
                          task.isCompleted
                            ? 'bg-green-100 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]'
                            : 'bg-gray-100 text-gray-600 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-tertiary)]'
                        }
                      >
                        {task.isCompleted ? 'Completed' : 'Pending'}
                      </Badge>
                    </div>

                    {/* Show Signature if available */}
                    {task.taskType === 'SIGNATURE' && task.isCompleted && task.uploadUrl && (
                      <div className="mt-4 ml-7 p-4 bg-gray-50 dark:bg-[var(--bg-input)] rounded-lg">
                        <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">Digital Signature:</p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- signature URL is dynamic/signed */}
                        <img
                          src={task.uploadUrl}
                          alt="Signature"
                          className="max-w-md border border-gray-300 dark:border-[var(--border-subtle)] rounded bg-white dark:bg-[var(--bg-elevated)] p-2"
                        />
                      </div>
                    )}

                    {/* Show Package Upload confirmation (no download option) */}
                    {task.taskType === 'PACKAGE_UPLOAD' && task.isCompleted && task.uploadUrl && (
                      <div className="mt-4 ml-7 p-4 bg-gray-50 dark:bg-[var(--bg-input)] rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-green-600 dark:text-[var(--status-hired-text)]" />
                          <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Uploaded Package:</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
                          Package uploaded and sent to administrator email
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Documents - always visible for hired RBTs */}
      {isHired && (
        <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Documents</CardTitle>
            <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Acknowledgment and fillable PDF completions</p>
          </CardHeader>
          <CardContent>
            {!rbtProfile.onboardingCompletions || rbtProfile.onboardingCompletions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
                <p className="text-sm">No onboarding documents completed yet</p>
              </div>
            ) : (
            <div className="space-y-4">
              {rbtProfile.onboardingCompletions.map((completion) => (
                <div key={completion.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {completion.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-[var(--status-hired-text)]" />
                        ) : completion.status === 'IN_PROGRESS' ? (
                          <XCircle className="w-5 h-5 text-yellow-500 dark:text-[var(--status-warning-text)]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                        )}
                        <h4 className="font-medium dark:text-[var(--text-primary)]">{completion.document.title}</h4>
                        <Badge variant="outline" className="ml-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                          {completion.document.type === 'ACKNOWLEDGMENT' ? 'Acknowledgment' : 'Fillable PDF'}
                        </Badge>
                      </div>
                      {completion.completedAt && (
                        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1 ml-7">
                          Completed: {formatDateTime(completion.completedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          completion.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]'
                            : completion.status === 'IN_PROGRESS'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-[var(--status-warning-bg)] dark:text-[var(--status-warning-text)]'
                            : 'bg-gray-100 text-gray-600 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-tertiary)]'
                        }
                      >
                        {completion.status === 'COMPLETED' ? 'Completed' : completion.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                      </Badge>
                      {completion.status === 'COMPLETED' && (
                        <>
                          {completion.document.type === 'FILLABLE_PDF' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]"
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/admin/onboarding/completions/${rbtProfile.id}/${completion.id}/download`
                                  )
                                  if (response.ok) {
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `${completion.document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                    window.URL.revokeObjectURL(url)
                                    showToast('PDF downloaded successfully', 'success')
                                  } else {
                                    const error = await response.json()
                                    showToast(error.error || 'Failed to download PDF', 'error')
                                  }
                                } catch (error) {
                                  console.error('Error downloading PDF:', error)
                                  showToast('An error occurred while downloading the PDF', 'error')
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </Button>
                          ) : (
                            // For acknowledgments, show signature inline instead of download
                            completion.acknowledgmentJson && (
                              <div className="flex flex-col gap-2">
                                {(completion.acknowledgmentJson as any)?.signatureData && (
                                  <div className="border dark:border-[var(--border-subtle)] rounded p-2 bg-gray-50 dark:bg-[var(--bg-input)]">
                                    <p className="text-xs text-gray-600 dark:text-[var(--text-tertiary)] mb-1">Signature:</p>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL from signature pad */}
                                    <img
                                      src={(completion.acknowledgmentJson as any).signatureData}
                                      alt="Signature"
                                      className="max-w-[200px] max-h-[80px] border rounded"
                                    />
                                  </div>
                                )}
                                {(completion.acknowledgmentJson as any)?.typedName && (
                                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                                    Signed: {(completion.acknowledgmentJson as any).typedName}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      )}

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
                      {interview.interviewNotes.fullName && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Full Name: </span>
                          <span className="text-gray-600 dark:text-[var(--text-tertiary)]">{interview.interviewNotes.fullName}</span>
                        </div>
                      )}
                      {interview.interviewNotes.phoneNumber && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Phone: </span>
                          <span className="text-gray-600 dark:text-[var(--text-tertiary)]">{interview.interviewNotes.phoneNumber}</span>
                        </div>
                      )}
                      {interview.interviewNotes.experienceAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Experience: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.experienceAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.availabilityAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Availability: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.availabilityAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.payExpectationsAnswer && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Pay Expectations: </span>
                          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{interview.interviewNotes.payExpectationsAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.closingNotes && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Closing Notes: </span>
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

      {/* Audit Log Section */}
      <AuditLog
        rbtProfileId={rbtProfile.id}
        rbtName={`${rbtProfile.firstName} ${rbtProfile.lastName}`}
      />

      {/* Documents Section */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Section */}
          <div className="space-y-3">
            <label
              htmlFor="document-upload"
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-[var(--border-subtle)] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)] transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
              <span className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
                {uploadingDocuments ? 'Uploading...' : 'Upload Documents'}
              </span>
            </label>
            <input
              id="document-upload"
              type="file"
              multiple
              onChange={handleDocumentUploadClick}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={uploadingDocuments || confirmDialogOpen}
            />
            <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
              Upload resumes, certifications, or other relevant documents (PDF, DOC, DOCX, JPG, PNG)
            </p>
          </div>

          {/* Documents List */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-[var(--bg-elevated)] rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] hover:shadow-md dark:hover:bg-[var(--bg-elevated-hover)] transition-shadow"
                >
                  <FileText className="w-5 h-5 text-orange-500 dark:text-[var(--orange-primary)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                        {doc.documentType || 'OTHER'}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:border-[var(--border-subtle)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-[var(--status-rejected-text)] dark:hover:bg-[var(--status-rejected-bg)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

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

// Helper function to convert NY time to UTC ISO string
function nyTimeToUTC(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  
  // Create a test date at noon UTC on the target date to determine timezone offset
  // (NY uses EST UTC-5 in winter, EDT UTC-4 in summer due to DST)
  const testDateUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  
  // Format in NY timezone to see what 12:00 UTC becomes in NY
  const nyFormatted = testDateUTC.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  // Parse to get the hour in NY timezone when UTC is 12:00
  const nyHour = parseInt(nyFormatted.split(', ')[1].split(':')[0], 10)
  
  // Calculate offset: if UTC 12:00 = NY 07:00, then offset is -5 (NY is 5 hours behind UTC)
  // So to convert NY time to UTC, we ADD 5 hours
  // offsetHours = 12 (UTC) - 7 (NY) = 5
  const offsetHours = 12 - nyHour
  
  // Create UTC date: if input is NY 12:30 and offset is +5, then UTC is 17:30
  const utcDate = new Date(Date.UTC(y, m - 1, d, h + offsetHours, min, 0))
  return utcDate.toISOString()
}

function InterviewScheduleForm({
  rbtProfileId,
  onSubmit,
  onCancel,
}: {
  rbtProfileId: string
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [interviewerEmail, setInterviewerEmail] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const dateStr = formData.get('date') as string
    const timeStr = formData.get('time') as string
    
    // Treat input as New York time and convert to UTC for storage
    onSubmit({
      scheduledAt: nyTimeToUTC(dateStr, timeStr),
      durationMinutes: 30,
      interviewerName: interviewerEmail, // Use the selected email
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="time">Time</Label>
        <Input id="time" name="time" type="time" step="1800" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input id="duration" name="duration" type="number" defaultValue={30} readOnly className="bg-gray-50" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interviewerEmail">Interviewer Email</Label>
        <Select value={interviewerEmail} onValueChange={setInterviewerEmail} required>
          <SelectTrigger>
            <SelectValue placeholder="Select interviewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aaronsiam21@gmail.com">aaronsiam21@gmail.com</SelectItem>
            <SelectItem value="kazi@siyam.nyc">kazi@siyam.nyc</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Schedule Interview</Button>
      </DialogFooter>
    </form>
  )
}

function EditProfileForm({
  rbtProfile,
  onCancel,
  onSuccess,
}: {
  rbtProfile: RBTProfile
  onCancel: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phoneNumber: formData.get('phoneNumber'),
      email: formData.get('email') || null,
      locationCity: formData.get('locationCity') || null,
      locationState: formData.get('locationState') || null,
      zipCode: formData.get('zipCode') || null,
      addressLine1: formData.get('addressLine1') || null,
      addressLine2: formData.get('addressLine2') || null,
      preferredServiceArea: formData.get('preferredServiceArea') || null,
      notes: formData.get('notes') || null,
    }

    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update profile')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="edit-firstName">First Name *</Label>
          <Input
            id="edit-firstName"
            name="firstName"
            defaultValue={rbtProfile.firstName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-lastName">Last Name *</Label>
          <Input
            id="edit-lastName"
            name="lastName"
            defaultValue={rbtProfile.lastName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-phoneNumber">Phone Number *</Label>
          <Input
            id="edit-phoneNumber"
            name="phoneNumber"
            type="tel"
            defaultValue={rbtProfile.phoneNumber}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            name="email"
            type="email"
            defaultValue={rbtProfile.email || ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-locationCity">City</Label>
          <Input
            id="edit-locationCity"
            name="locationCity"
            defaultValue={rbtProfile.locationCity || ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-locationState">State</Label>
          <Input
            id="edit-locationState"
            name="locationState"
            maxLength={2}
            placeholder="NY"
            defaultValue={rbtProfile.locationState || ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-zipCode">Zip Code *</Label>
          <Input
            id="edit-zipCode"
            name="zipCode"
            defaultValue={rbtProfile.zipCode || ''}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-preferredServiceArea">Preferred Service Area</Label>
          <Input
            id="edit-preferredServiceArea"
            name="preferredServiceArea"
            defaultValue={rbtProfile.preferredServiceArea || ''}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-addressLine1">Address Line 1 *</Label>
          <Input
            id="edit-addressLine1"
            name="addressLine1"
            defaultValue={rbtProfile.addressLine1 || ''}
            required
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-addressLine2">Address Line 2</Label>
          <Input
            id="edit-addressLine2"
            name="addressLine2"
            defaultValue={rbtProfile.addressLine2 || ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-gender">Gender</Label>
          <Select name="gender" defaultValue={rbtProfile.gender || 'Male'}>
            <SelectTrigger id="edit-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-fortyHourCourseCompleted">40-Hour RBT Course Already Completed</Label>
          <Select name="fortyHourCourseCompleted" defaultValue={rbtProfile.fortyHourCourseCompleted ? 'true' : 'false'}>
            <SelectTrigger id="edit-fortyHourCourseCompleted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            If &quot;No&quot;, the RBT will need to complete the 40-hour course and upload certificate during onboarding.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-notes">Notes</Label>
          <textarea
            id="edit-notes"
            name="notes"
            rows={4}
            defaultValue={rbtProfile.notes || ''}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

