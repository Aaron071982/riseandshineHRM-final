'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export default function VerifyOTPPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem('pendingEmail')
    if (!pendingEmail) {
      router.push('/')
      return
    }
    setEmail(pendingEmail)
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid verification code')
        setLoading(false)
        return
      }

      // Clear pending email and any stored OTP from sessionStorage
      sessionStorage.removeItem('pendingEmail')
      sessionStorage.removeItem('devOTP')

      // Redirect based on role
      if (data.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else if (data.role === 'RBT') {
        router.push('/rbt/dashboard')
      } else {
        setError('Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.')
        setLoading(false)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleBack = () => {
    sessionStorage.removeItem('pendingEmail')
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/logo.png"
              alt="Rise and Shine"
              width={200}
              height={80}
              className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              Please check your email inbox for the verification code. Enter the 6-digit code you received below.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(value)
                }}
                required
                maxLength={6}
                disabled={loading}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleBack}
              disabled={loading}
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

