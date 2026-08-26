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
  BookOpen,
  Timer,
  LogOut,
  User,
  MessageCircle,
  GraduationCap,
  Award,
  Library,
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

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: typeof LayoutDashboard
}

function buildNavItems(opts: {
  showCertJourney: boolean
  canAccessSessions: boolean
}): NavItem[] {
  const items: NavItem[] = [
    { href: '/rbt/dashboard', label: 'Home', icon: LayoutDashboard },
    {
      href: '/rbt/training',
      label: '40-Hour Course',
      shortLabel: '40hr',
      icon: GraduationCap,
    },
    { href: '/rbt/tasks', label: 'My Tasks', shortLabel: 'Tasks', icon: ClipboardList },
    { href: '/rbt/org-training', label: 'Training', shortLabel: 'Train', icon: Library },
  ]
  if (opts.showCertJourney) {
    items.push({
      href: '/rbt/get-certified',
      label: 'Get Certified',
      shortLabel: 'Cert',
      icon: Award,
    })
  }
  if (opts.canAccessSessions) {
    items.push({ href: '/rbt/sessions', label: 'Pay', icon: Timer })
  }
  items.push(
    { href: '/rbt/schedule', label: 'Schedule', icon: Calendar },
    { href: '/rbt/documents', label: 'Documents', shortLabel: 'Docs', icon: FileText },
    { href: '/rbt/resources', label: 'Resources', icon: BookOpen },
    { href: '/rbt/profile', label: 'Profile', icon: User }
  )
  return items
}

interface RBTLayoutProps {
  children: React.ReactNode
  rbtFirstName?: string | null
  canAccessSessions?: boolean
  showCertJourney?: boolean
}

export default function RBTLayout({
  children,
  rbtFirstName,
  canAccessSessions = false,
  showCertJourney = false,
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
  const navItems = buildNavItems({ showCertJourney, canAccessSessions })

  const isActive = (href: string) =>
    pathname === href || (href !== '/rbt/dashboard' && pathname.startsWith(`${href}/`))

  return (
    <RBTMessageContext.Provider value={messageContextValue}>
      <div className="flex min-h-screen flex-col bg-[#fff8f2] lg:flex-row dark:bg-[var(--bg-primary)]">
        {/* Desktop sidebar — inverted orange, squared */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-[#e36f1e] text-white lg:flex dark:bg-[#c45a1a]">
          <div className="flex h-20 items-center gap-3 border-b border-white/20 px-5">
            <Link href="/rbt/dashboard" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-white p-1.5">
                <Image
                  src="/new-real-logo.png"
                  alt="Rise and Shine"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold leading-tight tracking-tight text-white">
                  Rise &amp; Shine
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/75">
                  RBT portal
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-white text-[#e36f1e] shadow-sm'
                      : 'text-white/90 hover:bg-white/15 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="space-y-2 border-t border-white/20 p-4">
            <div className="flex items-center gap-3 px-1">
              <div
                className="flex h-10 w-10 items-center justify-center bg-white text-sm font-bold text-[#e36f1e]"
                aria-hidden
              >
                {initial}
              </div>
              <span className="truncate text-sm font-semibold text-white">{displayName}</span>
            </div>
            <button
              type="button"
              onClick={() => setMessageModalOpen(true)}
              className="relative flex w-full items-center justify-center gap-2 border-2 border-white/40 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <MessageCircle className="h-4 w-4" />
              Need Help?
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#e36f1e]" />
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
          {!messageModalOpen && unreadMessages > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
              <span className="font-medium">
                New message{unreadMessages > 1 ? 's' : ''} from admin
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-600/50 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                onClick={() => setMessageModalOpen(true)}
              >
                View
              </Button>
            </div>
          )}

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">{children}</main>

          {/* Mobile bottom bar — orange inverted */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#c45a1a] bg-[#e36f1e] safe-area-pb lg:hidden"
            aria-label="Main navigation"
          >
            <div
              className="grid h-16"
              style={{
                gridTemplateColumns: `repeat(${Math.min(navItems.length, 6)}, minmax(0, 1fr))`,
              }}
            >
              {navItems.slice(0, 6).map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-semibold transition-colors',
                      active ? 'bg-white text-[#e36f1e]' : 'text-white/85'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="truncate">
                      {item.shortLabel ?? item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>

        <Button
          onClick={() => setMessageModalOpen(true)}
          className="fixed bottom-20 right-4 z-30 h-12 w-12 rounded-none bg-[#c45a1a] text-white shadow-lg hover:bg-[#a34b15] lg:hidden"
          size="icon"
          aria-label="Need Help?"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadMessages > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
          )}
        </Button>

        <RBTMessageModal open={messageModalOpen} onOpenChange={setMessageModalOpen} />
      </div>
    </RBTMessageContext.Provider>
  )
}
