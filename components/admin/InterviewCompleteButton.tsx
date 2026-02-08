'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface InterviewCompleteButtonProps {
  interviewId: string
}

export default function InterviewCompleteButton({ interviewId }: InterviewCompleteButtonProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/complete`, {
        method: 'PATCH',
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Interview marked as completed', 'success')
        router.refresh()
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to complete interview', 'error')
      }
    } catch (error) {
      console.error('Error completing interview:', error)
      showToast('An error occurred while completing the interview', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      onClick={handleComplete}
      disabled={loading}
      className="dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)] border-0"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      <span className="ml-1.5">{loading ? 'Completing...' : 'Mark as Completed'}</span>
    </Button>
  )
}
