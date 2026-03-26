'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY_PREFIX = 'action-center-section-'

type Severity = 'URGENT' | 'WARNING' | 'INFO'

const severityStyles: Record<Severity, { border: string; bg: string; badge: string }> = {
  URGENT: {
    border: 'border-l-4 border-l-red-500',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  },
  WARNING: {
    border: 'border-l-4 border-l-amber-500',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
  INFO: {
    border: 'border-l-4 border-l-green-500',
    bg: 'bg-green-50/50 dark:bg-green-950/20',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  },
}

interface ActionCenterSectionProps {
  id: string
  title: string
  severity: Severity
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function ActionCenterSection({
  id,
  title,
  severity,
  count,
  children,
  defaultOpen = true,
}: ActionCenterSectionProps) {
  const storageKey = `${STORAGE_KEY_PREFIX}${id}`
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) setOpen(stored === '1')
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(storageKey, open ? '1' : '0')
  }, [open, storageKey])

  const style = severityStyles[severity]

  return (
    <div
      id={`section-${id}`}
      className={cn('rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] overflow-hidden', style.border)}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left font-medium transition-colors',
          style.bg,
          'hover:opacity-90 dark:hover:opacity-90'
        )}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-gray-900 dark:text-[var(--text-primary)]">{title}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', style.badge)}>
            {count}
          </span>
        </span>
      </button>
      {open && (
        <div className="bg-white dark:bg-[var(--bg-elevated)] border-t border-gray-200 dark:border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </div>
  )
}
