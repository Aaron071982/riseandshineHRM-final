'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Users,
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
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
  { href: '/admin/documents', label: 'Compliance', icon: Shield },
  { href: '/operations', label: 'Reports', icon: LineChart },
]

function pathActive(pathname: string, href: string): boolean {
  if (href === '/client-services') {
    return pathname === '/client-services' || pathname === '/client-services/'
  }
  if (href === '/client-services/admin') {
    return pathname.startsWith('/client-services/admin')
  }
  if (href.startsWith('/client-services/dept/')) {
    return pathname === href || pathname.startsWith(href + '/')
  }
  if (href === '/client-services/clients') {
    return (
      pathname === '/client-services/clients' ||
      pathname.startsWith('/client-services/clients/')
    )
  }
  if (href === '/admin/employees') {
    return pathname.startsWith('/admin/employees') || pathname.startsWith('/admin/rbts')
  }
  if (href === '/client-services/therapist-search') {
    return pathname.startsWith('/client-services/therapist-search')
  }
  if (href === '/client-services/schedule') {
    return pathname.startsWith('/client-services/schedule')
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
        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
        'justify-center min-[1080px]:justify-start',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        active
          ? 'bg-white/10 text-white'
          : 'text-side-txt hover:bg-white/5 hover:text-side-strong'
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r"
          style={{
            background: 'linear-gradient(180deg, var(--sunrise-a), var(--sunrise-b))',
          }}
          aria-hidden
        />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="hidden min-[1080px]:inline truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto hidden min-[1080px]:inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--urgent)] px-1.5 text-[11px] font-semibold text-white">
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
        'w-20 min-[1080px]:w-[292px]',
        'bg-[linear-gradient(180deg,var(--side),var(--side-2))]'
      )}
      aria-label="Primary"
    >
      <div className="flex items-center gap-3 px-3 py-6 min-[1080px]:px-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/95 p-1.5 shadow-sm">
          <Image
            src="/new-real-logo.png"
            alt="Rise and Shine"
            width={48}
            height={48}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <div className="hidden min-w-0 min-[1080px]:block">
          <div className="font-display text-[17px] font-bold leading-tight text-side-strong">
            Rise &amp; Shine
          </div>
          <div className="text-xs text-side-dim">ABA · Operations</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
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
                'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
                'justify-center min-[1080px]:justify-start',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                moreHasActive
                  ? 'bg-white/10 text-white'
                  : 'text-side-txt hover:bg-white/5 hover:text-side-strong'
              )}
            >
              <MoreHorizontal className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden min-[1080px]:inline truncate">More</span>
              <ChevronDown
                className={cn(
                  'ml-auto hidden h-4 w-4 min-[1080px]:inline transition-transform',
                  moreOpen && 'rotate-180'
                )}
              />
            </button>
            {moreOpen && (
              <div className="mt-1 space-y-1 min-[1080px]:pl-1">
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

      <div className="mt-auto border-t border-side-line px-3 py-4 min-[1080px]:px-4">
        {restricted && (
          <div className="mb-3 hidden min-[1080px]:flex items-center gap-1.5 rounded-full border border-[var(--phi-pill-border)] bg-[var(--phi-pill-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--phi-pill-fg)]">
            <Lock className="h-3.5 w-3.5" />
            Restricted · Client PHI
          </div>
        )}
        <div className="flex items-center gap-3 justify-center min-[1080px]:justify-start">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--sunrise-a), var(--sunrise-b))',
            }}
          >
            {initials}
          </div>
          <div className="hidden min-w-0 flex-1 min-[1080px]:block">
            <div className="truncate text-sm font-medium text-side-strong">{userName}</div>
            <div className="truncate text-[11px] text-side-dim">{userRole}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] text-side-txt hover:bg-white/5 hover:text-side-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] min-[1080px]:justify-start"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden min-[1080px]:inline">{exitLabel}</span>
        </button>
      </div>
    </aside>
  )
}

export { DEFAULT_NAV }
