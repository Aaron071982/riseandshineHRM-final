'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import WizardStepIndicator from './WizardStepIndicator'
import PublicNavBar from './PublicNavBar'
import PublicBackground from './PublicBackground'
import PublicFooter from './PublicFooter'
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle, X, Paperclip, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface ApplicationData {
  // Step 1: Personal Info
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  city: string
  state: string
  zipCode: string
  addressLine1: string
  addressLine2: string
  ethnicity: string

  // Step 2: RBT Readiness
  fortyHourCourseCompleted: string
  experienceYears: string
  preferredAgeGroups: string[]
  languages: string[]
  otherLanguage: string
  transportation: string

  // Step 3: Availability
  weekdayAvailability: { [key: string]: boolean }
  weekendAvailability: { [key: string]: boolean }
  preferredHoursRange: string
  earliestStartTime: string
  latestEndTime: string

  // Step 4: Compliance
  authorizedToWork: string
  canPassBackgroundCheck: string
  cprFirstAidCertified: string
  notes: string

  // Step 5: Files
  resume: File | null
  resumeUrl: string | null
  rbtCertificate: File | null
  cprCard: File | null

  // Honeypot
  website?: string
}

const STEPS = ['Personal Info', 'RBT Readiness', 'Availability', 'Compliance', 'Resume', 'Review']

