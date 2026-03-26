'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  SCORECARD_CATEGORIES,
  SCORECARD_CATEGORY_LABELS,
  type ScorecardCategory,
} from '@/lib/scorecard'
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Video,
  User,
  FileText,
  BarChart3,
  UserCircle,
} from 'lucide-react'
import Link from 'next/link'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'

// ─── Types ────────────────────────────────────────────────────────
interface InterviewNotesPageProps {
  interviewId: string
  currentUser: { id: string; name: string }
}

interface NotesData {
  greetingAnswer?: string | null
  basicInfoAnswer?: string | null
  experienceAnswer?: string | null
  heardAboutAnswer?: string | null
  abaPlatformsAnswer?: string | null
  communicationAnswer?: string | null
  availabilityAnswer?: string | null
  payExpectationsAnswer?: string | null
  previousCompanyAnswer?: string | null
  expectationsAnswer?: string | null
  closingNotes?: string | null
  quickNotes?: string | null
  fullName?: string | null
  email?: string | null
  birthdate?: string | null
  currentAddress?: string | null
  phoneNumber?: string | null
  recommendation?: string | null
}

interface InterviewData {
  id: string
  scheduledAt: string
  status: string
  decision: string
  interviewerName: string
  meetingUrl: string | null
  claimedByUserId: string | null
}

interface RBTProfile {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phoneNumber: string | null
  locationCity: string | null
  locationZip: string | null
  status: string
  hasTransportation: boolean | null
  transportationDetails: string | null
  languages: string | null
  yearsExperience: number | null
  experienceDetails: string | null
  certifications: string | null
  availabilitySlots: Array<{ dayOfWeek: string; startHour: number; endHour: number }>
  applicationAnswers?: Record<string, unknown> | null
  user?: { email: string | null; name: string | null } | null
}

// ─── Script Data ──────────────────────────────────────────────────
const SCRIPT_SECTIONS = [
  {
    num: 1,
    title: 'Greeting and Introduction',
    script: `Hello [First Name], how are you. Thanks for meeting with me today. Can you hear me clearly.\n\nGreat. This will take about 15 to 30 minutes. I will ask a few questions about your experience, availability, and fit for the role, then I will cover next steps and leave time for questions.\n\nTo start, are you familiar with what an RBT does day to day.\n\nIf they are unsure: No problem. As an RBT, you provide direct ABA services with a client under a supervising BCBA. You implement skill building and behavior support procedures exactly as written in the treatment plan, prompt and reinforce appropriately, and keep sessions structured and professional.`,
  },
  {
    num: 2,
    title: 'Basic Information',
    script: `Before we get into the interview questions, I am going to quickly confirm the key details we have in HRM and update anything that is missing or changed.\n\nCan you confirm your full legal name. What is the best phone number to reach you. What is the best email for Google Meet links and updates. What city and zip code are you based in. Is your availability and transportation still accurate.`,
  },
  {
    num: 3,
    title: 'Experience and Background',
    script: `Can you tell me about any experience you have working with children, individuals on the spectrum, or in ABA.\n\nWhat settings have you worked in (in home, clinic, school, community). What ages have you worked with, and what age range do you prefer.\n\nTell me about a challenging moment during a session and how you handled it.\n\nTell me about a time you received feedback from a supervisor and what you changed afterward.`,
  },
  {
    num: 4,
    title: 'How They Heard About Us',
    script: 'How did you hear about Rise and Shine ABA. What made you apply.',
  },
  {
    num: 5,
    title: 'ABA Platforms',
    script: 'Have you used Motivity, Rethink, or another ABA data platform before. What did you use it for. If you have not used one, are you comfortable learning it and completing documentation on time.',
  },
  {
    num: 6,
    title: 'Communication',
    script: 'How do you approach communication with the BCBA and with the parent or caregiver. If a caregiver disagrees with the plan or tries to redirect the session, what would you do in the moment. If you are unsure what to do during a session, what is your next step.',
  },
  {
    num: 7,
    title: 'Availability',
    script: 'What does your weekly availability look like. Which days and time blocks can you consistently work. How many hours per week are you looking for. What is your typical travel range. What is your earliest start date.',
  },
  {
    num: 8,
    title: 'Pay Expectations',
    script: 'What hourly rate are you looking for.',
  },
  {
    num: 9,
    title: 'Previous Company',
    script: 'What prompted you to look for a new role. What are you looking for in your next position.',
  },
  {
    num: 10,
    title: 'Company Expectations',
    script: 'Punctuality and reliability. Following the BCBA plan with treatment integrity. Consistent data collection during session. Accurate session start and end times and on time session notes in Motivity. Professional communication with families and the clinical team. Do you understand and agree to these expectations.',
  },
  {
    num: 11,
    title: 'Closing',
    script: 'Thank you for your time today. What questions do you have for me. Next steps are [next step]. You will hear from us by [timeframe] via [text or email].',
  },
]

