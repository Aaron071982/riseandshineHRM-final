'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import TerminationWorkflowModal from '@/components/admin/TerminationWorkflowModal'

const TERMINABLE_STATUSES = ['HIRED', 'ONBOARDING_COMPLETED']

interface TerminateRbtButtonProps {
  rbtId: string
  displayName: string
  status: string
  email?: string | null
  onTerminated?: (details: { reason: string; terminatedAt: string; terminationId?: string }) => void
  compact?: boolean
  className?: string
}

export function canTerminateRbt(status: string): boolean {
  return TERMINABLE_STATUSES.includes(status)
}

export default function TerminateRbtButton({
  rbtId,
  displayName,
  status,
  email,
  onTerminated,
  compact = false,
  className,
}: TerminateRbtButtonProps) {
  const [open, setOpen] = useState(false)

  if (!canTerminateRbt(status)) return null

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={!email?.trim()}
        className={className}
      >
        {compact ? 'Terminate' : 'Terminate RBT'}
      </Button>
      <TerminationWorkflowModal
        open={open}
        onOpenChange={setOpen}
        rbtId={rbtId}
        displayName={displayName}
        email={email}
        onFinalized={onTerminated}
      />
    </>
  )
}
