'use client'

import { Badge } from '@/components/ui/badge'
import type { RBTProfile } from './types'

interface RBTProfileHeaderProps {
  rbtProfile: RBTProfile
}

export default function RBTProfileHeader({ rbtProfile }: RBTProfileHeaderProps) {
  return (
    <div className="pb-6 border-b dark:border-[var(--border-subtle)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-2">
          {rbtProfile.firstName} {rbtProfile.lastName}
        </h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">RBT Profile & Hiring Pipeline</p>
      </div>
      <Badge className="bg-gray-100 dark:bg-[var(--bg-elevated)] text-gray-800 dark:text-[var(--text-primary)] border dark:border-[var(--border-subtle)] px-4 py-2 text-base font-semibold">
        {rbtProfile.status.replace(/_/g, ' ')}
      </Badge>
    </div>
  )
}
