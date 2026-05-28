'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileCheck,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  CalendarClock,
  Settings,
  MessageCircle,
  LayoutGrid,
  Network,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { trackPageView } from '@/lib/activity-tracker'
import { useTheme } from '@/components/theme/ThemeProvider'
import AdminNotificationBell from '@/components/admin/AdminNotificationBell'

interface AdminLayoutProps {
  children: React.ReactNode
}

const mainNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Employees and Candidates', icon: Users },
  { href: '/admin/interviews', label: 'Interviews', icon: Calendar },
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
]

const secondaryNavItems = [
  { href: '/admin/messages', label: 'Messages', icon: MessageCircle },
  { href: '/admin/scheduling-beta', label: 'Scheduling demo', icon: LayoutGrid },
  { href: '/admin/settings/availability', label: 'My Availability', icon: CalendarClock },
  { href: '/admin/settings/workflows', label: 'Workflow Settings', icon: Settings },
  { href: '/admin/org-chart', label: 'Company hierarchy', icon: Network },
]

const themeOrder: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(theme)
    const next = themeOrder[(idx + 1) % themeOrder.length]
    setTheme(next)
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, {
        timestamp: new Date().toISOString(),
      })
    }
  }, [pathname])

  const moreMenuHasActive = useMemo(() => {
    return secondaryNavItems.some((i) =>
      i.href === '/admin/org-chart'
        ? pathname.startsWith('/admin/org-chart')
        : pathname === i.href
    )
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  const navLinkClass = (isActive: boolean) =>
    cn(
      'inline-flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
        : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
    )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)]">
      <nav className="nav-header relative z-50 overflow-visible bg-white border-b border-gray-200 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
          <div className="relative flex h-16 items-center justify-between overflow-visible">
            <Link href="/admin/dashboard" className="flex items-center shrink-0 z-10">
              <div className="flex items-center gap-4">
                <Image
                  src="/new-real-logo.png"
                  alt="Rise and Shine"
                  width={48}
                  height={48}
                  className="object-contain"
                />
                <span
                  className="text-lg font-bold tracking-normal text-[#e36f1e] dark:text-[var(--text-primary)] whitespace-nowrap"
                  style={{
                    fontFamily:
                      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    letterSpacing: '0.01em',
                    fontWeight: 700,
                  }}
                >
                  Rise and shine
                </span>
              </div>
            </Link>

            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 overflow-visible">
              {mainNavItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className={navLinkClass(isActive)}>
                    {Icon ? <Icon className="w-4 h-4 mr-1" /> : null}
                    {item.label}
                  </Link>
                )
              })}
              <div className="relative overflow-visible">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMoreOpen((v) => !v)
                  }}
                  className={navLinkClass(moreMenuHasActive)}
                >
                  More
                  <span className="ml-1 text-xs">▾</span>
                </button>
                {moreOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 min-w-[14rem] rounded-md border border-gray-200 bg-white shadow-xl dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="py-1">
                      {secondaryNavItems.map((item) => {
                        const Icon = item.icon
                        const isActive =
                          item.href === '/admin/org-chart'
                            ? pathname.startsWith('/admin/org-chart')
                            : pathname === item.href
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              'flex items-center px-3 py-2 text-sm',
                              isActive
                                ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                            )}
                          >
                            {Icon ? <Icon className="w-4 h-4 mr-2 shrink-0" /> : null}
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                className="text-gray-700 dark:text-[var(--text-tertiary)] dark:hover:text-[var(--text-secondary)]"
                title={`Theme: ${theme} (click to cycle)`}
              >
                <ThemeIcon className="w-5 h-5" />
              </Button>
              <AdminNotificationBell />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-700 dark:text-[var(--text-tertiary)] dark:hover:text-[var(--text-secondary)]"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden ml-2 dark:text-[var(--text-tertiary)]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden relative z-40 bg-white dark:bg-[var(--bg-elevated)] border-b border-gray-200 dark:border-[var(--border-subtle)]">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {mainNavItems.concat(secondaryNavItems).map((item) => {
              const isActive =
                item.href === '/admin/org-chart'
                  ? pathname.startsWith('/admin/org-chart')
                  : pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-base font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                  )}
                >
                  {Icon ? <Icon className="w-4 h-4 mr-3" /> : null}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <main className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
