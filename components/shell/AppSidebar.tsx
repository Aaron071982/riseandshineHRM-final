'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileCheck,
  Shield,
  LineChart,
  Lock,
  LogOut,
  ClipboardList,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ShellNavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
}

const DEFAULT_NAV: ShellNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/client-services', label: 'Clients', icon: Users },
  { href: '/admin/employees', label: 'Therapists', icon: ClipboardList },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
  { href: '/admin/documents', label: 'Compliance', icon: Shield },
  { href: '/operations', label: 'Reports', icon: LineChart },
]

function pathActive(pathname: string, href: string): boolean {
  if (href === '/client-services') return pathname.startsWith('/client-services')
  if (href === '/admin/employees') {
    return pathname.startsWith('/admin/employees') || pathname.startsWith('/admin/rbts')
  }
  if (href === '/schedule') return pathname.startsWith('/schedule')
  if (href === '/operations') return pathname.startsWith('/operations')
  if (href === '/admin/documents') return pathname.startsWith('/admin/documents')
  if (href === '/admin/onboarding') return pathname.startsWith('/admin/onboarding')
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard' || pathname === '/admin'
  if (href === '/billing/dashboard') {
    return pathname.startsWith('/billing') && !pathname.startsWith('/billing/payroll')
  }
  if (href === '/admin/payroll') {
    return pathname.startsWith('/admin/payroll') || pathname.startsWith('/billing/payroll')
  }
  if (href === '/admin/org-chart') return pathname.startsWith('/admin/org-chart')
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLink({
  item,
  active,
}: {
  item: ShellNavItem
  active: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cn(
        'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
        'justify-center min-[1080px]:justify-start',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        active
          ? 'bg-white/10 text-white'
          : 'text-side-txt hover:bg-white/5 hover:text-side-strong'
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r"
          style={{
            background: 'linear-gradient(180deg, var(--sunrise-a), var(--sunrise-b))',
          }}
          aria-hidden
        />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden min-[1080px]:inline truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto hidden min-[1080px]:inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--urgent)] px-1.5 text-[10px] font-semibold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  )
}

export default function AppSidebar({
  navItems = DEFAULT_NAV,
  moreItems = [],
  needsActionCount = 0,
  userName,
  userRole = 'HR & Operations',
  onExit,
  exitLabel = 'Exit',
  restricted = false,
}: {
  navItems?: ShellNavItem[]
  moreItems?: ShellNavItem[]
  needsActionCount?: number
  userName: string
  userRole?: string
  onExit?: () => void
  exitLabel?: string
  restricted?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const moreHasActive = useMemo(
    () => moreItems.some((i) => pathActive(pathname, i.href)),
    [moreItems, pathname]
  )
  const [moreOpen, setMoreOpen] = useState(moreHasActive)

  useEffect(() => {
    if (moreHasActive) setMoreOpen(true)
  }, [moreHasActive])

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U'

  const items = navItems.map((item) =>
    item.href === '/client-services' && needsActionCount > 0
      ? { ...item, badge: needsActionCount }
      : item
  )

  const handleExit = () => {
    if (onExit) onExit()
    else router.push('/')
  }

  return (
    <aside
      className={cn(
        'group/side sticky top-0 z-40 flex h-screen shrink-0 flex-col text-side-txt',
        'w-16 min-[1080px]:w-[238px]',
        'bg-[linear-gradient(180deg,var(--side),var(--side-2))]'
      )}
      aria-label="Primary"
    >
      <div className="flex items-center gap-3 px-3 py-5 min-[1080px]:px-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-display text-base font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--sunrise-a), var(--sunrise-b))',
          }}
          aria-hidden
        >
          R
        </div>
        <div className="hidden min-w-0 min-[1080px]:block">
          <div className="font-display text-[15px] font-bold leading-tight text-side-strong">
            Rise &amp; Shine
          </div>
          <div className="text-[11px] text-side-dim">ABA · Operations</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={pathActive(pathname, item.href)} />
        ))}

        {moreItems.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              title="More"
              aria-expanded={moreOpen}
              className={cn(
                'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                'justify-center min-[1080px]:justify-start',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                moreHasActive
                  ? 'bg-white/10 text-white'
                  : 'text-side-txt hover:bg-white/5 hover:text-side-strong'
              )}
            >
              <MoreHorizontal className="h-4 w-4 shrink-0" />
              <span className="hidden min-[1080px]:inline truncate">More</span>
              <ChevronDown
                className={cn(
                  'ml-auto hidden h-3.5 w-3.5 min-[1080px]:inline transition-transform',
                  moreOpen && 'rotate-180'
                )}
              />
            </button>
            {moreOpen && (
              <div className="mt-0.5 space-y-0.5 min-[1080px]:pl-1">
                {moreItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathActive(pathname, item.href)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="mt-auto border-t border-side-line px-2 py-3 min-[1080px]:px-3">
        {restricted && (
          <div className="mb-3 hidden min-[1080px]:flex items-center gap-1.5 rounded-full border border-[var(--phi-pill-border)] bg-[var(--phi-pill-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--phi-pill-fg)]">
            <Lock className="h-3 w-3" />
            Restricted · Client PHI
          </div>
        )}
        <div className="flex items-center gap-2.5 justify-center min-[1080px]:justify-start">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--sunrise-a), var(--sunrise-b))',
            }}
          >
            {initials}
          </div>
          <div className="hidden min-w-0 flex-1 min-[1080px]:block">
            <div className="truncate text-xs font-medium text-side-strong">{userName}</div>
            <div className="truncate text-[10px] text-side-dim">{userRole}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-side-txt hover:bg-white/5 hover:text-side-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] min-[1080px]:justify-start"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden min-[1080px]:inline">{exitLabel}</span>
        </button>
      </div>
    </aside>
  )
}

export { DEFAULT_NAV }
