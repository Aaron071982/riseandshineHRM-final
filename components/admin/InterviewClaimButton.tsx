'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Hand, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface InterviewClaimButtonProps {
  interviewId: string
}

export default function InterviewClaimButton({ interviewId }: InterviewClaimButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClaim = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/claim`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        router.refresh()
      } else {
        const d = await res.json()
        alert(d.error || 'Failed to claim')
      }
    } catch {
      alert('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClaim}
      disabled={loading}
      className="text-xs h-7 px-2.5 border-orange-400 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-900/30"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hand className="w-3 h-3 mr-1" />}
      Claim
    </Button>
  )
}
