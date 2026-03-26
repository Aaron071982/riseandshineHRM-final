'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, UserPlus, CalendarCheck, PartyPopper, AlertCircle, Loader2, Calendar, Hand, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface NotificationItem {
  id: string
  type: string
  message: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=30', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleMarkAllRead = async () => {
    setMarking(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      if (res.ok) {
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      }
    } finally {
      setMarking(false)
    }
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'NEW_APPLICATION':
        return <UserPlus className="h-4 w-4 text-orange-600 dark:text-[var(--orange-primary)] flex-shrink-0" />
      case 'INTERVIEW_NOT_MARKED':
        return <CalendarCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
      case 'CANDIDATE_HIRED':
        return <PartyPopper className="h-4 w-4 text-green-600 flex-shrink-0" />
      case 'STALENESS_ALERT':
        return <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      case 'INTERVIEW_SCHEDULED':
        return <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
      case 'INTERVIEW_CLAIMED':
        return <Hand className="h-4 w-4 text-green-600 flex-shrink-0" />
      case 'INTERVIEW_1HR_REMINDER':
        return <Clock className="h-4 w-4 text-red-600 flex-shrink-0" />
      default:
        return <Bell className="h-4 w-4 text-gray-500 flex-shrink-0" />
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative text-gray-700 dark:text-[var(--text-tertiary)] dark:hover:text-[var(--text-secondary)]"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[360px] max-h-[400px] overflow-hidden rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[var(--border-subtle)]">
            <span className="font-semibold text-sm text-gray-900 dark:text-[var(--text-primary)]">Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={handleMarkAllRead}
                disabled={marking}
              >
                {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark all as read'}
              </Button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-500 dark:text-[var(--text-tertiary)] text-center">No notifications</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)]">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.linkUrl || '#'}
                      onClick={() => setOpen(false)}
                      className={`
                        flex gap-3 px-3 py-2.5 text-left transition-colors
                        hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]
                        ${!n.isRead ? 'bg-orange-50/50 dark:bg-[var(--orange-subtle)]/30' : ''}
                      `}
                    >
                      <div className="mt-0.5">{iconForType(n.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 dark:text-[var(--text-primary)] line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
