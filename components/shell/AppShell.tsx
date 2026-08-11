'use client'

import AppSidebar, { type ShellNavItem } from '@/components/shell/AppSidebar'
import AppTopbar from '@/components/shell/AppTopbar'

export default function AppShell({
  children,
  userName,
  userRole,
  crumbs,
  needsActionCount = 0,
  navItems,
  moreItems,
  onExit,
  exitLabel,
  restricted = false,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  showSearch = true,
  topbarRight,
}: {
  children: React.ReactNode
  userName: string
  userRole?: string
  crumbs: { label: string; href?: string }[]
  needsActionCount?: number
  navItems?: ShellNavItem[]
  moreItems?: ShellNavItem[]
  onExit?: () => void
  exitLabel?: string
  restricted?: boolean
  searchValue?: string
  onSearchChange?: (v: string) => void
  onSearchSubmit?: () => void
  showSearch?: boolean
  topbarRight?: React.ReactNode
}) {
  return (
    <div className="sunrise-shell flex min-h-screen bg-[var(--bg)] text-ink">
      <AppSidebar
        userName={userName}
        userRole={userRole}
        needsActionCount={needsActionCount}
        navItems={navItems}
        moreItems={moreItems}
        onExit={onExit}
        exitLabel={exitLabel}
        restricted={restricted}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          crumbs={crumbs}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
          showSearch={showSearch}
          rightSlot={topbarRight}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
