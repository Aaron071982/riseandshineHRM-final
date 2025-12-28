// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Status manager for intern candidates with explicit confirmation

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
import type { InternCandidateStatus } from '@/lib/intern-storage'

interface InternCandidateStatusManagerProps {
  candidateId: string
  initialStatus: InternCandidateStatus
  onStatusChange?: (newStatus: InternCandidateStatus) => void
}

const ALLOWED_STATUSES: Array<{ value: InternCandidateStatus; label: string }> = [
  { value: 'Applied', label: 'Applied' },
  { value: 'Interview Scheduled', label: 'Interview Scheduled' },
  { value: 'Interview Completed', label: 'Interview Completed' },
  { value: 'Hired', label: 'Hired' },
  { value: 'Rejected', label: 'Rejected' },
] as const

const STATUS_LABELS: Record<InternCandidateStatus, string> = {
  'Applied': 'Applied',
  'Interview Scheduled': 'Interview Scheduled',
  'Interview Completed': 'Interview Completed',
  'Hired': 'Hired',
  'Rejected': 'Rejected',
}

export default function InternCandidateStatusManager({ 
  candidateId, 
  initialStatus, 
  onStatusChange 
}: InternCandidateStatusManagerProps) {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [currentStatus, setCurrentStatus] = useState<InternCandidateStatus>(initialStatus)
  const [pendingStatus, setPendingStatus] = useState<InternCandidateStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Update currentStatus when initialStatus prop changes
  if (initialStatus !== currentStatus && pendingStatus === null) {
    setCurrentStatus(initialStatus)
  }

  const isDirty = pendingStatus !== null && pendingStatus !== currentStatus

  const handleStatusSelect = (value: string) => {
    setPendingStatus(value as InternCandidateStatus)
  }

  const handleCancel = () => {
    setPendingStatus(null)
  }

  const handleConfirmClick = () => {
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
      
      const response = await fetch(`/api/dev/intern-candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus }),
      })

      if (response.ok) {
        const data = await response.json()
        
        setCurrentStatus(pendingStatus)
        setPendingStatus(null)
        setModalOpen(false)
        showToast('Status updated successfully', 'success')
        
        // If status changed to Hired, also create intern record
        if (pendingStatus === 'Hired') {
          try {
            const hireResponse = await fetch(`/api/dev/intern-candidates/${candidateId}/hire`, {
              method: 'POST',
            })
            if (hireResponse.ok) {
              showToast('Candidate hired and intern record created!', 'success')
            }
          } catch (error) {
            console.error('Error creating intern record:', error)
            // Don't show error toast here, status update already succeeded
          }
        }
        
        if (onStatusChange) {
          onStatusChange(pendingStatus)
        }
        
        router.refresh()
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to update status', 'error')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      showToast('An error occurred while updating status', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleModalCancel = () => {
    setModalOpen(false)
  }

  const displayValue = pendingStatus || currentStatus

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Label className="font-semibold">Current status:</Label>
          <div className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-900">
            {STATUS_LABELS[currentStatus]}
          </div>
        </div>

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

      <Dialog open={modalOpen} onOpenChange={(open) => {
        if (!open && !isSaving) {
          handleModalCancel()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm status change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the status from &quot;{STATUS_LABELS[currentStatus]}&quot; to &quot;{pendingStatus ? STATUS_LABELS[pendingStatus] : ''}&quot;?
              {pendingStatus === 'Hired' && (
                <span className="block mt-2 font-semibold text-green-600">
                  This will create an Intern record.
                </span>
              )}
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

