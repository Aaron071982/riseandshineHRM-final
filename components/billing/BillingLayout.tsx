'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  DollarSign,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Receipt,
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { PAYROLL_THEME as T } from '@/lib/payroll/theme'

const nav = [
  { href: '/billing', label: 'Payroll & Billing', match: (p: string) => p === '/billing' || p === '/billing/' },
  { href: '/billing/rates', label: 'Pay Rates', match: (p: string) => p.startsWith('/billing/rates') },
  {
    href: '/billing/cycles/new',
    label: 'New cycle',
    match: (p: string) => p.startsWith('/billing/cycles'),
  },
]

const icons = {
  '/billing': LayoutDashboard,
  '/billing/rates': DollarSign,
  '/billing/cycles/new': Receipt,
} as const

export default function BillingLayout({
  children,
  userName,
  isAdmin,
}: {
  children: React.ReactNode
  userName: string
  isAdmin: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  const NavLinks = () => (
    <>
      {nav.map((item) => {
        const Icon = icons[item.href as keyof typeof icons]
        const isActive = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'text-white'
                : 'text-[#2A2019]/75 hover:bg-[#2A2019]/06'
            )}
            style={isActive ? { backgroundColor: T.espresso } : undefined}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.surface }}>
      <header
        className="text-white border-b"
        style={{
          backgroundColor: T.espresso,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Image
                src="/new-real-logo.png"
                alt="Rise and Shine"
                width={40}
                height={40}
                className="object-contain bg-white rounded-full p-0.5 shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-lg font-display font-bold truncate">
                  Payroll &amp; Billing
                </h1>
                <p className="text-sm truncate opacity-70">
                  1099 contractors · RBT reconciliation · Artemis cycles
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/admin/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Admin
                  </Link>
                </Button>
              )}
              <span className="text-sm opacity-70 hidden lg:inline truncate max-w-[160px]">
                {userName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/10"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto">
        <aside
          className="hidden md:block w-56 shrink-0 p-4 border-r"
          style={{ borderColor: T.border }}
        >
          <nav className="flex flex-col gap-1">
            <NavLinks />
          </nav>
        </aside>

        {mobileOpen && (
          <div
            className="md:hidden border-b bg-white p-3 space-y-1"
            style={{ borderColor: T.border }}
          >
            <NavLinks />
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm"
                style={{ color: T.espresso }}
                onClick={() => setMobileOpen(false)}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm w-full"
              style={{ color: T.espresso }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 min-w-0">{children}</main>
      </div>
    </div>
  )
}
