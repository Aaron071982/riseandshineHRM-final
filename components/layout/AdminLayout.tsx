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
  Clock,
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
  Shield,
} from 'lucide-react'
import ActionCenterNavLink from '@/components/admin/ActionCenterNavLink'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { trackPageView } from '@/lib/activity-tracker'
import { useTheme } from '@/components/theme/ThemeProvider'
import AdminNotificationBell from '@/components/admin/AdminNotificationBell'

interface AdminLayoutProps {
  children: React.ReactNode
}

const mainNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/action-center', label: 'Action Center', icon: null, isActionCenter: true },
  { href: '/admin/employees', label: 'Employees and Candidates', icon: Users },
  { href: '/admin/interviews', label: 'Interviews', icon: Calendar },
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
]

const secondaryNavItems = [
  { href: '/admin/attendance', label: 'Attendance & Hours', icon: Clock },
  { href: '/admin/messages', label: 'Messages', icon: MessageCircle },
  { href: '/admin/scheduling-beta', label: 'Scheduling demo', icon: LayoutGrid },
  { href: '/admin/settings/availability', label: 'My Availability', icon: CalendarClock },
  { href: '/admin/settings/workflows', label: 'Workflow Settings', icon: Settings },
  { href: '/admin/settings/compliance', label: 'Compliance', icon: Shield },
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

  // Track page views
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, {
        timestamp: new Date().toISOString(),
      })
    }
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)]">
      {/* Top Navigation */}
      <nav className="nav-header bg-white border-b border-gray-200 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin/dashboard" className="flex items-center">
                <div className="flex items-center gap-4">
                  <Image
                    src="/new-real-logo.png"
                    alt="Rise and Shine"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                  <span className="text-lg font-bold tracking-normal text-[#e36f1e] dark:text-[var(--text-primary)] whitespace-nowrap" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', letterSpacing: '0.01em', fontWeight: 700 }}>
                    Rise and shine
                  </span>
                </div>
              </Link>
              <div className="hidden md:ml-6 lg:ml-6 md:flex md:space-x-0.5">
                {mainNavItems.map((item) => {
                  const isActive = pathname === item.href
                  if ('isActionCenter' in item && item.isActionCenter) {
                    return (
                      <ActionCenterNavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        isActive={isActive}
                      />
                    )
                  }
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'inline-flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                      )}
                    >
                      {Icon ? <Icon className="w-4 h-4 mr-1" /> : null}
                      {item.label}
                    </Link>
                  )
                })}
                {/* More dropdown for secondary items */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className={cn(
                      'inline-flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors',
                      secondaryNavItems.some((i) =>
                        i.href === '/admin/org-chart'
                          ? pathname.startsWith('/admin/org-chart')
                          : pathname === i.href
                      )
                        ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                    )}
                  >
                    More
                    <span className="ml-1 text-xs">▾</span>
                  </button>
                  {moreOpen && (
                    <div className="absolute mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] z-20">
                      <div className="py-1">
                        {secondaryNavItems.map((item) => {
                          const Icon = item.icon
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                'flex items-center px-2 py-2 text-sm',
                                isActive
                                  ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                                  : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                              )}
                            >
                              {Icon ? <Icon className="w-4 h-4 mr-1" /> : null}
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[var(--bg-elevated)] border-b border-gray-200 dark:border-[var(--border-subtle)]">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {mainNavItems.concat(secondaryNavItems).map((item) => {
              const isActive =
                item.href === '/admin/org-chart'
                  ? pathname.startsWith('/admin/org-chart')
                  : pathname === item.href
              if ('isActionCenter' in item && item.isActionCenter) {
                return (
                  <ActionCenterNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    isActive={isActive}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors"
                  />
                )
              }
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

