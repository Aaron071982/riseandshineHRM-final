'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/utils'
import { CheckCircle2, XCircle, Download, FileText, Trash2 } from 'lucide-react'
import RBTScheduleView from './RBTScheduleView'
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
  status: string
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
  const [rbtProfile, setRbtProfile] = useState(initialRbtProfile)
  const [loading, setLoading] = useState(false)
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const updated = await response.json()
        setRbtProfile({ ...rbtProfile, status: updated.status })
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReachOutEmail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType: 'REACH_OUT' }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('Reach-out email sent successfully!')
        router.refresh()
      } else {
        alert(`Failed to send email: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('An error occurred while sending the email. Check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  const handleHire = async () => {
    if (!confirm('Are you sure you want to hire this candidate? This will send a welcome email and create onboarding tasks.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/hire`, {
        method: 'POST',
      })

      if (response.ok) {
        router.refresh()
        alert('Candidate hired successfully!')
      }
    } catch (error) {
      console.error('Error hiring candidate:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this candidate? This will send a rejection email and update their status to REJECTED.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/reject`, {
        method: 'POST',
      })

      if (response.ok) {
        router.refresh()
        alert('Candidate rejected successfully. A rejection email has been sent.')
      } else {
        const data = await response.json()
        alert(`Failed to reject candidate: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error rejecting candidate:', error)
      alert('An error occurred while rejecting the candidate.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRBT = async () => {
    if (!confirm(`Are you sure you want to delete ${rbtProfile.firstName} ${rbtProfile.lastName}? This action cannot be undone.`)) {
      return
    }

    if (!confirm('This will permanently delete the RBT profile and all associated data. Are you absolutely sure?')) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('RBT deleted successfully')
        // Force refresh and redirect
        router.refresh()
        setTimeout(() => {
          router.push('/admin/rbts')
        }, 100)
      } else {
        const errorData = await response.json()
        alert(`Failed to delete RBT: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting RBT:', error)
      alert('An error occurred while deleting the RBT. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleInterview = async (data: any) => {
    setLoading(true)
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
        setInterviewDialogOpen(false)
        router.refresh()
        alert('Interview scheduled successfully!')
      }
    } catch (error) {
      console.error('Error scheduling interview:', error)
    } finally {
      setLoading(false)
    }
  }

  const canSendReachOut = rbtProfile.status === 'REACH_OUT' || rbtProfile.status === 'NEW'
  const canScheduleInterview = rbtProfile.status === 'TO_INTERVIEW' || rbtProfile.status === 'REACH_OUT'
  const canHire = rbtProfile.status === 'INTERVIEW_COMPLETED'
  const canReject = rbtProfile.status !== 'HIRED' && rbtProfile.status !== 'REJECTED'
  const isHired = rbtProfile.status === 'HIRED'

  const completedOnboardingTasks = rbtProfile.onboardingTasks.filter(t => t.isCompleted).length
  const totalOnboardingTasks = rbtProfile.onboardingTasks.length

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
          <CardTitle className="text-2xl font-bold text-gray-900">Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
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
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-medium">
                {rbtProfile.locationCity && rbtProfile.locationState
                  ? `${rbtProfile.locationCity}, ${rbtProfile.locationState}`
                  : rbtProfile.zipCode || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Preferred Service Area</p>
              <p className="font-medium">{rbtProfile.preferredServiceArea || '—'}</p>
            </div>
            {rbtProfile.addressLine1 && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">
                  {rbtProfile.addressLine1}
                  {rbtProfile.addressLine2 && `, ${rbtProfile.addressLine2}`}
                </p>
              </div>
            )}
            {rbtProfile.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Notes</p>
                <p className="font-medium whitespace-pre-wrap">{rbtProfile.notes}</p>
              </div>
            )}
          </div>
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
              value={rbtProfile.status}
              onValueChange={handleStatusChange}
              disabled={loading}
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

