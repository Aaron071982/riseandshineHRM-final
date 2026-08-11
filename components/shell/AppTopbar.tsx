'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AppTopbar({
  crumbs,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search clients, codes, parents…',
  showSearch = true,
  rightSlot,
}: {
  crumbs: { label: string; href?: string }[]
  searchValue?: string
  onSearchChange?: (v: string) => void
  onSearchSubmit?: () => void
  searchPlaceholder?: string
  showSearch?: boolean
  rightSlot?: React.ReactNode
}) {
  const envLabel =
    process.env.NEXT_PUBLIC_APP_ENV?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'Production' : 'Development')
  const isProd = envLabel.toLowerCase() === 'production'

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6',
        'bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-[8px]'
      )}
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-faint">/</span>}
              {c.href && !last ? (
                <a
                  href={c.href}
                  className="truncate text-quiet hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  {c.label}
                </a>
              ) : (
                <span
                  className={cn(
                    'truncate',
                    last ? 'font-semibold text-ink' : 'text-quiet'
                  )}
                >
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-quiet">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: isProd ? 'var(--green)' : 'var(--amber)' }}
          aria-hidden
        />
        {envLabel}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {showSearch && (
          <form
            className="relative hidden md:block"
            onSubmit={(e) => {
              e.preventDefault()
              onSearchSubmit?.()
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-56 rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)] focus:border-brand lg:w-72"
            />
          </form>
        )}
        {rightSlot}
      </div>
    </header>
  )
}
