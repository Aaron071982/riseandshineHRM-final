'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PublicBackground from '@/components/public/PublicBackground'
import PublicNavBar from '@/components/public/PublicNavBar'
import PublicFooter from '@/components/public/PublicFooter'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, Clock, AlertCircle, CheckCircle2, Video, Users, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { getEasternDate } from '@/lib/eastern-time'

type Interviewer = {
  id: string
  firstName: string
  daysOfWeek: number[]
}

type Slot = {
  slotId: string
  interviewerId: string
  interviewerName: string
  startTime: string
  endTime: string
  isBooked: boolean
}

type ExistingInterview = {
  scheduledAt: string
  durationMinutes: number
  interviewerName: string
  meetingUrl: string | null
}

const DAY_ABBR: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

function formatTimeEastern(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateEastern(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toDateKeyUTC(utcDate: Date): string {
  const ymd = getEasternDate(utcDate)
  return `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`
}

function formatGoogleDateForUrl(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function buildGoogleCalendarUrl(params: { title: string; startIso: string; endIso: string; details?: string; location?: string }) {
  const start = formatGoogleDateForUrl(new Date(params.startIso))
  const end = formatGoogleDateForUrl(new Date(params.endIso))
  const text = encodeURIComponent(params.title)
  const details = encodeURIComponent(params.details || '')
  const location = encodeURIComponent(params.location || '')

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`
}

export default function CalendlyInterviewScheduler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const rbtId = searchParams.get('rbtId')
  const isReschedule = searchParams.get('reschedule') === '1'

  const { showToast } = useToast()

  const [initialLoading, setInitialLoading] = useState(true)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState<string>('')

  const [rbtName, setRbtName] = useState('')
  const [existingInterview, setExistingInterview] = useState<ExistingInterview | null>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [interviewersLoading, setInterviewersLoading] = useState(false)
  const [interviewers, setInterviewers] = useState<Interviewer[]>([])

  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string | null>(null)

  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({})

  const [selectedDateKey, setSelectedDateKey] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState<{
    interviewId: string
    scheduledAt: string
    durationMinutes: number
    interviewerName: string
    meetingUrl: string | null
  } | null>(null)

  useEffect(() => {
    const validateToken = async () => {
      if (!token || !rbtId) {
        setError('Invalid scheduling link. Please contact support.')
        setValidating(false)
        setInitialLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/public/validate-scheduling-token?token=${token}&rbtId=${rbtId}`)
        const data = await response.json()

        if (response.ok && data.valid) {
          setRbtName(data.rbtName)
          if (data.existingInterview) setExistingInterview(data.existingInterview)
          setValidating(false)
          setInitialLoading(false)
          return
        }

        setError(data.error || 'Invalid or expired scheduling link.')
        setValidating(false)
        setInitialLoading(false)
      } catch {
        setError('An error occurred. Please try again.')
        setValidating(false)
        setInitialLoading(false)
      }
    }

    validateToken()
  }, [token, rbtId])

  useEffect(() => {
    if (!token || !rbtId) return
    if (existingInterview && !isReschedule) return

    const loadInterviewers = async () => {
      setInterviewersLoading(true)
      try {
        const res = await fetch('/api/public/interviewers')
        const data = await res.json()
        if (res.ok) setInterviewers(Array.isArray(data) ? data : [])
        else showToast(data.error || 'Failed to load interviewers', 'error')
      } catch {
        showToast('Failed to load interviewers', 'error')
      } finally {
        setInterviewersLoading(false)
      }
    }

    if (step === 1) loadInterviewers()
  }, [token, rbtId, existingInterview, isReschedule, step, showToast])

  const availabilityDates = useMemo(() => {
    const baseUTC = new Date()
    baseUTC.setUTCHours(0, 0, 0, 0)
    const days: string[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(baseUTC.getTime() + i * 86400000)
      days.push(toDateKeyUTC(d))
    }
    return days
  }, [])

  const allSlots = useMemo(() => {
    const slots: Slot[] = []
    for (const dayKey of Object.keys(slotsByDate)) {
      for (const s of slotsByDate[dayKey] || []) slots.push(s)
    }
    return slots
  }, [slotsByDate])

  const earliestAvailableDateKey = useMemo(() => {
    const byDateKeys = Object.keys(slotsByDate).sort()
    for (const key of byDateKeys) {
      const slots = slotsByDate[key] ?? []
      if (slots.some((s) => !s.isBooked)) return key
    }
    return ''
  }, [slotsByDate])

  useEffect(() => {
    if (step !== 2) return

    const loadSlots = async () => {
      setSlotsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('daysAhead', '30')
        if (selectedInterviewerId) params.set('interviewerId', selectedInterviewerId)

        const res = await fetch(`/api/public/interviewer-slots?${params.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          showToast(data.error || 'Failed to load times', 'error')
          return
        }

        const normalized = (data && typeof data === 'object' ? data : {}) as Record<string, Slot[]>
        setSlotsByDate(normalized)

        const earliestKey = Object.keys(normalized).sort().find((key) => (normalized[key] ?? []).some((s) => !s.isBooked)) || ''
        setSelectedDateKey(earliestKey)
      } catch {
        showToast('Failed to load times', 'error')
      } finally {
        setSlotsLoading(false)
      }
    }

    loadSlots()
  }, [step, selectedInterviewerId, showToast])

  const selectedDateSlots = useMemo(() => {
    if (!selectedDateKey) return []
    return slotsByDate[selectedDateKey] ?? []
  }, [selectedDateKey, slotsByDate])

  const selectedSlot = useMemo(() => {
    return selectedDateSlots.find((s) => s.slotId === selectedSlotId) ?? null
  }, [selectedSlotId, selectedDateSlots])

  useEffect(() => {
    // When the selected date changes, ensure selected slot is still valid.
    if (!selectedDateKey) return
    const slots = slotsByDate[selectedDateKey] ?? []
    if (selectedSlotId && !slots.some((s) => s.slotId === selectedSlotId)) {
      setSelectedSlotId('')
    }
  }, [selectedDateKey, slotsByDate, selectedSlotId])

  const availableCountForAnyDate = useMemo(() => {
    return allSlots.filter((s) => !s.isBooked).length
  }, [allSlots])

  const onSelectInterviewer = (interviewerId: string) => {
    setSelectedInterviewerId(interviewerId)
    setStep(2)
  }

  const onSelectAll = () => {
    setSelectedInterviewerId(null)
    setStep(2)
  }

  const confirmBooking = async () => {
    if (!token || !rbtId) return
    if (!selectedSlot) return

    setConfirming(true)
    setError('')
    try {
      const res = await fetch('/api/public/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rbtId,
          slotId: selectedSlot.slotId,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to schedule interview. Please try again.')
        setConfirming(false)
        return
      }

      setSuccess({
        interviewId: data.interviewId,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        interviewerName: data.interviewerName,
        meetingUrl: data.meetingUrl ?? null,
      })
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  if (initialLoading || validating) {
    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Validating your scheduling link...</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (success) {
    const googleUrl = buildGoogleCalendarUrl({
      title: `Interview with ${success.interviewerName} — Rise and Shine`,
      startIso: success.scheduledAt,
      endIso: new Date(new Date(success.scheduledAt).getTime() + success.durationMinutes * 60 * 1000).toISOString(),
      details: 'Rise and Shine ABA interview',
      location: success.meetingUrl || undefined,
    })

    const icsDownloadUrl = `/api/public/calendar/ics?token=${encodeURIComponent(token || '')}&interviewId=${encodeURIComponent(success.interviewId)}`

    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="max-w-md w-full">
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Interview Confirmed!</h2>
                <p className="text-gray-600 mb-4">
                  {formatTimeEastern(success.scheduledAt)} — {success.interviewerName}
                </p>

                <div className="space-y-3">
                  <div className="text-sm text-gray-600">{`You'll receive a confirmation email shortly`}</div>
                  <div className="flex flex-col gap-3 mt-3">
                    <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gradient-primary text-white">Add to Google Calendar</Button>
                    </a>
                    <a href={icsDownloadUrl}>
                      <Button variant="outline" className="w-full border-2 border-gray-300">
                        Download calendar file (.ics)
                      </Button>
                    </a>
                    <p className="text-xs text-gray-500">
                      Open the file to add this interview to Apple Calendar, Outlook, or other calendar apps.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-red-200 shadow-cardGlow">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Scheduling unavailable</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <Link href="/">
                  <Button className="gradient-primary text-white">Return to Home</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (existingInterview && !isReschedule) {
    const scheduledDate = new Date(existingInterview.scheduledAt)
    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-orange-200 shadow-cardGlow">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-orange-700" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Already scheduled</h2>
                <p className="text-gray-600 mb-4">
                  You already have an interview scheduled for{' '}
                  <strong>{scheduledDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}</strong>. Check your email for the meeting link.
                </p>
                <Button
                  onClick={() => {
                    if (token && rbtId) {
                      router.replace(
                        `/schedule-interview?token=${encodeURIComponent(token)}&rbtId=${encodeURIComponent(rbtId)}&reschedule=1`
                      )
                    }
                  }}
                  className="w-full gradient-primary text-white"
                  disabled={interviewersLoading || slotsLoading}
                >
                  Reschedule interview
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <PublicFooter />
      </div>
    )
  }

  const StepIndicator = (
    <div className="flex items-center justify-center gap-3 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center border',
              step === s
                ? 'bg-orange-600 border-orange-600 text-white'
                : step > s
                  ? 'bg-green-100 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-500'
            )}
          >
            {s}
          </div>
          {s < 3 && <div className="w-10 h-0.5 bg-gray-200" />}
        </div>
      ))}
    </div>
  )

  const title =
    isReschedule && existingInterview ? 'Reschedule your interview' : 'Schedule Your Interview with Rise and Shine ABA'
  const subtitle = step === 1 ? 'Select an interviewer to see their available times' : step === 2 ? 'Choose a date and time' : 'Confirm your booking'

  return (
    <div className="min-h-screen bg-white relative">
      <PublicBackground variant="page" />
      <PublicNavBar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="text-center mb-6">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt="Rise and Shine" width={180} height={72} className="object-contain mx-auto" />
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">{title}</h1>
            <p className="text-lg text-gray-600">{subtitle}</p>
          </div>

          {isReschedule && existingInterview && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
              <p className="font-semibold text-amber-900">Rescheduling</p>
              <p className="mt-1 text-amber-900/90">
                Current interview:{' '}
                <strong>
                  {new Date(existingInterview.scheduledAt).toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </strong>{' '}
                with {existingInterview.interviewerName}. When you confirm a new time, that booking will be replaced automatically.
              </p>
            </div>
          )}

          {StepIndicator}

          {step === 1 && (
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="h-6 w-6 text-orange-600" />
                  Choose an interviewer
                </CardTitle>
                <CardContent className="p-0" />
              </CardHeader>
              <CardContent>
                {interviewersLoading && (
                  <div className="py-10 text-center text-gray-600">
                    <div className="animate-spin mx-auto rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
                    Loading interviewers...
                  </div>
                )}

                {!interviewersLoading && interviewers.length === 0 && (
                  <div className="py-8">
                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                      <p className="font-semibold text-gray-900 mb-1">Our team is currently setting up scheduling.</p>
                      <p className="text-gray-600 text-sm">Please check back soon or contact us at info@riseandshine.nyc</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {interviewers.map((interviewer) => {
                    const initial = interviewer.firstName?.[0]?.toUpperCase() || '?'
                    return (
                      <div key={interviewer.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-orange-700 font-bold text-lg">{initial}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{interviewer.firstName}</div>
                            <div className="text-sm text-gray-500">Interview Coordinator</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {interviewer.daysOfWeek.map((d) => (
                                <span key={d} className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">
                                  {DAY_ABBR[d]}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => onSelectInterviewer(interviewer.id)} className="gradient-primary text-white">
                          Select
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 text-center">
                  <button type="button" onClick={onSelectAll} className="text-orange-600 font-semibold hover:underline flex items-center justify-center gap-1">
                    Don&apos;t have a preference? <span>View all available times →</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-orange-600" />
                  Pick a date & time
                </CardTitle>
              </CardHeader>

              <CardContent>
                {slotsLoading && (
                  <div className="py-10 text-center text-gray-600">
                    <div className="animate-spin mx-auto rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
                    Loading available times...
                  </div>
                )}

                {!slotsLoading && availableCountForAnyDate === 0 && (
                  <div className="py-6">
                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                      <p className="font-semibold text-gray-900 mb-1">All available times are currently taken.</p>
                      <p className="text-gray-600 text-sm">
                        Please email <a className="text-orange-600 font-semibold" href="mailto:info@riseandshine.nyc">info@riseandshine.nyc</a> to schedule manually.
                      </p>
                    </div>
                  </div>
                )}

                {!slotsLoading && availableCountForAnyDate > 0 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-800">Choose a date</div>
                        <Badge className="bg-orange-50 text-orange-700 border border-orange-200">Next 30 days</Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availabilityDates.map((dateKey) => {
                          const daySlots = slotsByDate[dateKey] ?? []
                          const hasAnySlot = daySlots.length > 0
                          const hasAvailable = daySlots.some((s) => !s.isBooked)
                          const isSelected = selectedDateKey === dateKey

                          const dateObj = new Date(`${dateKey}T12:00:00.000Z`)

                          return (
                            <button
                              key={dateKey}
                              type="button"
                              disabled={!hasAnySlot}
                              onClick={() => setSelectedDateKey(dateKey)}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-left transition',
                                isSelected ? 'border-orange-500 bg-orange-50' : hasAvailable ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white',
                                !hasAnySlot && 'opacity-40 cursor-not-allowed bg-gray-50'
                              )}
                            >
                              <div className="text-xs text-gray-500 font-medium">{formatDateEastern(dateObj).split(', ')[0]}</div>
                              <div className="font-semibold text-gray-900">{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <div className="text-sm font-semibold text-gray-800">Choose a time</div>
                      </div>

                      {selectedDateSlots.length === 0 ? (
                        <p className="text-sm text-gray-500">Select an available date to see times.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedDateSlots
                            .slice()
                            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                            .map((slot) => {
                              const isSelected = slot.slotId === selectedSlotId
                              return (
                                <button
                                  key={slot.slotId}
                                  type="button"
                                  disabled={slot.isBooked}
                                  onClick={() => setSelectedSlotId(slot.slotId)}
                                  className={cn(
                                    'px-3 py-2 rounded-full border text-sm font-semibold transition',
                                    isSelected ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-900',
                                    slot.isBooked ? 'opacity-40 cursor-not-allowed' : 'hover:border-orange-300 hover:bg-orange-50'
                                  )}
                                >
                                  <span className="flex items-center gap-2">
                                    {formatTimeEastern(slot.startTime)}
                                    {slot.isBooked && <span className="text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">Taken</span>}
                                  </span>
                                </button>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-2 border-gray-300">
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(3)}
                        disabled={!selectedSlot}
                        className="flex-1 gradient-primary text-white"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Video className="h-6 w-6 text-orange-600" />
                  Confirm booking
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedSlot ? (
                  <div className="py-10 text-center text-gray-600">Select a slot to continue.</div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                      <div className="text-sm text-gray-700 font-medium">You&apos;re booking with</div>
                      <div className="text-xl font-bold text-gray-900">{selectedSlot.interviewerName}</div>
                      <div className="mt-3 space-y-2 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-orange-600" />
                          <span>
                            {new Date(selectedSlot.startTime).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span>
                            {Math.round((new Date(selectedSlot.endTime).getTime() - new Date(selectedSlot.startTime).getTime()) / 60000)} minutes
                          </span>
                        </div>
                        <div>Format: Video call (Google Meet)</div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      You&apos;ll receive a confirmation email with the meeting link.
                    </div>

                    {error && (
                      <div className="text-sm text-red-600 bg-red-50 border-2 border-red-200 p-3 rounded-lg flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-2 border-gray-300">
                        Back
                      </Button>
                      <Button onClick={confirmBooking} disabled={confirming} className="flex-1 gradient-primary text-white">
                        {confirming ? 'Confirming...' : 'Confirm Interview'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
      <PublicFooter />
    </div>
  )
}

