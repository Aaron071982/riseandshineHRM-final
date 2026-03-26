'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  FileText,
  Timer,
  LogOut,
  User,
  MessageCircle,
} from 'lucide-react'
import { useState, useEffect, createContext, useContext } from 'react'
import Image from 'next/image'
import { trackPageView } from '@/lib/activity-tracker'
import RBTMessageModal, { useRBTUnreadMessages } from '@/components/rbt/RBTMessageModal'

export const RBTMessageContext = createContext<{ openMessageModal: () => void } | null>(null)
export function useRBTMessageModal() {
  const ctx = useContext(RBTMessageContext)
  return ctx?.openMessageModal ?? (() => {})
}

const baseNavItems = [
  { href: '/rbt/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/rbt/tasks', label: 'My Tasks', icon: ClipboardList },
  { href: '/rbt/schedule', label: 'Schedule', icon: Calendar },
  { href: '/rbt/documents', label: 'Documents', icon: FileText },
  { href: '/rbt/profile', label: 'Profile', icon: User },
]

interface RBTLayoutProps {
  children: React.ReactNode
  /** RBT first name for greeting and sidebar (from server layout) */
  rbtFirstName?: string | null
  canAccessSessions?: boolean
  hasActiveSession?: boolean
}

export default function RBTLayout({
  children,
  rbtFirstName,
  canAccessSessions = false,
  hasActiveSession = false,
}: RBTLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const unreadMessages = useRBTUnreadMessages()

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, { timestamp: new Date().toISOString() })
    }
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const displayName = rbtFirstName?.trim() || 'there'
  const initial = (rbtFirstName?.trim().charAt(0) || 'R').toUpperCase()

  const messageContextValue = { openMessageModal: () => setMessageModalOpen(true) }
  const navItems = canAccessSessions
    ? [...baseNavItems.slice(0, 3), { href: '/rbt/sessions', label: 'Sessions', icon: Timer }, ...baseNavItems.slice(3)]
    : baseNavItems

  return (
    <RBTMessageContext.Provider value={messageContextValue}>
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)] flex flex-col lg:flex-row">
      {/* Desktop: left sidebar (lg and up) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 lg:z-30 bg-white dark:bg-[var(--bg-elevated)] border-r border-orange-200/70 dark:border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-orange-200/70 dark:border-[var(--border-subtle)]">
          <Link href="/rbt/dashboard" className="flex items-center gap-2">
            <Image
              src="/new-real-logo.png"
              alt="Rise and Shine"
              width={36}
              height={36}
              className="object-contain"
            />
            <span
              className="text-base font-bold text-[#e36f1e] dark:text-[var(--text-primary)]"
              style={{
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                letterSpacing: '0.01em',
                fontWeight: 700,
              }}
            >
              Rise and shine
            </span>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)]'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-tertiary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-secondary)]'
                )}
              >
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  {item.href === '/rbt/sessions' && hasActiveSession && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-orange-200/70 dark:border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white bg-[#e36f1e] dark:bg-[var(--orange-primary)]"
              aria-hidden
            >
              {initial}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)] truncate">
              {displayName}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-orange-200 dark:border-[var(--border-subtle)] text-gray-700 dark:text-[var(--text-secondary)] relative"
            onClick={() => setMessageModalOpen(true)}
          >
            <MessageCircle className="w-4 h-4" />
            Need Help?
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500" aria-label={`${unreadMessages} unread`} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-gray-600 dark:text-[var(--text-tertiary)]"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content: with left offset on desktop for sidebar */}
      <div className="flex-1 flex flex-col lg:pl-56 min-h-screen">
        {/* Subtle "New message" banner when there are unread admin messages and modal is closed */}
        {!messageModalOpen && unreadMessages > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 dark:border-amber-500/30 text-amber-900 dark:text-amber-100 text-sm shrink-0">
            <span className="font-medium">New message{unreadMessages > 1 ? 's' : ''} from admin</span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600/50 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 shrink-0"
              onClick={() => setMessageModalOpen(true)}
            >
              View
            </Button>
          </div>
        )}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile: bottom fixed tab bar (default up to lg) */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[var(--bg-elevated)] border-t border-orange-200/70 dark:border-[var(--border-subtle)] safe-area-pb"
          aria-label="Main navigation"
        >
          <div className={cn('h-14', navItems.length === 6 ? 'grid grid-cols-6' : 'grid grid-cols-5')}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'text-[#e36f1e] dark:text-[var(--orange-primary)]'
                      : 'text-gray-500 dark:text-[var(--text-tertiary)]'
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.href === '/rbt/sessions' && hasActiveSession && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Floating Need Help on mobile (bottom right, above tab bar) */}
      <Button
        onClick={() => setMessageModalOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-30 rounded-full w-12 h-12 shadow-lg bg-[#e36f1e] hover:bg-[#c95e18] text-white relative"
        size="icon"
        aria-label="Need Help?"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadMessages > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
      </Button>

      <RBTMessageModal open={messageModalOpen} onOpenChange={setMessageModalOpen} />
    </div>
    </RBTMessageContext.Provider>
  )
}
