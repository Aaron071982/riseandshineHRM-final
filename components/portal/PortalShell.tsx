'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function PortalShell({
  userName,
  credentialsLine,
  children,
}: {
  userName: string
  credentialsLine?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const onPay = pathname?.startsWith('/portal/pay')
  const onPrint = /\/assessments\/[^/]+\/print\/?$/.test(pathname ?? '')

  if (onPrint) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-ink">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rise-and-shine-logo.png"
              alt="Rise & Shine"
              className="h-9 w-auto"
            />
            <div>
              <p className="font-display text-sm font-semibold text-[var(--espresso)]">
                Rise &amp; Shine
              </p>
              <p className="text-xs text-quiet">Clinical portal</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/portal"
              className={
                !onPay
                  ? 'rounded-lg bg-[color-mix(in_srgb,var(--sunrise)_14%,white)] px-3 py-1.5 font-medium text-[var(--espresso)]'
                  : 'rounded-lg px-3 py-1.5 text-quiet hover:bg-canvas hover:text-ink'
              }
            >
              Clients
            </Link>
            <Link
              href="/portal/pay"
              className={
                onPay
                  ? 'rounded-lg bg-[color-mix(in_srgb,var(--sunrise)_14%,white)] px-3 py-1.5 font-medium text-[var(--espresso)]'
                  : 'rounded-lg px-3 py-1.5 text-quiet hover:bg-canvas hover:text-ink'
              }
            >
              Pay stubs
            </Link>
          </nav>

          <div className="text-right text-sm">
            <p className="font-medium text-[var(--espresso)]">{userName}</p>
            {credentialsLine ? (
              <p className="text-xs text-quiet">{credentialsLine}</p>
            ) : null}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
