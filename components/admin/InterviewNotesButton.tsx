'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import InterviewNotesForm from './InterviewNotesForm'
import { FileText } from 'lucide-react'

interface InterviewNotesButtonProps {
  interviewId: string
  rbtProfileId: string
}

export default function InterviewNotesButton({
  interviewId,
  rbtProfileId,
}: InterviewNotesButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border border-orange-500 text-orange-600 bg-white hover:bg-orange-50 hover:text-orange-700 dark:bg-black dark:border-[var(--orange-primary)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--orange-primary)] dark:hover:text-white shadow-none"
      >
        <FileText className="w-4 h-4 mr-1" />
        Take Notes
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interview Notes</DialogTitle>
          </DialogHeader>
          <InterviewNotesForm
            interviewId={interviewId}
            rbtProfileId={rbtProfileId}
            onSave={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

