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
  email?: string
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

      {/* 1. Greeting and Introduction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">1. Greeting and Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] space-y-2">
            <p><strong>Script:</strong> Hello [First Name], how are you. Thanks for meeting with me today. Can you hear me clearly.</p>
            <p>Great. This will take about 15 to 30 minutes. I will ask a few questions about your experience, availability, and fit for the role, then I will cover next steps and leave time for questions.</p>
            <p>To start, are you familiar with what an RBT does day to day.</p>
            <p className="italic">If they are unsure:</p>
            <p>No problem. As an RBT, you provide direct ABA services with a client under a supervising BCBA. You implement skill building and behavior support procedures exactly as written in the treatment plan, prompt and reinforce appropriately, and keep sessions structured and professional. During the session you collect data on the targets the BCBA assigns and follow safety and behavior protocols as written. After the session you complete documentation in Motivity, including accurate start and end times, session notes, and caregiver signature when required. You share relevant observations with the BCBA and keep caregiver communication professional and within your role.</p>
          </div>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.greetingAnswer || ''}
              onChange={(e) => updateField('greetingAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Before we get into the interview questions, I am going to quickly confirm the key details we have in HRM and update anything that is missing or changed.
          </p>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Can you confirm your full legal name. What is the best phone number to reach you. What is the best email for Google Meet links and updates. What city and zip code are you based in. Is your availability and transportation still accurate as listed in your application or file. Are you currently an active RBT. If not, have you completed the 40 hour course, or are you willing to complete our 40 hour course during onboarding.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Full legal name:</Label>
              <input
                type="text"
                value={notes.fullName || ''}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Best phone number:</Label>
              <input
                type="text"
                value={notes.phoneNumber || ''}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
                placeholder="Phone number"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Best email (Google Meet links and updates):</Label>
              <input
                type="email"
                value={notes.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
                placeholder="Email"
              />
            </div>
            <div>
              <Label>City and zip code:</Label>
              <input
                type="text"
                value={notes.currentAddress || ''}
                onChange={(e) => updateField('currentAddress', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
                placeholder="City, zip or full address"
              />
            </div>
            <div>
              <Label>Birthdate (optional):</Label>
              <input
                type="text"
                value={notes.birthdate || ''}
                onChange={(e) => updateField('birthdate', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
                placeholder="MM/DD/YYYY"
              />
            </div>
          </div>
          <div>
            <Label>Additional basic info / availability &amp; transportation / RBT status &amp; 40hr:</Label>
            <textarea
              value={notes.basicInfoAnswer || ''}
              onChange={(e) => updateField('basicInfoAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Any updates or notes..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Experience and Background */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">3. Experience and Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] space-y-2">
            <p>Can you tell me about any experience you have working with children, individuals on the spectrum, or in ABA.</p>
            <p>What settings have you worked in such as in home, clinic, school, or community.</p>
            <p>What ages have you worked with, and what age range do you prefer.</p>
            <p className="italic">If they have ABA or similar experience:</p>
            <p>Tell me about a challenging moment during a session and how you handled it.</p>
            <p className="italic">If they do not have ABA or similar experience:</p>
            <p>No problem. Tell me about a challenging situation you handled in any job, school, or caregiving setting. What happened, what did you do, and what was the outcome.</p>
            <p><strong>Then ask this for everyone:</strong> Tell me about a time you received feedback from a supervisor or teacher and what you changed afterward.</p>
          </div>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.experienceAnswer || ''}
              onChange={(e) => updateField('experienceAnswer', e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Record experience, settings, ages, challenging moment, feedback..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. How They Heard About Rise and Shine ABA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">4. How They Heard About Rise and Shine ABA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            How did you hear about Rise and Shine ABA. What made you apply.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.heardAboutAnswer || ''}
              onChange={(e) => updateField('heardAboutAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="How they heard about us and why they applied..."
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Have you used Motivity, Rethink, or another ABA data platform before. What did you use it for. If you have not used one, are you comfortable learning it and completing documentation on time.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.abaPlatformsAnswer || ''}
              onChange={(e) => updateField('abaPlatformsAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Platform experience..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Scorecard (1–5) - kept as requested */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">Scorecard (1–5)</CardTitle>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] font-normal">
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            How do you approach communication with the BCBA and with the parent or caregiver. If a caregiver disagrees with the plan or tries to redirect the session, what would you do in the moment. If you are unsure what to do during a session, what is your next step.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.communicationAnswer || ''}
              onChange={(e) => updateField('communicationAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Communication approach, caregiver redirect, next step when unsure..."
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            What does your weekly availability look like. Which days and time blocks can you consistently work. How many hours per week are you looking for. What is your typical travel range. What is your earliest start date. Let me repeat back what I heard to confirm: [repeat days and time blocks]. Is that correct.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.availabilityAnswer || ''}
              onChange={(e) => updateField('availabilityAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Days, time blocks, hours/week, travel range, start date..."
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            What hourly rate are you looking for.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.payExpectationsAnswer || ''}
              onChange={(e) => updateField('payExpectationsAnswer', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Hourly rate or pay expectations..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 9. Previous Company and Why They Are Switching */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">9. Previous Company and Why They Are Switching</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            What prompted you to look for a new role. What are you looking for in your next position.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.previousCompanyAnswer || ''}
              onChange={(e) => updateField('previousCompanyAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Why switching, what they are looking for..."
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Before we finish, I want to confirm expectations so there are no surprises. Punctuality and reliability. Following the BCBA plan with treatment integrity. Consistent data collection during session as assigned. Accurate session start and end times and on time session notes in Motivity, including caregiver signature when required. Professional communication with families and the clinical team. Do you understand and agree to these expectations. If you realize a session time or note is incorrect, what would you do.
          </p>
          <div>
            <Label>Response / Notes:</Label>
            <textarea
              value={notes.expectationsAnswer || ''}
              onChange={(e) => updateField('expectationsAnswer', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
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
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            Thank you for your time today. What questions do you have for me. Next steps are [next step]. You will hear from us by [timeframe] via [text or email]. If anything changes with your availability, please let us know.
          </p>
          <div>
            <Label>Closing notes / next steps / timeframe:</Label>
            <textarea
              value={notes.closingNotes || ''}
              onChange={(e) => updateField('closingNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
              placeholder="Questions they asked, next steps, timeframe..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
