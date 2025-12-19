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
      recommendation: string | null
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
}

interface RBTProfileViewProps {
  rbtProfile: RBTProfile
}

const statusColors: Record<string, string> = {
  NEW: 'bg-gray-500',
  REACH_OUT: 'bg-blue-500',
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
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null)

  const handleStatusChange = (newStatus: string) => {
    // Don't show confirmation if status hasn't actually changed
    if (newStatus === rbtProfile.status) {
      return
    }
    
    const statusLabels: Record<string, string> = {
      NEW: 'New',
      REACH_OUT: 'Reach Out',
      TO_INTERVIEW: 'To Interview',
      INTERVIEW_SCHEDULED: 'Interview Scheduled',
      INTERVIEW_COMPLETED: 'Interview Completed',
      HIRED: 'Hired',
      REJECTED: 'Rejected',
    }
    
    setPendingStatusChange(newStatus)
    setConfirmMessage(`Are you sure you want to change the status to "${statusLabels[newStatus] || newStatus}"?`)
    setConfirmAction(async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })

        if (response.ok) {
          const updated = await response.json()
          setRbtProfile({ ...rbtProfile, status: updated.status })
          showToast('Status updated successfully', 'success')
          setConfirmDialogOpen(false)
          setConfirmAction(null)
          setPendingStatusChange(null)
          router.refresh()
        } else {
          const data = await response.json()
          showToast(data.error || 'Failed to update status', 'error')
          setPendingStatusChange(null)
          // Keep dialog open on error so user can see the error message
        }
      } catch (error) {
        console.error('Error updating status:', error)
        showToast('An error occurred while updating status', 'error')
        setPendingStatusChange(null)
        // Keep dialog open on error so user can see the error message
      } finally {
        setLoading(false)
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleSendReachOutEmail = () => {
    setConfirmMessage(`Are you sure you want to send a reach-out email to ${rbtProfile.firstName} ${rbtProfile.lastName}?`)
    setConfirmAction(async () => {
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

  const handleScheduleInterview = (data: any) => {
    // Store the interview data and close the form dialog
    setPendingInterviewData(data)
    setInterviewDialogOpen(false)
    
    // Format the date/time for confirmation message
    const scheduledDate = new Date(data.scheduledAt)
    const formattedDate = scheduledDate.toLocaleDateString()
    const formattedTime = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
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

  const canSendReachOut = rbtProfile.status === 'REACH_OUT' || rbtProfile.status === 'NEW'
  const canScheduleInterview = rbtProfile.status === 'TO_INTERVIEW' || rbtProfile.status === 'REACH_OUT'
  const canHire = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canReject = rbtProfile.status !== 'HIRED' && rbtProfile.status !== 'REJECTED'
  const isHired = rbtProfile.status === 'HIRED'

  const completedOnboardingTasks = rbtProfile.onboardingTasks.filter(t => t.isCompleted).length
  const totalOnboardingTasks = rbtProfile.onboardingTasks.length
  const incompleteTasks = rbtProfile.onboardingTasks.filter(t => !t.isCompleted)

  const statusConfig = {
    NEW: { color: 'from-gray-500 to-gray-400' },
    REACH_OUT: { color: 'from-blue-500 to-blue-400' },
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

      {/* Status Management */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation-delayed" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold text-gray-900">Status Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Change Status:</Label>
            <Select
              value={pendingStatusChange || rbtProfile.status}
              onValueChange={handleStatusChange}
              disabled={loading || confirmDialogOpen}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="REACH_OUT">Reach Out</SelectItem>
                <SelectItem value="TO_INTERVIEW">To Interview</SelectItem>
                <SelectItem value="INTERVIEW_SCHEDULED">Interview Scheduled</SelectItem>
                <SelectItem value="INTERVIEW_COMPLETED">Interview Completed</SelectItem>
                <SelectItem value="HIRED">Hired</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {rbtProfile.interviews.map((interview) => (
                <div key={interview.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
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
                    <div className="flex gap-2">
                      <Badge variant="outline">{interview.status}</Badge>
                      <Badge variant="outline">{interview.decision}</Badge>
                    </div>
                  </div>
                </div>
              ))}
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
                      {interview.interviewNotes.recommendation && (
                        <div>
                          <span className="font-medium text-gray-700">Recommendation: </span>
                          <Badge
                            className={`mt-1 ${
                              interview.interviewNotes.recommendation === 'SUGGEST_HIRING'
                                ? 'bg-green-100 text-green-700'
                                : interview.interviewNotes.recommendation === 'SUGGEST_REJECTING'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {interview.interviewNotes.recommendation === 'SUGGEST_HIRING'
                              ? 'Suggest Hiring'
                              : interview.interviewNotes.recommendation === 'SUGGEST_REJECTING'
                              ? 'Suggest Rejecting'
                              : 'Stalling'}
                          </Badge>
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
            setPendingStatusChange(null)
          }
        }}
        modal={true}
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
                setPendingStatusChange(null)
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
    onSubmit({
      scheduledAt: new Date(`${formData.get('date')}T${formData.get('time')}`).toISOString(),
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
        <Input id="duration" name="duration" type="number" defaultValue={60} required />
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

