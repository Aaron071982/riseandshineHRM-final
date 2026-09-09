'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  pending = false,
  confirmDisabled = false,
  children,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  pending?: boolean
  confirmDisabled?: boolean
  children?: ReactNode
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || confirmDisabled}
            onClick={() => void onConfirm()}
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
