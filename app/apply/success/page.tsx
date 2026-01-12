'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'
import PublicNavBar from '@/components/public/PublicNavBar'
import SoftBackgroundBlobs from '@/components/public/SoftBackgroundBlobs'

export default function ApplicationSuccessPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  return (
    <div className="min-h-screen bg-white">
      <SoftBackgroundBlobs />
      <PublicNavBar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="shadow-xl border-2 border-green-200">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-3xl text-gray-900">Application Submitted Successfully!</CardTitle>
            <CardDescription className="text-lg mt-2">
              Thank you for applying to join the Rise & Shine team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-gray-700">
                We&apos;ve received your application and will review it carefully. Our team will contact you soon
                regarding next steps.
              </p>
              {id && (
                <p className="text-sm text-gray-500">
                  Reference ID: <span className="font-mono font-semibold">{id}</span>
                </p>
              )}
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                <li>Our team will review your application</li>
                <li>If selected, we&apos;ll contact you to schedule an interview</li>
                <li>Please check your email regularly for updates</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/">
                <Button variant="outline" className="w-full sm:w-auto">
                  Return to Homepage
                </Button>
              </Link>
              <Link href="/apply">
                <Button className="gradient-primary text-white w-full sm:w-auto">
                  Submit Another Application
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
