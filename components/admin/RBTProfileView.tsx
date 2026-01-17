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
    setConfirmMessage(`Are you sure you want to delete ${rbtProfile.firstName} ${rbtProfile.lastName}? This will permanently delete the RBT profile and all associated data. This action cannot be undone.`)
    setConfirmAction(async () => {
      try {
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/delete`, {
          method: 'DELETE',
        })

        if (response.ok) {
          showToast('RBT deleted successfully', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          // Force refresh and redirect
          router.refresh()
          setTimeout(() => {
            router.push('/admin/rbts')
          }, 100)
        } else {
          const errorData = await response.json()
          showToast(`Failed to delete RBT: ${errorData.error || 'Unknown error'}`, 'error')
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error deleting RBT:', error)
        showToast('An error occurred while deleting the RBT. Please try again.', 'error')
        // Keep dialog open on error so user can see the error message
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
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents`)
      if (response.ok) {
        const docs = await response.json()
        setDocuments(docs)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const [pendingDocumentUpload, setPendingDocumentUpload] = useState<File[]>([])

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
          { method: 'DELETE' }
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
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/documents/${documentId}/download`)
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
    REJECTED: { color: 'from-red-500 to-red-400' },
  }[rbtProfile.status] || { color: 'from-gray-500 to-gray-400' }

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${statusConfig.color} p-8 shadow-lg`}>
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {rbtProfile.firstName} {rbtProfile.lastName}
            </h1>
            <p className="text-white/90 text-lg">RBT Profile & Hiring Pipeline</p>
          </div>
          <Badge className="bg-white text-gray-900 border-0 px-4 py-2 text-base font-semibold">
            {rbtProfile.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {/* Profile Information */}
      <Card className="border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-900">Profile Information</CardTitle>
            <Button
              variant="outline"
              onClick={() => setEditingProfile(!editingProfile)}
              className="flex items-center gap-2"
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
                <p className="text-sm text-gray-600">Phone Number</p>
                <p className="font-medium">{rbtProfile.phoneNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{rbtProfile.email || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">City</p>
                <p className="font-medium">{rbtProfile.locationCity || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">State</p>
                <p className="font-medium">{rbtProfile.locationState || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Zip Code</p>
                <p className="font-medium">{rbtProfile.zipCode || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Preferred Service Area</p>
                <p className="font-medium">{rbtProfile.preferredServiceArea || '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Address Line 1</p>
                <p className="font-medium">{rbtProfile.addressLine1 || '—'}</p>
              </div>
              {rbtProfile.addressLine2 && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Address Line 2</p>
                  <p className="font-medium">{rbtProfile.addressLine2}</p>
                </div>
              )}
              {rbtProfile.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{rbtProfile.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Application Info */}
      {rbtProfile.source === 'PUBLIC_APPLICATION' && (
        <Card className="border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-gray-900">Application Information</CardTitle>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Applied Online
              </Badge>
            </div>
            {rbtProfile.submittedAt && (
              <p className="text-sm text-gray-600 mt-1">
                Submitted: {formatDateTime(rbtProfile.submittedAt)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resume Download */}
            {rbtProfile.resumeUrl && (
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-gray-900">Resume</p>
                    <p className="text-sm text-gray-600">
                      {rbtProfile.resumeFileName || 'Resume file'}
                      {rbtProfile.resumeSize && ` (${(rbtProfile.resumeSize / 1024 / 1024).toFixed(2)} MB)`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/resume`)
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
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Resume
                </Button>
              </div>
            )}

            {/* Availability */}
            {rbtProfile.availabilityJson && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Availability</p>
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  {rbtProfile.availabilityJson?.weekday && Object.keys(rbtProfile.availabilityJson.weekday).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Weekdays (after 2PM):</p>
                      <p className="text-sm text-gray-600">
                        {Object.keys(rbtProfile.availabilityJson.weekday)
                          .filter((day: string) => rbtProfile.availabilityJson?.weekday?.[day])
                          .join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  {rbtProfile.availabilityJson?.weekend && Object.keys(rbtProfile.availabilityJson.weekend).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Weekends:</p>
                      <p className="text-sm text-gray-600">
                        {Object.keys(rbtProfile.availabilityJson.weekend)
                          .filter((day: string) => rbtProfile.availabilityJson?.weekend?.[day])
                          .join(', ') || 'None'}
                      </p>
                    </div>
                  )}
                  {rbtProfile.availabilityJson?.preferredHoursRange && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Preferred Hours:</p>
                      <p className="text-sm text-gray-600">{(rbtProfile.availabilityJson as any).preferredHoursRange}</p>
                    </div>
                  )}
                  {((rbtProfile.availabilityJson as any)?.earliestStartTime || (rbtProfile.availabilityJson as any)?.latestEndTime) && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Time Range:</p>
                      <p className="text-sm text-gray-600">
                        {(rbtProfile.availabilityJson as any).earliestStartTime || 'Not specified'} - {(rbtProfile.availabilityJson as any).latestEndTime || 'Not specified'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Languages */}
            {rbtProfile.languagesJson && rbtProfile.languagesJson.languages && rbtProfile.languagesJson.languages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Languages Spoken</p>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">
                    {[...rbtProfile.languagesJson.languages, rbtProfile.languagesJson.otherLanguage].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Experience */}
            {rbtProfile.experienceYears !== null && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Years of Experience</p>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">{rbtProfile.experienceYears} years</p>
                </div>
              </div>
            )}

            {/* Transportation */}
            {rbtProfile.transportation !== null && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Reliable Transportation</p>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">{rbtProfile.transportation ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {/* Preferred Hours Range */}
            {rbtProfile.preferredHoursRange && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Preferred Weekly Hours</p>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">{rbtProfile.preferredHoursRange}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Management */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold text-gray-900">Status Management</CardTitle>
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

          <div className="flex flex-wrap gap-2">
            {canSendReachOut && (
              <Button 
                onClick={handleSendReachOutEmail} 
                disabled={loading || !rbtProfile.email}
                className="gradient-primary text-white border-0 rounded-xl px-6 shine-effect"
              >
                Send Reach-Out Email
              </Button>
            )}
            {canScheduleInterview && (
              <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={loading}
                    className="gradient-blue text-white border-0 rounded-xl px-6 shine-effect"
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
            {canHire && (
              <Button 
                onClick={handleHire} 
                disabled={loading} 
                className="gradient-green text-white border-0 rounded-xl px-6 shine-effect glow-effect"
              >
                Mark as Hired
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
            {isHired && incompleteTasks.length > 0 && (
              <Button 
                onClick={handleSendMissingOnboardingEmail} 
                disabled={loading || !rbtProfile.email}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 rounded-xl px-6"
              >
                Send Missing Onboarding Reminder
              </Button>
            )}
          </div>
          
          {/* Delete RBT Section - Always Visible */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button 
              onClick={handleDeleteRBT} 
              disabled={loading}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-xl px-6 w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete RBT
            </Button>
            <p className="text-xs text-gray-500 mt-2">This action cannot be undone. All RBT data will be permanently deleted.</p>
          </div>
        </CardContent>
      </Card>

      {/* Interviews */}
      {rbtProfile.interviews.length > 0 && (
        <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed-2" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold text-gray-900">Interview History</CardTitle>
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
                  <div key={interview.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">
                          {formatDateTime(interview.scheduledAt)} ({interview.durationMinutes} min)
                        </p>
                        <p className="text-sm text-gray-600">
                          Interviewer: {interview.interviewerName}
                        </p>
                        {interview.notes && (
                          <p className="text-sm text-gray-600 mt-2">{interview.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          <Badge variant="outline">{interview.status}</Badge>
                          <Badge variant="outline">{interview.decision}</Badge>
                        </div>
                        {canMarkCompleted && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteInterview(interview.id)}
                            disabled={loading}
                            className="gradient-blue text-white border-0"
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
                              className="gradient-green text-white border-0"
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
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Onboarding Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span className="font-bold">
                    {completedOnboardingTasks} / {totalOnboardingTasks} tasks completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
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
                <div className="text-sm text-gray-600">
                  {Math.round((completedOnboardingTasks / totalOnboardingTasks) * 100)}% complete
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-gray-900">Tasks</h3>
                {rbtProfile.onboardingTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {task.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400" />
                          )}
                          <h4 className="font-medium">{task.title}</h4>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1 ml-7">{task.description}</p>
                        )}
                        {task.isCompleted && task.completedAt && (
                          <p className="text-xs text-gray-500 mt-1 ml-7">
                            Completed: {formatDateTime(task.completedAt)}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={
                          task.isCompleted
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }
                      >
                        {task.isCompleted ? 'Completed' : 'Pending'}
                      </Badge>
                    </div>

                    {/* Show Signature if available */}
                    {task.taskType === 'SIGNATURE' && task.isCompleted && task.uploadUrl && (
                      <div className="mt-4 ml-7 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Digital Signature:</p>
                        <img
                          src={task.uploadUrl}
                          alt="Signature"
                          className="max-w-md border border-gray-300 rounded bg-white p-2"
                        />
                      </div>
                    )}

                    {/* Show Package Download if available */}
                    {task.taskType === 'PACKAGE_UPLOAD' && task.isCompleted && task.uploadUrl && (
                      <div className="mt-4 ml-7 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-medium text-gray-700">Uploaded Package:</p>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          Package uploaded and sent to administrator email
                        </p>
                        <a
                          href={`/api/admin/rbts/${rbtProfile.id}/download-package`}
                          download
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download Onboarding Package
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Documents */}
      {isHired && rbtProfile.onboardingCompletions && rbtProfile.onboardingCompletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Onboarding Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rbtProfile.onboardingCompletions.map((completion) => (
                <div key={completion.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {completion.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : completion.status === 'IN_PROGRESS' ? (
                          <XCircle className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                        <h4 className="font-medium">{completion.document.title}</h4>
                        <Badge variant="outline" className="ml-2">
                          {completion.document.type === 'ACKNOWLEDGMENT' ? 'Acknowledgment' : 'Fillable PDF'}
                        </Badge>
                      </div>
                      {completion.completedAt && (
                        <p className="text-xs text-gray-500 mt-1 ml-7">
                          Completed: {formatDateTime(completion.completedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          completion.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : completion.status === 'IN_PROGRESS'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
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
                              className="flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </Button>
                          ) : (
                            // For acknowledgments, show signature inline instead of download
                            completion.acknowledgmentJson && (
                              <div className="flex flex-col gap-2">
                                {(completion.acknowledgmentJson as any)?.signatureData && (
                                  <div className="border rounded p-2 bg-gray-50">
                                    <p className="text-xs text-gray-600 mb-1">Signature:</p>
                                    <img
                                      src={(completion.acknowledgmentJson as any).signatureData}
                                      alt="Signature"
                                      className="max-w-[200px] max-h-[80px] border rounded"
                                    />
                                  </div>
                                )}
                                {(completion.acknowledgmentJson as any)?.typedName && (
                                  <p className="text-sm text-gray-600">
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
        <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold text-gray-900">Interview Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rbtProfile.interviews
              .filter((i) => i.interviewNotes)
              .map((interview) => (
                <div
                  key={interview.id}
                  className="p-4 bg-white rounded-lg border border-gray-200 space-y-3"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Interview on {formatDateTime(interview.scheduledAt)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Interviewer: {interview.interviewerName}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {interview.status}
                    </Badge>
                  </div>
                  {interview.interviewNotes && (
                    <div className="space-y-3 text-sm">
                      {interview.interviewNotes.fullName && (
                        <div>
                          <span className="font-medium text-gray-700">Full Name: </span>
                          <span className="text-gray-600">{interview.interviewNotes.fullName}</span>
                        </div>
                      )}
                      {interview.interviewNotes.phoneNumber && (
                        <div>
                          <span className="font-medium text-gray-700">Phone: </span>
                          <span className="text-gray-600">{interview.interviewNotes.phoneNumber}</span>
                        </div>
                      )}
                      {interview.interviewNotes.experienceAnswer && (
                        <div>
                          <span className="font-medium text-gray-700">Experience: </span>
                          <p className="text-gray-600 mt-1">{interview.interviewNotes.experienceAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.availabilityAnswer && (
                        <div>
                          <span className="font-medium text-gray-700">Availability: </span>
                          <p className="text-gray-600 mt-1">{interview.interviewNotes.availabilityAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.payExpectationsAnswer && (
                        <div>
                          <span className="font-medium text-gray-700">Pay Expectations: </span>
                          <p className="text-gray-600 mt-1">{interview.interviewNotes.payExpectationsAnswer}</p>
                        </div>
                      )}
                      {interview.interviewNotes.closingNotes && (
                        <div>
                          <span className="font-medium text-gray-700">Closing Notes: </span>
                          <p className="text-gray-600 mt-1">{interview.interviewNotes.closingNotes}</p>
                        </div>
                      )}
                      <div className="pt-2 border-t">
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
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold text-gray-900">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Section */}
          <div className="space-y-3">
            <label
              htmlFor="document-upload"
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
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
            <p className="text-xs text-gray-500">
              Upload resumes, certifications, or other relevant documents (PDF, DOC, DOCX, JPG, PNG)
            </p>
          </div>

          {/* Documents List */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {doc.documentType || 'OTHER'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialogOpen} 
        onOpenChange={(open) => {
          // Prevent closing during loading
          if (!open && !confirmLoading) {
            setConfirmDialogOpen(false)
            setConfirmAction(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false)
                setConfirmAction(null)
                setConfirmLoading(false)
              }}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (confirmAction) {
                  setConfirmLoading(true)
                  try {
                    await confirmAction()
                    // Reset loading state after action completes (success or failure)
                    setConfirmLoading(false)
                  } catch (error) {
                    // Error already handled in confirmAction, but reset loading state
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
              ) : (
                'Confirm'
              )}
            </Button>
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
      durationMinutes: parseInt(formData.get('duration') as string, 10),
      interviewerName: interviewerEmail, // Use the selected email
      meetingUrl: formData.get('meetingUrl') || null,
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
        <Input id="time" name="time" type="time" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input id="duration" name="duration" type="number" defaultValue={15} required />
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
      <div className="space-y-2">
        <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
        <Input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://meet.google.com/..." />
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