// ─── Component ────────────────────────────────────────────────────
export default function InterviewNotesPage({ interviewId, currentUser }: InterviewNotesPageProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [interview, setInterview] = useState<InterviewData | null>(null)
  const [rbtProfile, setRbtProfile] = useState<RBTProfile | null>(null)
  const [notes, setNotes] = useState<NotesData>({})
  const [scorecardScores, setScorecardScores] = useState<Record<string, number>>({})
  const [scorecardComments, setScorecardComments] = useState<Record<string, string>>({})

  const [showScript, setShowScript] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'notes' | 'scorecard' | 'candidate'>('notes')
  const [updateProfile, setUpdateProfile] = useState(false)

  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scorecardSaving, setScorecardSaving] = useState(false)
  const scorecardDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionDecision, setCompletionDecision] = useState<string>('PENDING')
  const [completionNotes, setCompletionNotes] = useState('')
  const [completing, setCompleting] = useState(false)

  // Refs to avoid stale closures in saveNotes — enables auto-save and
  // unmount-save to always read the latest values without re-creating
  // the callback (which would reset the auto-save timer on every keystroke).
  const notesRef = useRef(notes)
  const dirtyRef = useRef(dirty)
  const updateProfileRef = useRef(updateProfile)
  const savingRef = useRef(false)

  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { updateProfileRef.current = updateProfile }, [updateProfile])

  // ─── Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [notesRes, scorecardRes] = await Promise.all([
          fetch(`/api/admin/interviews/${interviewId}/notes`, { credentials: 'include' }),
          fetch(`/api/admin/interviews/${interviewId}/scorecard`, { credentials: 'include' }),
        ])
        if (notesRes.ok) {
          const d = await notesRes.json()
          if (d.notes) setNotes(d.notes)
          if (d.interview) setInterview(d.interview)
          if (d.rbtProfile) setRbtProfile(d.rbtProfile)
        }
        if (scorecardRes.ok) {
          const s = await scorecardRes.json()
          if (s.scorecard) {
            setScorecardScores(s.scorecard.scores || {})
            setScorecardComments(s.scorecard.comments || {})
          }
        }
      } catch (e) {
        console.error('[InterviewNotes] Failed to load:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [interviewId])

  // ─── Auto-populate from profile ───────────────────────────────
  useEffect(() => {
    if (!rbtProfile || notes.fullName) return
    setNotes((prev) => ({
      ...prev,
      fullName: prev.fullName || `${rbtProfile.firstName} ${rbtProfile.lastName}`,
      phoneNumber: prev.phoneNumber || rbtProfile.phoneNumber || '',
      email: prev.email || rbtProfile.email || rbtProfile.user?.email || '',
      currentAddress: prev.currentAddress || [rbtProfile.locationCity, rbtProfile.locationZip].filter(Boolean).join(', ') || '',
    }))
  }, [rbtProfile, notes.fullName])

  // ─── Save notes (stable callback — reads from refs) ──────────
  const saveNotes = useCallback(async (isAutoSave = false) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)

    const payload = { ...notesRef.current, updateProfile: updateProfileRef.current }
    console.log('[InterviewNotes] Saving...', { isAutoSave, quickNotesLen: payload.quickNotes?.length ?? 0, recommendation: payload.recommendation })

    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      if (res.ok) {
        const result = await res.json()
        console.log('[InterviewNotes] Save success:', result.notes?.id)
        setLastSaved(new Date())
        setDirty(false)
        dirtyRef.current = false
        if (!isAutoSave) showToast('Notes saved', 'success')
      } else {
        let errorMsg = 'Failed to save'
        try {
          const d = await res.json()
          errorMsg = d.error || errorMsg
        } catch { /* ignore parse error */ }
        console.error('[InterviewNotes] Save failed:', res.status, errorMsg)
        if (!isAutoSave) showToast(errorMsg, 'error')
      }
    } catch (e) {
      console.error('[InterviewNotes] Save network error:', e)
      if (!isAutoSave) showToast('Error saving notes', 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [interviewId, showToast])

  // ─── Auto-save every 10s when dirty ──────────────────────────
  useEffect(() => {
    if (!dirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (dirtyRef.current) saveNotes(true)
    }, 10_000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [dirty, saveNotes])

  // ─── Save on page leave / unmount ─────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      // Fire a synchronous beacon save as a last resort
      const payload = { ...notesRef.current, updateProfile: updateProfileRef.current }
      navigator.sendBeacon(
        `/api/admin/interviews/${interviewId}/notes`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      )
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Save on component unmount (e.g. navigating to another page in the SPA)
      if (dirtyRef.current && !savingRef.current) {
        const payload = { ...notesRef.current, updateProfile: updateProfileRef.current }
        navigator.sendBeacon(
          `/api/admin/interviews/${interviewId}/notes`,
          new Blob([JSON.stringify(payload)], { type: 'application/json' })
        )
      }
    }
  }, [interviewId])

  const updateField = (field: keyof NotesData, value: string) => {
    setNotes((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  // ─── Scorecard save ───────────────────────────────────────────
  const persistScorecard = useCallback(async (scores: Record<string, number>, comments: Record<string, string>) => {
    setScorecardSaving(true)
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/scorecard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, comments }),
        credentials: 'include',
      })
      if (!res.ok) console.error('[InterviewNotes] Scorecard save failed:', res.status)
    } catch (e) {
      console.error('[InterviewNotes] Scorecard save error:', e)
    } finally {
      setScorecardSaving(false)
    }
  }, [interviewId])

  const setScore = (cat: ScorecardCategory, val: number) => {
    const next = { ...scorecardScores, [cat]: val }
    setScorecardScores(next)
    if (scorecardDebounce.current) clearTimeout(scorecardDebounce.current)
    scorecardDebounce.current = setTimeout(() => persistScorecard(next, scorecardComments), 500)
  }

  const setScorecardComment = (cat: ScorecardCategory, val: string) => {
    const next = { ...scorecardComments, [cat]: val }
    setScorecardComments(next)
    if (scorecardDebounce.current) clearTimeout(scorecardDebounce.current)
    scorecardDebounce.current = setTimeout(() => persistScorecard(scorecardScores, next), 500)
  }

  // ─── Complete interview ───────────────────────────────────────
  const handleComplete = async () => {
    setCompleting(true)
    try {
      await saveNotes(true)
      const res = await fetch(`/api/admin/interviews/${interviewId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: completionDecision, closingNotes: completionNotes }),
        credentials: 'include',
      })
      if (res.ok) {
        showToast('Interview completed', 'success')
        setCompletionOpen(false)
        setInterview((prev) => prev ? { ...prev, status: 'COMPLETED', decision: completionDecision } : prev)
      } else {
        const d = await res.json()
        showToast(d.error || 'Failed to complete', 'error')
      }
    } catch {
      showToast('Error completing interview', 'error')
    } finally {
      setCompleting(false)
    }
  }

  // ─── Toggle script section ────────────────────────────────────
  const toggleSection = (num: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  // ─── Overall scorecard ────────────────────────────────────────
  const scorecardVals = Object.values(scorecardScores).filter((v) => v >= 1 && v <= 5)
  const overallScore = scorecardVals.length > 0 ? Math.round((scorecardVals.reduce((a, b) => a + b, 0) / scorecardVals.length) * 10) / 10 : 0
  const scoreColor = overallScore >= 4 ? 'text-green-600' : overallScore >= 3 ? 'text-yellow-600' : overallScore > 0 ? 'text-red-600' : 'text-gray-400'

  // ─── Hour helpers ─────────────────────────────────────────────
  const hourLabel = (h: number) => {
    if (h === 0 || h === 24) return '12 AM'
    if (h === 12) return '12 PM'
    return h < 12 ? `${h} AM` : `${h - 12} PM`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const candidateName = rbtProfile ? `${rbtProfile.firstName} ${rbtProfile.lastName}` : 'Candidate'

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[var(--bg-primary)]">
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-[var(--bg-secondary)] dark:border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/interviews" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{candidateName}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {interview?.scheduledAt ? new Date(interview.scheduledAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : ''}
              {interview?.status === 'COMPLETED' && <span className="ml-2 text-green-600 font-medium">Completed</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {interview?.meetingUrl && (
            <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Video className="w-4 h-4" /> Join Meeting
            </a>
          )}
        </div>
      </div>

      {/* ─── Main area ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left panel: Script ──────────────────────────────────── */}
        {showScript && (
          <div className="w-1/3 min-w-[280px] max-w-[420px] border-r dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b dark:border-[var(--border-subtle)] shrink-0">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Interview Script</span>
              <button onClick={() => setShowScript(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Hide script">
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {SCRIPT_SECTIONS.map((s) => {
                const open = expandedSections.has(s.num)
                return (
                  <div key={s.num}>
                    <button
                      onClick={() => toggleSection(s.num)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    >
                      {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <span>{s.num}. {s.title}</span>
                    </button>
                    {open && (
                      <div className="px-9 pb-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                        {s.script}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Right panel: Tabs ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 pt-2 border-b dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-secondary)] shrink-0">
            {!showScript && (
              <button onClick={() => setShowScript(true)} className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Show script">
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            {([
              { key: 'notes' as const, label: 'Notes', icon: FileText },
              { key: 'scorecard' as const, label: 'Scorecard', icon: BarChart3 },
              { key: 'candidate' as const, label: 'Candidate Info', icon: UserCircle },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-orange-500 text-orange-600 dark:text-[var(--orange-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ═════ TAB: Notes ═════ */}
            {activeTab === 'notes' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Quick Notes</Label>
                  <textarea
                    value={notes.quickNotes || ''}
                    onChange={(e) => updateField('quickNotes', e.target.value)}
                    rows={8}
                    placeholder="Type anything during the interview... key observations, red flags, impressions..."
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
                  />
                </div>

                <div className="border-t dark:border-[var(--border-subtle)] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Structured Fields</h3>
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateProfile}
                        onChange={(e) => setUpdateProfile(e.target.checked)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      Update RBT profile on save
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Full legal name</Label>
                      <input type="text" value={notes.fullName || ''} onChange={(e) => updateField('fullName', e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Best phone</Label>
                      <input type="text" value={notes.phoneNumber || ''} onChange={(e) => updateField('phoneNumber', e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Best email</Label>
                      <input type="email" value={notes.email || ''} onChange={(e) => updateField('email', e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <AddressAutocomplete
                        onAddressSelect={(address) => updateField('currentAddress', `${address.city}, ${address.zipCode}`)}
                        onChange={(value) => updateField('currentAddress', value)}
                        defaultValue={notes.currentAddress || ''}
                        placeholder="City, zip..."
                        mode="cityZipOnly"
                        id="notes-city-zip"
                        label="City / zip"
                        className="[&_input]:rounded-md [&_input]:border-gray-300 dark:[&_input]:border-[var(--border-subtle)] [&_input]:bg-white dark:[&_input]:bg-[var(--bg-input)]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Availability updates / notes</Label>
                      <textarea value={notes.availabilityAnswer || ''} onChange={(e) => updateField('availabilityAnswer', e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm resize-y" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════ TAB: Scorecard ═════ */}
            {activeTab === 'scorecard' && (
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Overall score */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                  <div className={`text-4xl font-bold ${scoreColor}`}>
                    {overallScore > 0 ? overallScore.toFixed(1) : '—'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Overall Score</p>
                    <p className="text-xs text-gray-500">{scorecardVals.length} of {SCORECARD_CATEGORIES.length} categories rated</p>
                  </div>
                  {scorecardSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
                </div>

                {/* Categories */}
                <div className="space-y-3">
                  {SCORECARD_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                      <span className="min-w-[180px] text-sm font-medium text-gray-700 dark:text-gray-200">
                        {SCORECARD_CATEGORY_LABELS[cat]}
                      </span>
                      <div className="flex gap-1.5">
                        {([1, 2, 3, 4, 5] as const).map((n) => {
                          const selected = scorecardScores[cat] === n
                          const bg = selected
                            ? n <= 2 ? 'bg-red-500 border-red-500 text-white' : n === 3 ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-green-500 border-green-500 text-white'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                          return (
                            <button key={n} onClick={() => setScore(cat, n)}
                              className={`min-w-[2.25rem] rounded-full border px-2.5 py-1 text-sm font-medium transition-colors ${bg}`}>
                              {n}
                            </button>
                          )
                        })}
                      </div>
                      <input
                        type="text"
                        value={scorecardComments[cat] || ''}
                        onChange={(e) => setScorecardComment(cat, e.target.value)}
                        placeholder="Comment..."
                        className="flex-1 min-w-[120px] rounded-md border border-gray-200 dark:border-[var(--border-subtle)] bg-transparent px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>

                {/* Recommendation */}
                <div className="p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 block">Recommendation</Label>
                  <div className="flex gap-3">
                    {[
                      { value: 'HIRE', label: 'Hire', color: 'bg-green-600 hover:bg-green-700 text-white' },
                      { value: 'CONSIDER', label: 'Consider', color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
                      { value: 'REJECT', label: 'Reject', color: 'bg-red-600 hover:bg-red-700 text-white' },
                    ].map(({ value, label, color }) => (
                      <button
                        key={value}
                        onClick={() => updateField('recommendation', value)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                          notes.recommendation === value
                            ? `${color} ring-2 ring-offset-2 ring-gray-400`
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═════ TAB: Candidate Info ═════ */}
            {activeTab === 'candidate' && rbtProfile && (
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                  <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <User className="w-7 h-7 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rbtProfile.firstName} {rbtProfile.lastName}</h3>
                    <p className="text-sm text-gray-500">{rbtProfile.status}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Email:</span> <span className="ml-1 font-medium">{rbtProfile.email || rbtProfile.user?.email || '—'}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="ml-1 font-medium">{rbtProfile.phoneNumber || '—'}</span></div>
                    <div><span className="text-gray-500">Location:</span> <span className="ml-1 font-medium">{[rbtProfile.locationCity, rbtProfile.locationZip].filter(Boolean).join(', ') || '—'}</span></div>
                    <div><span className="text-gray-500">Transportation:</span> <span className="ml-1 font-medium">{rbtProfile.hasTransportation ? `Yes${rbtProfile.transportationDetails ? ` - ${rbtProfile.transportationDetails}` : ''}` : 'No'}</span></div>
                  </div>
                </div>

                {/* Experience */}
                <div className="p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Experience</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Years:</span> <span className="ml-1 font-medium">{rbtProfile.yearsExperience ?? '—'}</span></div>
                    <div><span className="text-gray-500">Languages:</span> <span className="ml-1 font-medium">{rbtProfile.languages || '—'}</span></div>
                    <div><span className="text-gray-500">Certifications:</span> <span className="ml-1 font-medium">{rbtProfile.certifications || '—'}</span></div>
                  </div>
                  {rbtProfile.experienceDetails && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{rbtProfile.experienceDetails}</p>
                  )}
                </div>

                {/* Availability */}
                {rbtProfile.availabilitySlots && rbtProfile.availabilitySlots.length > 0 && (
                  <div className="p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Availability</h4>
                    <div className="space-y-1.5">
                      {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => {
                        const slots = rbtProfile.availabilitySlots.filter((s) => s.dayOfWeek === day)
                        if (slots.length === 0) return null
                        return (
                          <div key={day} className="flex items-center gap-2 text-sm">
                            <span className="w-24 text-gray-500 font-medium">{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                            <span>{slots.map((s) => `${hourLabel(s.startHour)} – ${hourLabel(s.endHour)}`).join(', ')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Application Answers */}
                {rbtProfile.applicationAnswers && typeof rbtProfile.applicationAnswers === 'object' && Object.keys(rbtProfile.applicationAnswers).length > 0 && (
                  <div className="p-4 rounded-lg bg-white dark:bg-[var(--bg-secondary)] border dark:border-[var(--border-subtle)]">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Application Answers</h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(rbtProfile.applicationAnswers).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-gray-500">{k}:</span>{' '}
                          <span className="font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sticky bottom bar ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-white dark:bg-[var(--bg-secondary)] dark:border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {saving ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
          ) : lastSaved ? (
            <><CheckCircle2 className="w-3 h-3 text-green-500" /> Saved</>
          ) : dirty ? (
            <><Clock className="w-3 h-3 text-yellow-500" /> Unsaved changes</>
          ) : (
            <span>Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => saveNotes(false)} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Save Notes
          </Button>
          {interview?.status === 'SCHEDULED' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setCompletionOpen(true)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Complete Interview
            </Button>
          )}
        </div>
      </div>

      {/* ─── Completion modal ────────────────────────────────────── */}
      {completionOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Complete Interview</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Decision</Label>
                <select
                  value={completionDecision}
                  onChange={(e) => setCompletionDecision(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
                >
                  <option value="PENDING">No Decision Yet</option>
                  <option value="OFFERED">Offered</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Closing notes (optional)</Label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm resize-y"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCompletionOpen(false)}>Cancel</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleComplete} disabled={completing}>
                  {completing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Completing...</> : 'Confirm & Complete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
