'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import Scorecard from './Scorecard'

interface InterviewNotesFormProps {
  interviewId: string
  rbtProfileId: string
  onSave?: () => void
}

interface InterviewNotesData {
  greetingAnswer?: string
  basicInfoAnswer?: string
  experienceAnswer?: string
  heardAboutAnswer?: string
  abaPlatformsAnswer?: string
  communicationAnswer?: string
  availabilityAnswer?: string
  payExpectationsAnswer?: string
  previousCompanyAnswer?: string
  expectationsAnswer?: string
  closingNotes?: string
  fullName?: string
  birthdate?: string
  currentAddress?: string
  phoneNumber?: string
}

export default function InterviewNotesForm({
  interviewId,
  rbtProfileId,
  onSave,
}: InterviewNotesFormProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState<InterviewNotesData>({})

  useEffect(() => {
    fetchNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId])

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/notes`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setNotes(data)
        }
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notes),
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Interview notes saved successfully', 'success')
        if (onSave) onSave()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to save notes', 'error')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      showToast('An error occurred while saving notes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof InterviewNotesData, value: string) => {
    setNotes((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interview Script & Notes</h3>
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Notes
            </>
          )}
        </Button>
      </div>

      {/* 1. Greeting & Introduction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">1. Greeting & Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Hi, how are you? Thanks for meeting with us today. Before we begin, are you familiar with the RBT position and what it involves?&quot;
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.greetingAnswer || ''}
              onChange={(e) => updateField('greetingAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Record their response here..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">2. Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;To start, can I get some basic information?&quot;
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Full Name:</Label>
              <input
                type="text"
                value={notes.fullName || ''}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Birthdate:</Label>
              <input
                type="text"
                value={notes.birthdate || ''}
                onChange={(e) => updateField('birthdate', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div>
              <Label>Phone Number:</Label>
              <input
                type="text"
                value={notes.phoneNumber || ''}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Phone number"
              />
            </div>
          </div>
          <div>
            <Label>Current Home Address / Location:</Label>
            <textarea
              value={notes.currentAddress || ''}
              onChange={(e) => updateField('currentAddress', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Current address"
            />
          </div>
          <div>
            <Label>Additional Notes:</Label>
            <textarea
              value={notes.basicInfoAnswer || ''}
              onChange={(e) => updateField('basicInfoAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any additional information..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Experience & Background */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">3. Experience & Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Can you tell me about any experience you have working with children, individuals with autism, or in ABA therapy?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.experienceAnswer || ''}
              onChange={(e) => updateField('experienceAnswer', e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Record their experience and how they handle difficult situations..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. How They Heard About Rise & Shine ABA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">4. How They Heard About Rise & Shine ABA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;How did you hear about Rise & Shine ABA?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.heardAboutAnswer || ''}
              onChange={(e) => updateField('heardAboutAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="How they heard about us..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. Familiarity With ABA Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">5. Familiarity With ABA Platforms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Are you familiar with ABA tools like Motivity or Rethink?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.abaPlatformsAnswer || ''}
              onChange={(e) => updateField('abaPlatformsAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Their familiarity with ABA platforms..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Scorecard (1–5) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">Scorecard (1–5)</CardTitle>
          <p className="text-sm text-gray-600 dark:text-white font-normal">
            Rate core RBT skills for consistent hiring decisions.
          </p>
        </CardHeader>
        <CardContent>
          <Scorecard interviewId={interviewId} />
        </CardContent>
      </Card>

      {/* 6. Communication Importance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">6. Communication Importance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;How important do you think communication is between you, the child&apos;s parents, and the BCBA?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.communicationAnswer || ''}
              onChange={(e) => updateField('communicationAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Their thoughts on communication..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 7. Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">7. Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;What does your weekly availability look like? Which days and times can you consistently work?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.availabilityAnswer || ''}
              onChange={(e) => updateField('availabilityAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Their weekly availability..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 8. Pay Expectations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">8. Pay Expectations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;What are your pay expectations for this position?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.payExpectationsAnswer || ''}
              onChange={(e) => updateField('payExpectationsAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Their pay expectations..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 9. Previous Company / Why They're Switching */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">9. Previous Company / Why They&apos;re Switching</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Why are you leaving your current company, and what made you want to come work with us instead?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.previousCompanyAnswer || ''}
              onChange={(e) => updateField('previousCompanyAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Why they&apos;re switching companies..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 10. Company Expectations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">10. Company Expectations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Before we finish up, I want to share our main expectations at Rise & Shine ABA: Punctuality, Consistent data collection (at least 3 targets per hour), Weekly session notes, Maintaining a healthy relationship with parents, the child, and the BCBA. Do you understand and agree to these expectations?&quot;
          </p>
          <div>
            <Label>Response:</Label>
            <textarea
              value={notes.expectationsAnswer || ''}
              onChange={(e) => updateField('expectationsAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Their response to company expectations..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 11. Closing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">11. Closing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-white">
            &quot;Great. Thank you so much for your time. We&apos;ll review everything and get back to you shortly.&quot;
          </p>
          <div>
            <Label>Additional Closing Notes:</Label>
            <textarea
              value={notes.closingNotes || ''}
              onChange={(e) => updateField('closingNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any additional closing notes or observations..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

