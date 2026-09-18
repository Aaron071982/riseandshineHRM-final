'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/portal', label: 'Clients', match: (p: string) => p === '/portal' || p.startsWith('/portal/clients') },
  { href: '/portal/assessments', label: 'Assessments', match: (p: string) => p.startsWith('/portal/assessments') },
  { href: '/portal/pay', label: 'Pay stubs', match: (p: string) => p.startsWith('/portal/pay') },
  { href: '/portal/onboarding', label: 'Onboarding', match: (p: string) => p.startsWith('/portal/onboarding') },
] as const

export function PortalShell({
  userName,
  credentialsLine,
  children,
}: {
  userName: string
  credentialsLine?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const onPrint = /\/assessments\/[^/]+\/print\/?$/.test(pathname)

  if (onPrint) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rise-and-shine-logo.png"
              alt="Rise & Shine"
              className="h-9 w-auto"
            />
            <div className="hidden sm:block">
              <p className="font-display text-sm font-semibold text-[var(--espresso)]">
                Rise &amp; Shine
              </p>
              <p className="text-xs text-quiet">Clinical portal</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--sunrise)_14%,white)] font-medium text-[var(--espresso)]'
                      : 'text-quiet hover:bg-canvas hover:text-ink'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="text-right text-sm">
            <p className="font-medium text-[var(--espresso)]">{userName}</p>
            {credentialsLine ? (
              <p className="text-xs text-quiet">{credentialsLine}</p>
            ) : null}
          </div>
        </div>
      </header>
      <main className="w-full">{children}</main>
    </div>
  )
}
