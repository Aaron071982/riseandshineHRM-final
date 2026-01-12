'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, ArrowRight, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import PublicBackground from '@/components/public/PublicBackground'
import PublicFooter from '@/components/public/PublicFooter'
import IconChip from '@/components/public/IconChip'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLoginForm, setShowLoginForm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send verification code')
        setLoading(false)
        return
      }

      // Store email and OTP code (if in dev mode) in sessionStorage for OTP verification
      sessionStorage.setItem('pendingEmail', email)
      if (data.devOTP) {
        sessionStorage.setItem('devOTP', data.devOTP)
      }
      router.push('/verify-otp')
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFF5F0 0%, #FFFFFF 100%)' }}>
      <PublicBackground variant="page" />

      <div className="relative z-10 w-full max-w-4xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Link href="/" className="inline-block mb-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Image
                src="/logo.png"
                alt="Rise and Shine"
                width={200}
                height={80}
                className="object-contain mx-auto"
              />
            </motion.div>
          </Link>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 leading-tight mb-4">
            Welcome to{' '}
            <span className="text-primary">Rise & Shine</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose an option below to get started
          </p>
        </motion.div>

        {/* Two CTA Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Apply Now - Primary CTA */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border-2 border-primary/20 shadow-cardGlow hover:shadow-buttonHover transition-all duration-200 h-full">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <IconChip icon={<UserPlus className="h-6 w-6" />} size="lg" color="orange" className="mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">Apply Now</h2>
                <p className="text-gray-600 mb-6">
                  Join our team as a Registered Behavior Technician
                </p>
                <Link href="/apply" className="w-full">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      className="w-full gradient-primary text-white border-0 rounded-button px-8 py-6 text-lg font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                    >
                      Apply Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Log In - Secondary CTA */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-white/95 backdrop-blur-md rounded-cardLg border-2 border-gray-200 shadow-cardGlow hover:shadow-md transition-all duration-200 h-full">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <IconChip icon={<LogIn className="h-6 w-6" />} size="lg" color="blue" className="mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">Log In</h2>
                <p className="text-gray-600 mb-6">
                  Access your HRM portal with your work email
                </p>
                {!showLoginForm ? (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setShowLoginForm(true)}
                      className="w-full border-2 border-gray-300 rounded-button px-8 py-6 text-lg font-semibold bg-white hover:bg-gray-50 transition-all duration-200"
                    >
                      <LogIn className="mr-2 h-5 w-5" />
                      Log In
                    </Button>
                  </motion.div>
                ) : (
                  <div className="w-full space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2 text-left">
                        <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-primary" />
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                          className="h-12 border-2 border-gray-200 rounded-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        />
                      </div>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-600 bg-red-50 border-2 border-red-200 p-3 rounded-input text-left"
                        >
                          {error}
                        </motion.div>
                      )}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="submit"
                          className="w-full h-12 gradient-primary text-white border-0 rounded-button font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                          disabled={loading || !email.includes('@')}
                        >
                          {loading ? (
                            <span className="flex items-center gap-2">Sending...</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Mail className="h-5 w-5" />
                              Send Verification Code
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </form>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowLoginForm(false)
                        setError('')
                        setEmail('')
                      }}
                      className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-primary transition-colors duration-200"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
