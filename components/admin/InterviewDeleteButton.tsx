'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface InterviewDeleteButtonProps {
  interviewId: string
  rbtName: string
  scheduledAt: Date
}

export default function InterviewDeleteButton({
  interviewId,
  rbtName,
  scheduledAt,
}: InterviewDeleteButtonProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        showToast('Interview deleted successfully', 'success')
        setOpen(false)
        router.refresh()
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to delete interview', 'error')
      }
    } catch (error) {
      console.error('Error deleting interview:', error)
      showToast('An error occurred while deleting the interview', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Interview</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this interview? This action cannot be undone.
              <br />
              <br />
              <strong>Interview Details:</strong>
              <br />
              Candidate: {rbtName}
              <br />
              Scheduled: {scheduledAt.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Interview
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
