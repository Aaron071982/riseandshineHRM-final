'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import PublicBackground from '@/components/public/PublicBackground'
import PublicNavBar from '@/components/public/PublicNavBar'
import PublicFooter from '@/components/public/PublicFooter'
import Image from 'next/image'
import Link from 'next/link'

interface TimeSlot {
  value: string
  label: string
}

const TIME_SLOTS: TimeSlot[] = [
  { value: '11:00', label: '11:00 AM' },
  { value: '11:15', label: '11:15 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '11:45', label: '11:45 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:15', label: '12:15 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '12:45', label: '12:45 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:15', label: '1:15 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '13:45', label: '1:45 PM' },
  { value: '14:00', label: '2:00 PM' },
]

export default function ScheduleInterviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const rbtId = searchParams.get('rbtId')

  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [rbtName, setRbtName] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')

  useEffect(() => {
    const validateToken = async () => {
      if (!token || !rbtId) {
        setError('Invalid scheduling link. Please contact support.')
        setValidating(false)
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/public/validate-scheduling-token?token=${token}&rbtId=${rbtId}`)
        const data = await response.json()

        if (response.ok && data.valid) {
          setRbtName(data.rbtName)
          setValidating(false)
          setLoading(false)
        } else {
          setError(data.error || 'Invalid or expired scheduling link.')
          setValidating(false)
          setLoading(false)
        }
      } catch (err) {
        setError('An error occurred. Please try again.')
        setValidating(false)
        setLoading(false)
      }
    }

    validateToken()
  }, [token, rbtId])

  const getMinDate = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString().split('T')[0]
  }

  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 60) // 60 days ahead
    return maxDate.toISOString().split('T')[0]
  }

  const isDateValid = (dateString: string) => {
    if (!dateString) return false
    const date = new Date(dateString)
    const dayOfWeek = date.getDay()
    // Sunday = 0, Monday = 1, ..., Thursday = 4
    return dayOfWeek >= 0 && dayOfWeek <= 4 // Sunday through Thursday
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value
    if (isDateValid(date)) {
      setSelectedDate(date)
      setError('')
    } else {
      setError('Please select a date from Sunday through Thursday.')
      setSelectedDate('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (!selectedDate || !selectedTime) {
      setError('Please select both a date and time.')
      setSubmitting(false)
      return
    }

    if (!isDateValid(selectedDate)) {
      setError('Please select a date from Sunday through Thursday.')
      setSubmitting(false)
      return
    }

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const scheduledDateTime = new Date(selectedDate)
      scheduledDateTime.setHours(hours, minutes, 0, 0)

      const response = await fetch('/api/public/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rbtId,
          scheduledAt: scheduledDateTime.toISOString(),
          durationMinutes: 15,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        setError(data.error || 'Failed to schedule interview. Please try again.')
        setSubmitting(false)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading || validating) {
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
    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Interview Scheduled!</h2>
                <p className="text-gray-600 mb-4">
                  Your interview has been successfully scheduled. You&apos;ll receive a confirmation email shortly.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to home page...
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (error && !rbtName) {
    return (
      <div className="min-h-screen bg-white relative">
        <PublicBackground variant="page" />
        <PublicNavBar />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-red-200 shadow-cardGlow">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
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

  return (
    <div className="min-h-screen bg-white relative">
      <PublicBackground variant="page" />
      <PublicNavBar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <Image
                src="/logo.png"
                alt="Rise and Shine"
                width={180}
                height={72}
                className="object-contain mx-auto"
              />
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Schedule Your Interview
            </h1>
            <p className="text-lg text-gray-600">
              Hello {rbtName}! Please select your preferred date and time below.
            </p>
          </div>

          <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow">
            <CardHeader>
              <CardTitle className="text-2xl">Interview Scheduling</CardTitle>
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-2">Available Times:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span><strong>Days:</strong> Sunday through Thursday</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span><strong>Time:</strong> 11:00 AM to 2:00 PM</span>
                  </li>
                  <li><strong>Duration:</strong> 15 minutes</li>
                </ul>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Select Date (Sunday - Thursday)
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    min={getMinDate()}
                    max={getMaxDate()}
                    required
                    disabled={submitting}
                    className="h-12 border-2 border-gray-200 rounded-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  />
                  {selectedDate && !isDateValid(selectedDate) && (
                    <p className="text-sm text-red-600">Please select a date from Sunday through Thursday.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Select Time
                  </Label>
                  <select
                    id="time"
                    value={selectedTime}
                    onChange={(e) => {
                      setSelectedTime(e.target.value)
                      setError('')
                    }}
                    required
                    disabled={submitting || !selectedDate}
                    className="w-full h-12 border-2 border-gray-200 rounded-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 px-3 text-gray-900 bg-white"
                  >
                    <option value="">Choose a time</option>
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 bg-red-50 border-2 border-red-200 p-3 rounded-input flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-4">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1"
                  >
                    <Button
                      type="submit"
                      disabled={submitting || !selectedDate || !selectedTime}
                      className="w-full h-12 gradient-primary text-white border-0 rounded-button font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Scheduling...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Confirm Interview
                        </span>
                      )}
                    </Button>
                  </motion.div>
                  <Link href="/">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      className="h-12 border-2 border-gray-300 rounded-button font-semibold"
                    >
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <PublicFooter />
    </div>
  )
}
