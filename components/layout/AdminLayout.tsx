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
  CalendarDays,
  Settings,
  MessageCircle,
  LayoutGrid,
  Network,
  Plug,
  DollarSign,
  LineChart,
  FileText,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { trackPageView } from '@/lib/activity-tracker'
import { useTheme } from '@/components/theme/ThemeProvider'
import AdminNotificationBell from '@/components/admin/AdminNotificationBell'

interface AdminLayoutProps {
  children: React.ReactNode
  showBillingNav?: boolean
  showOperationsNav?: boolean
  showScheduleNav?: boolean
  /** Kazi executive portal — indigo accent + reorganized nav */
  isExecutive?: boolean
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard }

const standardMainNav: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Employees and Candidates', icon: Users },
  { href: '/admin/interviews', label: 'Interviews', icon: Calendar },
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
]

const secondaryBase: NavItem[] = [
  { href: '/admin/documents', label: 'Documents', icon: FileText },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/admin/messages', label: 'Messages', icon: MessageCircle },
  { href: '/admin/scheduling-beta', label: 'Scheduling demo', icon: LayoutGrid },
  { href: '/admin/settings/availability', label: 'My Availability', icon: CalendarClock },
  { href: '/admin/settings/workflows', label: 'Workflow Settings', icon: Settings },
  { href: '/admin/org-chart', label: 'Company hierarchy', icon: Network },
  { href: '/admin/mcp-activity', label: 'MCP Activity', icon: Plug },
  { href: '/admin/mcp-connections', label: 'MCP Connections', icon: Plug },
]

const themeOrder: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']

const billingNavItem: NavItem = { href: '/billing/dashboard', label: 'Billing', icon: DollarSign }
const payrollNavItem: NavItem = { href: '/admin/payroll', label: 'Payroll', icon: DollarSign }
const operationsNavItem: NavItem = { href: '/operations', label: 'Operations', icon: LineChart }

const EXEC_ACCENT = '#4F46E5'

function pathIsActive(pathname: string, href: string): boolean {
  if (href === '/admin/org-chart') return pathname.startsWith('/admin/org-chart')
  if (href === '/billing/dashboard') return pathname.startsWith('/billing') && !pathname.startsWith('/billing/payroll')
  if (href === '/admin/payroll')
    return pathname.startsWith('/admin/payroll') || pathname.startsWith('/billing/payroll')
  if (href === '/operations') return pathname.startsWith('/operations')
  if (href === '/schedule') return pathname.startsWith('/schedule')
  if (href === '/admin/documents') return pathname.startsWith('/admin/documents')
  if (href === '/admin/employees') return pathname.startsWith('/admin/employees') || pathname.startsWith('/admin/rbts')
  return pathname === href
}

function isPortalHref(href: string): boolean {
  return (
    href === '/billing/dashboard' ||
    href === '/admin/payroll' ||
    href === '/operations' ||
    href === '/schedule' ||
    href === '/admin/documents'
  )
}

export default function AdminLayout({
  children,
  showBillingNav,
  showOperationsNav,
  showScheduleNav: _showScheduleNav = true,
  isExecutive = false,
}: AdminLayoutProps) {
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

  const mainNavItems = useMemo((): NavItem[] => {
    if (!isExecutive) return standardMainNav
    const top: NavItem[] = [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
    if (showBillingNav) {
      top.push(payrollNavItem)
      top.push(billingNavItem)
    }
    top.push({ href: '/schedule', label: 'Schedule', icon: CalendarDays })
    top.push({ href: '/admin/documents', label: 'Documents', icon: FileText })
    return top
  }, [isExecutive, showBillingNav])

  const moreItems = useMemo((): NavItem[] => {
    if (isExecutive) {
      const items: NavItem[] = [
        { href: '/admin/employees', label: 'Employees and Candidates', icon: Users },
        { href: '/admin/interviews', label: 'Interviews', icon: Calendar },
        { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
        { href: '/admin/messages', label: 'Messages', icon: MessageCircle },
        { href: '/admin/scheduling-beta', label: 'Scheduling demo', icon: LayoutGrid },
        { href: '/admin/settings/availability', label: 'My Availability', icon: CalendarClock },
        { href: '/admin/settings/workflows', label: 'Workflow Settings', icon: Settings },
        { href: '/admin/org-chart', label: 'Company hierarchy', icon: Network },
        { href: '/admin/mcp-activity', label: 'MCP Activity', icon: Plug },
        { href: '/admin/mcp-connections', label: 'MCP Connections', icon: Plug },
      ]
      if (showOperationsNav) items.splice(4, 0, operationsNavItem)
      return items
    }
    return [
      ...(showBillingNav ? [billingNavItem, payrollNavItem] : []),
      ...(showOperationsNav ? [operationsNavItem] : []),
      ...secondaryBase,
    ]
  }, [isExecutive, showBillingNav, showOperationsNav])

  const moreMenuHasActive = useMemo(
    () => moreItems.some((i) => pathIsActive(pathname, i.href)),
    [pathname, moreItems]
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  const navLinkClass = (isActive: boolean) =>
    cn(
      'inline-flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors',
      isActive
        ? isExecutive
          ? 'text-white'
          : 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
        : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
    )

  const activeStyle = isExecutive
    ? { backgroundColor: EXEC_ACCENT, color: '#fff' }
    : undefined

  const brandColor = isExecutive ? EXEC_ACCENT : '#e36f1e'

  return (
    <div
      className={cn(
        'min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)]',
        isExecutive && 'executive-admin-portal'
      )}
    >
      <nav
        className={cn(
          'nav-header relative z-50 overflow-visible bg-white border-b dark:bg-[var(--bg-elevated)]',
          isExecutive
            ? 'border-indigo-100 dark:border-indigo-900/40'
            : 'border-gray-200 dark:border-[var(--border-subtle)]'
        )}
      >
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
                <div className="flex flex-col">
                  <span
                    className="text-lg font-bold tracking-normal whitespace-nowrap dark:text-[var(--text-primary)]"
                    style={{
                      color: brandColor,
                      fontFamily:
                        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      letterSpacing: '0.01em',
                      fontWeight: 700,
                    }}
                  >
                    Rise and shine
                  </span>
                  {isExecutive && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500/80">
                      Executive
                    </span>
                  )}
                </div>
              </div>
            </Link>

            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 overflow-visible">
              {mainNavItems.map((item) => {
                const isActive = pathIsActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navLinkClass(isActive)}
                    style={isActive ? activeStyle : undefined}
                  >
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
                  style={moreMenuHasActive ? activeStyle : undefined}
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
                      {moreItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathIsActive(pathname, item.href)
                        const portal = isPortalHref(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              'flex items-center px-3 py-2 text-sm',
                              isActive
                                ? portal && !isExecutive
                                  ? 'bg-[#0D9488] text-white'
                                  : isExecutive
                                    ? 'text-white'
                                    : 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]',
                              portal && !isActive && !isExecutive && 'hover:bg-teal-50 dark:hover:bg-teal-950/30'
                            )}
                            style={
                              isActive && isExecutive
                                ? { backgroundColor: EXEC_ACCENT }
                                : undefined
                            }
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
            {mainNavItems.concat(moreItems).map((item) => {
              const isActive = pathIsActive(pathname, item.href)
              const portal = isPortalHref(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-base font-medium',
                    isActive
                      ? portal && !isExecutive
                        ? 'bg-[#0D9488] text-white'
                        : isExecutive
                          ? 'text-white'
                          : 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]'
                  )}
                  style={isActive && isExecutive ? { backgroundColor: EXEC_ACCENT } : undefined}
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
