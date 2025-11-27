'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { Mail, Sparkles } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center px-4 colorful-bg relative overflow-hidden">
      {/* Decorative bubbles in background */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-orange-200/30 rounded-full bubble-animation bubble-large" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-200/30 rounded-full bubble-animation-delayed bubble-large" />
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-purple-200/30 rounded-full bubble-animation-delayed-2 bubble-medium" />
      <div className="absolute bottom-1/3 right-1/3 w-20 h-20 bg-green-200/30 rounded-full bubble-animation-delayed-3 bubble-medium" />
      
      <div className="relative z-10 w-full max-w-md">
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50/50 shadow-2xl relative overflow-hidden">
          {/* Decorative bubbles on card */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100/40 rounded-full -mr-12 -mt-12 bubble-animation" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-100/40 rounded-full -ml-10 -mb-10 bubble-animation-delayed" />
          
          <CardHeader className="text-center space-y-4 relative">
            <div className="flex justify-center mb-2">
              <div className="relative">
                <Image
                  src="/logo.png"
                  alt="Rise and Shine"
                  width={200}
                  height={80}
                  className="object-contain drop-shadow-lg"
                />
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="h-6 w-6 text-orange-400 animate-pulse" />
                </div>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-gradient">Welcome Back!</CardTitle>
            <CardDescription className="text-base">
              Enter your email address to receive a verification code
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-500" />
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
                  className="h-12 border-2 border-orange-200 focus:border-primary rounded-xl text-base"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border-2 border-red-200 p-3 rounded-xl">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full h-12 gradient-primary text-white border-0 rounded-xl text-base font-semibold shine-effect glow-effect" 
                disabled={loading || !email.includes('@')}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Send Verification Code
                  </span>
                )}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-orange-200">
              <p className="text-xs text-center text-gray-500">
                Secure login via email verification
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
