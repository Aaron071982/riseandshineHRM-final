'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

interface ActionCenterNavLinkProps {
  href: string
  label: string
  isActive: boolean
  onClick?: () => void
  className?: string
}

export default function ActionCenterNavLink({ href, label, isActive, onClick, className }: ActionCenterNavLinkProps) {
  const [urgentCount, setUrgentCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchCount = () => {
      fetch('/api/admin/action-center?countOnly=1', { credentials: 'include' })
        .then((res) => {
          if (!res.ok) return { urgent: 0, warning: 0, info: 0 }
          return res.json()
        })
        .then((data) => {
          if (!cancelled) setUrgentCount(data?.urgent ?? 0)
        })
        .catch(() => {
          if (!cancelled) setUrgentCount(0)
        })
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
        className,
        isActive
          ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
          : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
      )}
    >
      <Inbox className="w-4 h-4 mr-2" />
      {label}
      {urgentCount > 0 && (
        <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white min-w-[1.25rem] text-center">
          {urgentCount > 99 ? '99+' : urgentCount}
        </span>
      )}
    </Link>
  )
}
