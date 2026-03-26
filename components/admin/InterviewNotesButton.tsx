'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface InterviewNotesButtonProps {
  interviewId: string
  rbtProfileId: string
}

export default function InterviewNotesButton({
  interviewId,
}: InterviewNotesButtonProps) {
  return (
    <Link
      href={`/admin/interviews/${interviewId}/notes`}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-orange-500 text-orange-600 bg-white rounded-md hover:bg-orange-50 hover:text-orange-700 dark:bg-black dark:border-[var(--orange-primary)] dark:text-[var(--orange-primary)] dark:hover:bg-[var(--orange-primary)] dark:hover:text-white transition-colors"
    >
      <FileText className="w-4 h-4" />
      Take Notes
    </Link>
  )
}
