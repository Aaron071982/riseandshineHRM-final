// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Intern candidate detail page

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import InternCandidateStatusManager from '@/components/admin/InternCandidateStatusManager'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { InternCandidate } from '@/lib/intern-storage'

export default function InternCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [candidate, setCandidate] = useState<InternCandidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [candidateId, setCandidateId] = useState<string>('')

  useEffect(() => {
    async function loadId() {
      const resolved = await params
      setCandidateId(resolved.id)
    }
    loadId()
  }, [params])

  useEffect(() => {
    if (candidateId) {
      fetchCandidate()
    }
  }, [candidateId])

  const fetchCandidate = async () => {
    try {
      const response = await fetch(`/api/dev/intern-candidates/${candidateId}`)
      if (response.ok) {
        const data = await response.json()
        setCandidate(data)
      } else {
        showToast('Failed to load candidate', 'error')
        router.push('/admin/interns')
      }
    } catch (error) {
      console.error('Error fetching candidate:', error)
      showToast('Error loading candidate', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateNotes = async (notes: string) => {
    if (!candidate) return
    setSaving(true)
    try {
      const response = await fetch(`/api/dev/intern-candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewNotes: notes }),
      })
      if (response.ok) {
        const updated = await response.json()
        setCandidate(updated)
        showToast('Notes updated successfully', 'success')
      } else {
        showToast('Failed to update notes', 'error')
      }
    } catch (error) {
      console.error('Error updating notes:', error)
      showToast('Error updating notes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateInterview = async (interviewData: {
    interviewDate?: string
    interviewTime?: string
    interviewLocation?: string
    meetingUrl?: string
  }) => {
    if (!candidate) return
    setSaving(true)
    try {
      const response = await fetch(`/api/dev/intern-candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interviewData),
      })
      if (response.ok) {
        const updated = await response.json()
        setCandidate(updated)
        showToast('Interview details updated successfully', 'success')
      } else {
        showToast('Failed to update interview details', 'error')
      }
    } catch (error) {
      console.error('Error updating interview:', error)
      showToast('Error updating interview details', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleHire = async () => {
    if (!candidate) return
    setSaving(true)
    try {
      const response = await fetch(`/api/dev/intern-candidates/${candidateId}/hire`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setCandidate(data.candidate)
        showToast('Candidate hired successfully! Intern record created.', 'success')
        router.push('/admin/interns')
      } else {
        showToast('Failed to hire candidate', 'error')
      }
    } catch (error) {
      console.error('Error hiring candidate:', error)
      showToast('Error hiring candidate', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Candidate not found</p>
        <Link href="/admin/interns">
          <Button className="mt-4">Back to Interns</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/interns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{candidate.name}</h1>
          <p className="text-gray-600">{candidate.email}</p>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <p className="text-gray-900 font-medium">{candidate.name}</p>
            </div>
            <div>
              <Label>Email</Label>
              <p className="text-gray-900 font-medium">{candidate.email}</p>
            </div>
            {candidate.phone && (
              <div>
                <Label>Phone</Label>
                <p className="text-gray-900 font-medium">{candidate.phone}</p>
              </div>
            )}
            <div>
              <Label>Role</Label>
              <p className="text-gray-900 font-medium">{candidate.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Management */}
      <Card>
        <CardHeader>
          <CardTitle>Status Management</CardTitle>
        </CardHeader>
        <CardContent>
          <InternCandidateStatusManager
            candidateId={candidateId}
            initialStatus={candidate.status}
            onStatusChange={(newStatus) => {
              setCandidate({ ...candidate, status: newStatus })
              if (newStatus === 'Hired') {
                handleHire()
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Interview Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Scheduling</CardTitle>
        </CardHeader>
        <CardContent>
          <InterviewSchedulingForm
            candidate={candidate}
            onUpdate={handleUpdateInterview}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* Interview Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <InterviewNotesForm
            notes={candidate.interviewNotes || ''}
            onSave={handleUpdateNotes}
            disabled={saving}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function InterviewSchedulingForm({
  candidate,
  onUpdate,
  disabled,
}: {
  candidate: InternCandidate
  onUpdate: (data: any) => void
  disabled: boolean
}) {
  const [interviewDate, setInterviewDate] = useState(candidate.interviewDate || '')
  const [interviewTime, setInterviewTime] = useState(candidate.interviewTime || '')
  const [interviewLocation, setInterviewLocation] = useState(candidate.interviewLocation || '')
  const [meetingUrl, setMeetingUrl] = useState(candidate.meetingUrl || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate({
      interviewDate,
      interviewTime,
      interviewLocation,
      meetingUrl,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="interviewDate">Interview Date</Label>
          <Input
            id="interviewDate"
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="interviewTime">Interview Time</Label>
          <Input
            id="interviewTime"
            type="time"
            value={interviewTime}
            onChange={(e) => setInterviewTime(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="interviewLocation">Location (optional)</Label>
          <Input
            id="interviewLocation"
            value={interviewLocation}
            onChange={(e) => setInterviewLocation(e.target.value)}
            placeholder="Interview location"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
          <Input
            id="meetingUrl"
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
            disabled={disabled}
          />
        </div>
      </div>
      <Button type="submit" disabled={disabled}>
        {disabled ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Interview Details'
        )}
      </Button>
    </form>
  )
}

function InterviewNotesForm({
  notes,
  onSave,
  disabled,
}: {
  notes: string
  onSave: (notes: string) => void
  disabled: boolean
}) {
  const [interviewNotes, setInterviewNotes] = useState(notes)

  useEffect(() => {
    setInterviewNotes(notes)
  }, [notes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(interviewNotes)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="interviewNotes">Notes</Label>
        <Textarea
          id="interviewNotes"
          value={interviewNotes}
          onChange={(e) => setInterviewNotes(e.target.value)}
          placeholder="Enter interview notes, questions, answers, and observations..."
          className="min-h-[300px]"
          disabled={disabled}
        />
      </div>
      <Button type="submit" disabled={disabled}>
        {disabled ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Notes'
        )}
      </Button>
    </form>
  )
}

