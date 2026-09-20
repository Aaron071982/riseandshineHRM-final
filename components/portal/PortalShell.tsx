'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  {
    href: '/portal',
    label: 'Home',
    match: (p: string) => p === '/portal' || p.startsWith('/portal/clients'),
  },
  {
    href: '/portal/inbox',
    label: 'Inbox',
    match: (p: string) => p.startsWith('/portal/inbox'),
  },
  {
    href: '/portal/assessments',
    label: 'Assessments',
    match: (p: string) => p.startsWith('/portal/assessments'),
  },
  {
    href: '/portal/pay',
    label: 'Pay stubs',
    match: (p: string) => p.startsWith('/portal/pay'),
  },
  {
    href: '/portal/onboarding',
    label: 'Onboarding',
    match: (p: string) => p.startsWith('/portal/onboarding'),
  },
] as const

export function PortalShell({
  userName,
  credentialsLine,
  inboxUnread = 0,
  children,
}: {
  userName: string
  credentialsLine?: string | null
  inboxUnread?: number
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const onPrint = /\/assessments\/[^/]+\/print\/?$/.test(pathname)

  if (onPrint) {
    return <>{children}</>
  }

  return (
    <div className="portal-shell min-h-screen bg-[var(--portal-paper)] text-ink">
      <header className="sticky top-0 z-40 bg-[var(--espresso)] text-[#F3EADD]">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Link href="/portal" className="flex items-center gap-3 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rise-and-shine-mark.png"
              alt=""
              width={40}
              height={52}
              className="h-10 w-auto"
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold tracking-tight text-[#F3EADD] sm:text-xl">
                Rise &amp; Shine
              </p>
              <p className="text-xs font-medium text-[#F3EADD]/80">
                Clinical Portal
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm sm:text-[15px]">
            {NAV.map((item) => {
              const active = item.match(pathname)
              const showBadge = item.href === '/portal/inbox' && inboxUnread > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative rounded-lg px-3.5 py-2 transition-colors',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--portal-orange)_28%,transparent)] font-medium text-white'
                      : 'text-[#F3EADD]/80 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {item.label}
                  {showBadge ? (
                    <span className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--portal-orange)] px-1 text-[10px] font-bold text-white">
                      {inboxUnread > 99 ? '99+' : inboxUnread}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>

          <div className="text-right text-sm">
            <p className="font-medium text-[#F3EADD]">{userName}</p>
            {credentialsLine ? (
              <p className="text-xs text-[#F3EADD]/70">{credentialsLine}</p>
            ) : null}
          </div>
        </div>
      </header>
      <main className="w-full">{children}</main>
    </div>
  )
}
