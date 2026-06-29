'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, GraduationCap, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { TRAINING_ACCENT } from '@/lib/training/constants'

interface NotificationItem {
  id: string
  type: string
  message: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export default function TrainingNotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [marking, setMarking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/training/notifications?limit=30', { credentials: 'include' })
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
      const res = await fetch('/api/training/notifications', {
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
    if (type === 'ARTEMIS_SESSION_REQUEST' || type === 'ARTEMIS_BOOKING') {
      return <GraduationCap className="h-4 w-4 flex-shrink-0" style={{ color: TRAINING_ACCENT }} />
    }
    return <Bell className="h-4 w-4 text-gray-500 flex-shrink-0" />
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative text-gray-700 dark:text-[var(--text-tertiary)]"
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
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleMarkAllRead} disabled={marking}>
                {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark all as read'}
              </Button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">No notifications</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)]">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.linkUrl || '#'}
                      onClick={() => setOpen(false)}
                      className={`flex gap-3 px-3 py-2.5 text-left transition-colors hover:bg-purple-50 dark:hover:bg-violet-950/30 ${
                        !n.isRead ? 'bg-violet-50/60 dark:bg-violet-950/20' : ''
                      }`}
                    >
                      <div className="mt-0.5">{iconForType(n.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
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