export default function PublicRBTApplicationWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [draftToken, setDraftToken] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)

  const [data, setData] = useState<ApplicationData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    city: '',
    state: 'NY',
    zipCode: '',
    addressLine1: '',
    addressLine2: '',
    ethnicity: '',
    fortyHourCourseCompleted: '',
    experienceYears: '',
    preferredAgeGroups: [],
    languages: [],
    otherLanguage: '',
    transportation: '',
    weekdayAvailability: {},
    weekendAvailability: {},
    preferredHoursRange: '',
    earliestStartTime: '14:00',
    latestEndTime: '',
    authorizedToWork: '',
    canPassBackgroundCheck: '',
    cprFirstAidCertified: '',
    notes: '',
    resume: null,
    resumeUrl: null,
    rbtCertificate: null,
    cprCard: null,
  })

  // Auto-save draft
  useEffect(() => {
    if (currentStep > 1 && data.email) {
      const timeoutId = setTimeout(async () => {
        await saveDraft()
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [data, currentStep])

  const saveDraft = async () => {
    try {
      const response = await fetch('/api/public/apply/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          token: draftToken,
          stepData: data,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.token) {
          setDraftToken(result.token)
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error)
    }
  }

  const validateStep = (step: number): boolean => {
    setError('')
    switch (step) {
      case 1:
        if (!data.firstName || !data.lastName || !data.email || !data.phoneNumber || !data.zipCode || !data.addressLine1) {
          setError('Please fill in all required fields (marked with *)')
          return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          setError('Please enter a valid email address')
          return false
        }
        return true
      case 2:
        if (!data.fortyHourCourseCompleted) {
          setError('Please indicate if you have completed the 40-hour RBT course')
          return false
        }
        return true
      case 3:
        const hasWeekday = Object.values(data.weekdayAvailability).some(v => v)
        const hasWeekend = Object.values(data.weekendAvailability).some(v => v)
        if (!hasWeekday && !hasWeekend) {
          setError('Please select at least one day of availability')
          return false
        }
        if (!data.preferredHoursRange) {
          setError('Please select your preferred weekly hours range')
          return false
        }
        return true
      case 4:
        if (!data.authorizedToWork || !data.canPassBackgroundCheck) {
          setError('Please answer all required compliance questions')
          return false
        }
        return true
      case 5:
        if (!data.resume) {
          setError('Please upload your resume')
          return false
        }
        return true
      case 6:
        if (!consent) {
          setError('Please confirm that the information provided is accurate')
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleFileChange = (field: 'resume' | 'rbtCertificate' | 'cprCard', file: File | null) => {
    if (field === 'resume' && file) {
      // Validate resume file
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        setError(`Resume file size exceeds 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`)
        return
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        setError('Resume must be a PDF, DOC, or DOCX file')
        return
      }
    }

    setData({ ...data, [field]: file })
    setError('')
  }

  const handleSubmit = async () => {
    if (!validateStep(6)) return

    setSubmitting(true)
    setError('')

    try {
      // Upload resume first
      if (!data.resume) {
        setError('Please upload your resume')
        setSubmitting(false)
        return
      }

      let resumeUrl = data.resumeUrl

      if (!resumeUrl) {
        const formData = new FormData()
        formData.append('file', data.resume)
        if (draftToken) {
          formData.append('token', draftToken)
        }

        const uploadResponse = await fetch('/api/public/apply/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to upload resume')
        }

        const uploadResult = await uploadResponse.json()
        resumeUrl = uploadResult.url
      }

      // Submit application
      const submitResponse = await fetch('/api/public/apply/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          resumeUrl,
          resumeFileName: data.resume?.name || null,
          resumeMimeType: data.resume?.type || null,
          resumeSize: data.resume?.size || null,
          draftToken: draftToken,
          website: data.website || '', // Honeypot
        }),
      })

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json()
        throw new Error(errorData.error || 'Failed to submit application')
      }

      const result = await submitResponse.json()
      router.push(`/apply/success?id=${result.id}`)
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Personal Information</h2>
              <p className="text-gray-600 leading-relaxed">Please provide your basic information.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={data.firstName}
                  onChange={(e) => setData({ ...data, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={data.lastName}
                  onChange={(e) => setData({ ...data, lastName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={data.phoneNumber}
                  onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
                  placeholder="3473090431"
                  required
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={data.city}
                  onChange={(e) => setData({ ...data, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={data.state}
                  onChange={(e) => setData({ ...data, state: e.target.value })}
                  maxLength={2}
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Zip Code *</Label>
                <Input
                  id="zipCode"
                  value={data.zipCode}
                  onChange={(e) => setData({ ...data, zipCode: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  value={data.addressLine1}
                  onChange={(e) => setData({ ...data, addressLine1: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={data.addressLine2}
                  onChange={(e) => setData({ ...data, addressLine2: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ethnicity">Ethnicity</Label>
                <Select
                  value={data.ethnicity}
                  onValueChange={(value) => setData({ ...data, ethnicity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ethnicity (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHITE">White</SelectItem>
                    <SelectItem value="ASIAN">Asian</SelectItem>
                    <SelectItem value="BLACK">Black</SelectItem>
                    <SelectItem value="HISPANIC">Hispanic</SelectItem>
                    <SelectItem value="SOUTH_ASIAN">South Asian</SelectItem>
                    <SelectItem value="MIDDLE_EASTERN">Middle Eastern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Honeypot */}
            <div className="hidden">
              <Label htmlFor="website">Website (leave blank)</Label>
              <Input
                id="website"
                type="text"
                value={data.website || ''}
                onChange={(e) => setData({ ...data, website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">RBT Readiness</h2>
              <p className="text-gray-600">Tell us about your RBT qualifications and experience.</p>
            </div>
            <div className="space-y-6">
              <div>
                <Label htmlFor="fortyHourCourseCompleted">40-Hour RBT Course Already Completed? *</Label>
                <Select
                  value={data.fortyHourCourseCompleted}
                  onValueChange={(value) => setData({ ...data, fortyHourCourseCompleted: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
                {data.fortyHourCourseCompleted === 'false' && (
                  <p className="text-sm text-gray-500 mt-2">
                    If &quot;No&quot;, you will need to complete the 40-hour course and upload the certificate during onboarding.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="experienceYears">Years of Experience</Label>
                <Select
                  value={data.experienceYears}
                  onValueChange={(value) => setData({ ...data, experienceYears: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 years</SelectItem>
                    <SelectItem value="1">1 year</SelectItem>
                    <SelectItem value="2">2 years</SelectItem>
                    <SelectItem value="3">3 years</SelectItem>
                    <SelectItem value="4">4 years</SelectItem>
                    <SelectItem value="5">5 years</SelectItem>
                    <SelectItem value="6-10">6-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred Client Age Groups</Label>
                <div className="space-y-2 mt-2">
                  {['Toddler (2-4)', 'Preschool (4-6)', 'Elementary (6-10)', 'Pre-teen (10-13)', 'Teen (13+)'].map((age) => (
                    <div key={age} className="flex items-center space-x-2">
                      <Checkbox
                        id={`age-${age}`}
                        checked={data.preferredAgeGroups.includes(age)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setData({ ...data, preferredAgeGroups: [...data.preferredAgeGroups, age] })
                          } else {
                            setData({ ...data, preferredAgeGroups: data.preferredAgeGroups.filter(a => a !== age) })
                          }
                        }}
                      />
                      <Label htmlFor={`age-${age}`} className="font-normal cursor-pointer">{age}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Languages Spoken</Label>
                <div className="space-y-2 mt-2">
                  {['English', 'Spanish', 'French', 'Mandarin', 'Arabic', 'Other'].map((lang) => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lang-${lang}`}
                        checked={data.languages.includes(lang)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setData({ ...data, languages: [...data.languages, lang] })
                          } else {
                            setData({ ...data, languages: data.languages.filter(l => l !== lang) })
                          }
                        }}
                      />
                      <Label htmlFor={`lang-${lang}`} className="font-normal cursor-pointer">{lang}</Label>
                    </div>
                  ))}
                </div>
                {data.languages.includes('Other') && (
                  <Input
                    className="mt-2"
                    placeholder="Please specify"
                    value={data.otherLanguage}
                    onChange={(e) => setData({ ...data, otherLanguage: e.target.value })}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="transportation">Reliable Transportation?</Label>
                <Select
                  value={data.transportation}
                  onValueChange={(value) => setData({ ...data, transportation: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Availability</h2>
              <p className="text-gray-600">
                Most RBT sessions occur after 2PM on weekdays and on weekends. Please indicate your availability.
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <Label>Weekday Availability (after 2PM)</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`weekday-${day}`}
                        checked={data.weekdayAvailability[day] || false}
                        onCheckedChange={(checked) => {
                          setData({
                            ...data,
                            weekdayAvailability: { ...data.weekdayAvailability, [day]: checked as boolean },
                          })
                        }}
                      />
                      <Label htmlFor={`weekday-${day}`} className="font-normal cursor-pointer">{day}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Weekend Availability</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {['Saturday', 'Sunday'].map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`weekend-${day}`}
                        checked={data.weekendAvailability[day] || false}
                        onCheckedChange={(checked) => {
                          setData({
                            ...data,
                            weekendAvailability: { ...data.weekendAvailability, [day]: checked as boolean },
                          })
                        }}
                      />
                      <Label htmlFor={`weekend-${day}`} className="font-normal cursor-pointer">{day}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="preferredHoursRange">Preferred Weekly Hours Range *</Label>
                <Select
                  value={data.preferredHoursRange}
                  onValueChange={(value) => setData({ ...data, preferredHoursRange: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10-15">10-15 hours</SelectItem>
                    <SelectItem value="15-25">15-25 hours</SelectItem>
                    <SelectItem value="25-35">25-35 hours</SelectItem>
                    <SelectItem value="35+">35+ hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="earliestStartTime">Earliest Start Time</Label>
                  <Input
                    id="earliestStartTime"
                    type="time"
                    value={data.earliestStartTime}
                    onChange={(e) => setData({ ...data, earliestStartTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="latestEndTime">Latest End Time</Label>
                  <Input
                    id="latestEndTime"
                    type="time"
                    value={data.latestEndTime}
                    onChange={(e) => setData({ ...data, latestEndTime: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Compliance & Eligibility</h2>
              <p className="text-gray-600">Please confirm your eligibility and compliance requirements.</p>
            </div>
            <div className="space-y-6">
              <div>
                <Label htmlFor="authorizedToWork">Are you authorized to work in the US? *</Label>
                <Select
                  value={data.authorizedToWork}
                  onValueChange={(value) => setData({ ...data, authorizedToWork: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="canPassBackgroundCheck">Can you pass a background check? *</Label>
                <Select
                  value={data.canPassBackgroundCheck}
                  onValueChange={(value) => setData({ ...data, canPassBackgroundCheck: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cprFirstAidCertified">CPR/First Aid Certified?</Label>
                <Select
                  value={data.cprFirstAidCertified}
                  onValueChange={(value) => setData({ ...data, cprFirstAidCertified: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="not-yet">Not yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={data.notes}
                  onChange={(e) => setData({ ...data, notes: e.target.value })}
                  placeholder="Any additional information you'd like to share..."
                />
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Resume & Documents</h2>
              <p className="text-gray-600">Please upload your resume and any relevant documents.</p>
            </div>
            <div className="space-y-6">
              <div>
                <Label htmlFor="resume">Resume * (PDF, DOC, or DOCX, max 10MB)</Label>
                <div className="mt-2">
                  <label
                    htmlFor="resume"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-card bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-primary transition-colors" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOC, or DOCX (MAX. 10MB)</p>
                    </div>
                    <input
                      id="resume"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange('resume', e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {data.resume && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-white border border-gray-200 rounded-input flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{data.resume.name}</p>
                          <p className="text-xs text-gray-500">
                            {(data.resume.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange('resume', null)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="rbtCertificate">RBT Certificate (Optional)</Label>
                <div className="mt-2">
                  <Input
                    id="rbtCertificate"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('rbtCertificate', e.target.files?.[0] || null)}
                  />
                  {data.rbtCertificate && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4" />
                      <span>{data.rbtCertificate.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="cprCard">CPR/First Aid Card (Optional)</Label>
                <div className="mt-2">
                  <Input
                    id="cprCard"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('cprCard', e.target.files?.[0] || null)}
                  />
                  {data.cprCard && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4" />
                      <span>{data.cprCard.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Review & Submit</h2>
              <p className="text-gray-600">Please review your information before submitting.</p>
            </div>
            <div className="space-y-6">
              <Card className="bg-white rounded-card border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-semibold text-gray-900">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Name:</strong> {data.firstName} {data.lastName}</p>
                  <p><strong>Email:</strong> {data.email}</p>
                  <p><strong>Phone:</strong> {data.phoneNumber}</p>
                  <p><strong>Address:</strong> {data.addressLine1} {data.addressLine2 && `, ${data.addressLine2}`}</p>
                  <p><strong>City, State ZIP:</strong> {data.city} {data.state} {data.zipCode}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>RBT Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>40-Hour Course Completed:</strong> {data.fortyHourCourseCompleted === 'true' ? 'Yes' : 'No'}</p>
                  <p><strong>Experience:</strong> {data.experienceYears || 'Not specified'}</p>
                  <p><strong>Preferred Age Groups:</strong> {data.preferredAgeGroups.length > 0 ? data.preferredAgeGroups.join(', ') : 'None'}</p>
                  <p><strong>Languages:</strong> {data.languages.length > 0 ? [...data.languages, data.otherLanguage].filter(Boolean).join(', ') : 'None'}</p>
                  <p><strong>Transportation:</strong> {data.transportation === 'true' ? 'Yes' : data.transportation === 'false' ? 'No' : 'Not specified'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold text-gray-900">Availability</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Weekday Availability:</strong> {Object.keys(data.weekdayAvailability).filter(k => data.weekdayAvailability[k]).join(', ') || 'None'}</p>
                  <p><strong>Weekend Availability:</strong> {Object.keys(data.weekendAvailability).filter(k => data.weekendAvailability[k]).join(', ') || 'None'}</p>
                  <p><strong>Preferred Hours:</strong> {data.preferredHoursRange}</p>
                  <p><strong>Time Range:</strong> {data.earliestStartTime} - {data.latestEndTime}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Compliance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Authorized to Work:</strong> {data.authorizedToWork === 'true' ? 'Yes' : 'No'}</p>
                  <p><strong>Background Check:</strong> {data.canPassBackgroundCheck === 'true' ? 'Yes' : 'No'}</p>
                  <p><strong>CPR/First Aid:</strong> {data.cprFirstAidCertified || 'Not specified'}</p>
                  {data.notes && <p><strong>Notes:</strong> {data.notes}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold text-gray-900">Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Resume:</strong> {data.resume ? data.resume.name : 'Not uploaded'}</p>
                  {data.rbtCertificate && <p><strong>RBT Certificate:</strong> {data.rbtCertificate.name}</p>}
                  {data.cprCard && <p><strong>CPR Card:</strong> {data.cprCard.name}</p>}
                </CardContent>
              </Card>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked as boolean)}
                  required
                />
                <Label htmlFor="consent" className="font-normal cursor-pointer">
                  I confirm that the information provided is accurate and complete. I understand that providing false information may result in rejection of my application.
                </Label>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const tips = [
    'Have your resume ready (PDF, DOC, or DOCX format)',
    'Most sessions occur after 2PM on weekdays and on weekends',
    'Weekend availability is highly valued',
    'If you don&apos;t have RBT certification, we can help you obtain it',
  ]

  return (
    <div className="min-h-screen bg-white relative">
      <PublicBackground variant="page" />
      <PublicNavBar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Wizard Content */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                className="bg-white/90 backdrop-blur-md rounded-cardLg border border-gray-200/50 shadow-cardGlow relative overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                }}
              >
            <CardHeader className="pb-6">
              <CardTitle className="text-3xl text-center font-semibold text-gray-900">
                RBT Application
              </CardTitle>
              <CardDescription className="text-center text-base text-gray-600">
                Join our team and make a difference in children&apos;s lives
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <WizardStepIndicator currentStep={currentStep} totalSteps={STEPS.length} steps={STEPS} />
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-red-50 border-2 border-red-200 rounded-input text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="mb-8"
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <motion.div
                  whileHover={{ scale: currentStep === 1 ? 1 : 1.02 }}
                  whileTap={{ scale: currentStep === 1 ? 1 : 0.98 }}
                >
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || submitting}
                    className="rounded-button border-2 border-gray-300 hover:bg-gray-50 transition-all duration-200"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </motion.div>
                {currentStep < STEPS.length ? (
                  <motion.div
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                  >
                    <Button
                      onClick={handleNext}
                      disabled={submitting}
                      className="gradient-primary text-white border-0 rounded-button shadow-button hover:shadow-buttonHover transition-all duration-200"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                  >
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="gradient-primary text-white border-0 rounded-button shadow-button hover:shadow-buttonHover transition-all duration-200"
                    >
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

          {/* Sidebar - Tips Card (Desktop only) */}
          <div className="hidden lg:block">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="sticky top-24"
            >
              <Card className="bg-gradient-to-br from-orange-50 to-blue-50 rounded-card border border-primary/20 shadow-cardHover">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl font-semibold text-gray-900">Tips Before You Apply</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-600">
                    Helpful information to prepare your application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                        <span className="leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
