'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'

type RBTStatus = 'NEW' | 'REACH_OUT' | 'TO_INTERVIEW' | 'INTERVIEW_SCHEDULED' | 'INTERVIEW_COMPLETED' | 'HIRED' | 'REJECTED'

interface StatusManagerProps {
  rbtId: string
  initialStatus: RBTStatus
  onStatusChange?: (newStatus: RBTStatus) => void
}

const ALLOWED_STATUSES: Array<{ value: RBTStatus; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'REACH_OUT', label: 'Reach Out' },
  { value: 'TO_INTERVIEW', label: 'To Interview' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { value: 'INTERVIEW_COMPLETED', label: 'Interview Completed' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

const STATUS_LABELS: Record<RBTStatus, string> = {
  NEW: 'New',
  REACH_OUT: 'Reach Out',
  TO_INTERVIEW: 'To Interview',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
}

export default function StatusManager({ rbtId, initialStatus, onStatusChange }: StatusManagerProps) {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [currentStatus, setCurrentStatus] = useState<RBTStatus>(initialStatus)
  const [pendingStatus, setPendingStatus] = useState<RBTStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Update currentStatus when initialStatus prop changes (e.g., after parent refresh)
  if (initialStatus !== currentStatus && pendingStatus === null) {
    setCurrentStatus(initialStatus)
  }

  const isDirty = pendingStatus !== null && pendingStatus !== currentStatus

  const handleStatusSelect = (value: string) => {
    // Only update pendingStatus, never touch currentStatus or DB
    setPendingStatus(value as RBTStatus)
  }

  const handleCancel = () => {
    // Reset pendingStatus to null, reverting to currentStatus
    setPendingStatus(null)
  }

  const handleConfirmClick = () => {
    // Open confirmation modal
    if (pendingStatus && pendingStatus !== currentStatus) {
      setModalOpen(true)
    }
  }

  const handleModalConfirm = async () => {
    if (!pendingStatus || pendingStatus === currentStatus || isSaving) {
      return
    }

    try {
      setIsSaving(true)
      
      const response = await fetch(`/api/admin/rbts/${rbtId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update currentStatus to the new status
        setCurrentStatus(pendingStatus)
        
        // Reset pendingStatus
        setPendingStatus(null)
        
        // Close modal
        setModalOpen(false)
        
        // Show success toast
        showToast('Status updated successfully', 'success')
        
        // Call optional callback
        if (onStatusChange) {
          onStatusChange(pendingStatus)
        }
        
        // Refresh router to ensure data is in sync
        router.refresh()
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to update status', 'error')
        // Keep modal open and pendingStatus unchanged so user can retry
      }
    } catch (error) {
      console.error('Error updating status:', error)
      showToast('An error occurred while updating status', 'error')
      // Keep modal open and pendingStatus unchanged so user can retry
    } finally {
      setIsSaving(false)
    }
  }

  const handleModalCancel = () => {
    // Close modal without saving
    setModalOpen(false)
    // Note: pendingStatus is NOT reset here, so user can reopen modal and confirm
  }

  // Display value for the Select: show pendingStatus if set, otherwise currentStatus
  const displayValue = pendingStatus || currentStatus

  return (
    <>
      <div className="space-y-4">
        {/* Current Status Display */}
        <div className="flex items-center gap-4">
          <Label className="font-semibold">Current status:</Label>
          <div className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-900">
            {STATUS_LABELS[currentStatus]}
          </div>
        </div>

        {/* New Status Selection */}
        <div className="flex items-center gap-4">
          <Label>New status:</Label>
          <Select
            value={displayValue}
            onValueChange={handleStatusSelect}
            disabled={isSaving}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleConfirmClick}
            disabled={!isDirty || isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={!isDirty || isSaving}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        // Prevent closing during save
        if (!open && !isSaving) {
          handleModalCancel()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm status change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the status from &quot;{STATUS_LABELS[currentStatus]}&quot; to &quot;{pendingStatus ? STATUS_LABELS[pendingStatus] : ''}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleModalCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleModalConfirm}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

