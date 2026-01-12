'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import PublicBackground from '@/components/public/PublicBackground'
import PublicFooter from '@/components/public/PublicFooter'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-white">
      <PublicBackground variant="page" />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            className="bg-white/95 backdrop-blur-md rounded-cardLg border border-gray-200 shadow-cardGlow relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="flex justify-center mb-2">
                <Link href="/">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Image
                      src="/logo.png"
                      alt="Rise and Shine"
                      width={180}
                      height={72}
                      className="object-contain"
                    />
                  </motion.div>
                </Link>
              </div>
              {/* RBT Portal Login Badge */}
              <div className="flex flex-col items-center gap-2">
                <Badge className="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 text-sm font-semibold">
                  RBT Portal Login
                </Badge>
                <CardTitle className="text-3xl font-semibold text-gray-900">Welcome Back!</CardTitle>
                <CardDescription className="text-base text-gray-600 max-w-sm">
                  Use your work email to receive a verification code
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
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
                    className="text-sm text-red-600 bg-red-50 border-2 border-red-200 p-3 rounded-input"
                  >
                    {error}
                  </motion.div>
                )}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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

              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link
                  href="/"
                  className="text-sm text-center text-gray-600 hover:text-primary transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  ← Back to Careers
                </Link>
                <div className="mt-3 text-center">
                  <Link
                    href="/apply"
                    className="text-sm text-gray-500 hover:text-primary transition-colors duration-200"
                  >
                    Need to apply?
                  </Link>
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
