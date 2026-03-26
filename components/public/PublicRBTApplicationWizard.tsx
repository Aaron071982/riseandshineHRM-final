'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import WizardStepIndicator from './WizardStepIndicator'
import PublicNavBar from './PublicNavBar'
import PublicBackground from './PublicBackground'
import PublicFooter from './PublicFooter'
import { ArrowLeft, ArrowRight, CheckCircle, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ApplicationStepPersonalInfo,
  ApplicationStepRBTReadiness,
  ApplicationStepAvailability,
  ApplicationStepCompliance,
  ApplicationStepFiles,
  ApplicationStepReview,
} from './application-wizard'
import type { ApplicationData } from './application-wizard'

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
    gender: '',
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
    idDocument: null,
    idDocumentUrl: null,
    rbtCertificate: null,
    cprCard: null,
  })

  const saveDraft = useCallback(async () => {
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
  }, [data, draftToken])

  // Auto-save draft
  useEffect(() => {
    if (currentStep > 1 && data.email) {
      const timeoutId = setTimeout(() => {
        saveDraft()
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [currentStep, data.email, saveDraft])

  const validateStep = (step: number): boolean => {
    setError('')
    switch (step) {
      case 1:
        if (!data.firstName || !data.lastName || !data.email || !data.phoneNumber || !data.zipCode || !data.addressLine1) {
          setError('Please fill in all required fields (marked with *)')
          return false
        }
        if (!data.gender) {
          setError('Please select your gender')
          return false
        }
        if (!data.ethnicity) {
          setError('Please select your ethnicity')
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
        if (!data.idDocument) {
          setError('Please upload your government-issued ID')
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

  const handleFileChange = (field: 'resume' | 'idDocument' | 'rbtCertificate' | 'cprCard', file: File | null) => {
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (field === 'resume' && file) {
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
    if (field === 'idDocument' && file) {
      if (file.size > maxSize) {
        setError(`ID file size exceeds 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`)
        return
      }
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        setError('ID must be a PDF, JPG, or PNG file')
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
      if (!data.resume) {
        setError('Please upload your resume')
        setSubmitting(false)
        return
      }
      if (!data.idDocument) {
        setError('Please upload your government-issued ID')
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
          let message = 'Failed to upload resume'
          try {
            const errorData = await uploadResponse.json()
            if (errorData?.error) message = errorData.error
          } catch {
            if (uploadResponse.status === 429) {
              message = 'Too many resume uploads. Please wait a minute and try again.'
            } else if (uploadResponse.status === 413) {
              message = 'File is too large for upload. Please use a smaller file.'
            } else {
              message = `Failed to upload resume (status ${uploadResponse.status})`
            }
          }
          throw new Error(message)
        }

        const uploadResult = await uploadResponse.json()
        resumeUrl = uploadResult.url
      }

      let rbtCertificateUrl: string | null = null
      let rbtCertificateFileName: string | null = null
      let rbtCertificateMimeType: string | null = null
      if (data.rbtCertificate) {
        const certForm = new FormData()
        certForm.append('file', data.rbtCertificate)
        certForm.append('documentType', 'RBT_CERTIFICATE')
        if (draftToken) certForm.append('token', draftToken)
        const certRes = await fetch('/api/public/apply/upload', { method: 'POST', body: certForm })
        if (certRes.ok) {
          const certResult = await certRes.json()
          rbtCertificateUrl = certResult.url
          rbtCertificateFileName = certResult.fileName || data.rbtCertificate.name
          rbtCertificateMimeType = certResult.mimeType || data.rbtCertificate.type
        }
      }

      let cprCardUrl: string | null = null
      let cprCardFileName: string | null = null
      let cprCardMimeType: string | null = null
      if (data.cprCard) {
        const cprForm = new FormData()
        cprForm.append('file', data.cprCard)
        cprForm.append('documentType', 'CPR_CARD')
        if (draftToken) cprForm.append('token', draftToken)
        const cprRes = await fetch('/api/public/apply/upload', { method: 'POST', body: cprForm })
        if (cprRes.ok) {
          const cprResult = await cprRes.json()
          cprCardUrl = cprResult.url
          cprCardFileName = cprResult.fileName || data.cprCard.name
          cprCardMimeType = cprResult.mimeType || data.cprCard.type
        }
      }

      let idDocumentUrl = data.idDocumentUrl
      let idDocumentFileName: string | null = null
      let idDocumentMimeType: string | null = null
      if (data.idDocument) {
        const idForm = new FormData()
        idForm.append('file', data.idDocument)
        idForm.append('documentType', 'GOVERNMENT_ID')
        if (draftToken) idForm.append('token', draftToken)
        const idRes = await fetch('/api/public/apply/upload', { method: 'POST', body: idForm })
        if (!idRes.ok) {
          let message = 'Failed to upload ID'
          try {
            const errData = await idRes.json()
            if (errData?.error) message = errData.error
          } catch {
            if (idRes.status === 429) {
              message = 'Too many ID uploads. Please wait a minute and try again.'
            } else if (idRes.status === 413) {
              message = 'ID file is too large. Please upload a smaller file.'
            } else {
              message = `Failed to upload ID (status ${idRes.status})`
            }
          }
          throw new Error(message)
        }
        const idResult = await idRes.json()
        idDocumentUrl = idResult.url
        idDocumentFileName = idResult.fileName || data.idDocument.name
        idDocumentMimeType = idResult.mimeType || data.idDocument.type
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
          experienceYearsDisplay: data.experienceYears,
          preferredAgeGroups: data.preferredAgeGroups,
          authorizedToWork: data.authorizedToWork,
          canPassBackgroundCheck: data.canPassBackgroundCheck,
          cprFirstAidCertified: data.cprFirstAidCertified,
          rbtCertificateUrl: rbtCertificateUrl || undefined,
          rbtCertificateFileName: rbtCertificateFileName || undefined,
          rbtCertificateMimeType: rbtCertificateMimeType || undefined,
          cprCardUrl: cprCardUrl || undefined,
          cprCardFileName: cprCardFileName || undefined,
          cprCardMimeType: cprCardMimeType || undefined,
          idDocumentUrl: idDocumentUrl || undefined,
          idDocumentFileName: idDocumentFileName || undefined,
          idDocumentMimeType: idDocumentMimeType || undefined,
          draftToken: draftToken,
          website: data.website || '', // Honeypot
        }),
      })

      if (!submitResponse.ok) {
        let message = 'Failed to submit application'
        try {
          const errorData = await submitResponse.json()
          if (errorData?.error) message = errorData.error
        } catch {
          if (submitResponse.status === 429) {
            message = 'Too many submissions from this browser. Please wait a bit and try again.'
          } else if (submitResponse.status === 413) {
            message = 'Submitted data was too large. Please try again or contact support.'
          } else {
            message = `Failed to submit application (status ${submitResponse.status})`
          }
        }
        throw new Error(message)
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
        return <ApplicationStepPersonalInfo data={data} setData={setData} />
      case 2:
        return <ApplicationStepRBTReadiness data={data} setData={setData} />
      case 3:
        return <ApplicationStepAvailability data={data} setData={setData} />
      case 4:
        return <ApplicationStepCompliance data={data} setData={setData} />
      case 5:
        return <ApplicationStepFiles data={data} setData={setData} onFileChange={handleFileChange} />
      case 6:
        return <ApplicationStepReview data={data} consent={consent} onConsentChange={setConsent} />
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
