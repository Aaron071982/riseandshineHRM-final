'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import type { ShellNavItem } from '@/components/shell/AppSidebar'

const CS_NAV: ShellNavItem[] = [
  { href: '/client-services', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/client-services/clients', label: 'Clients', icon: Users },
]

export default function ClientServicesLayout({
  children,
  userName,
  elevated,
}: {
  children: React.ReactNode
  userName: string
  elevated: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [needsAction, setNeedsAction] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!elevated) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/client-services/crm-dashboard', {
          credentials: 'include',
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setNeedsAction(data.kpis?.needsAttention ?? 0)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [elevated, pathname])

  const exitSection = async () => {
    await fetch('/api/client-services/auth/elevate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/admin/dashboard')
  }

  const onDetail =
    pathname.startsWith('/client-services/clients/') &&
    pathname !== '/client-services/clients'
  const onCaseload = pathname === '/client-services/clients'
  const crumbs = onDetail
    ? [
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Client Services', href: '/client-services' },
        { label: 'Clients', href: '/client-services/clients' },
        { label: 'Client' },
      ]
    : onCaseload
      ? [
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Client Services', href: '/client-services' },
          { label: 'Clients' },
        ]
      : [
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Client Services' },
        ]

  if (!elevated) {
    return (
      <div className="sunrise-shell min-h-screen bg-[var(--bg)] text-ink">
        <div className="mx-auto max-w-lg px-4 py-16">{children}</div>
      </div>
    )
  }

  return (
    <AppShell
      userName={userName}
      userRole="HR & Operations"
      crumbs={crumbs}
      needsActionCount={needsAction}
      navItems={CS_NAV}
      moreItems={[]}
      restricted
      onExit={exitSection}
      exitLabel="Back to Admin"
      searchValue={search}
      onSearchChange={setSearch}
      onSearchSubmit={() => {
        window.dispatchEvent(
          new CustomEvent('cs-global-search', { detail: { q: search } })
        )
        if (!pathname.startsWith('/client-services/clients')) {
          router.push(
            `/client-services/clients${search ? `?q=${encodeURIComponent(search)}` : ''}`
          )
        }
      }}
      showSearch={!onDetail}
    >
      {children}
    </AppShell>
  )
}
