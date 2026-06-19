'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, DollarSign, LogOut, Menu, X, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const nav = [
  { href: '/billing/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing/rates', label: 'Pay Rates', icon: DollarSign },
]

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
        const Icon = item.icon
        const active =
          pathname === item.href ||
          (item.href !== '/billing/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-[#0D9488] text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-950/30'
            )}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)]">
      <header className="bg-[#0D9488] text-white border-b border-teal-700">
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
                <h1 className="text-lg font-bold truncate">Billing & Payroll</h1>
                <p className="text-teal-100 text-sm truncate">
                  Upload Artemis reports and generate payroll
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-teal-700 hover:text-white"
                  asChild
                >
                  <Link href="/admin/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Admin
                  </Link>
                </Button>
              )}
              <span className="text-sm text-teal-100 hidden lg:inline truncate max-w-[160px]">
                {userName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-white hover:bg-teal-700 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-teal-700"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto">
        <aside className="hidden md:block w-56 shrink-0 p-4 border-r border-gray-200 dark:border-[var(--border-subtle)]">
          <nav className="flex flex-col gap-1">
            <NavLinks />
          </nav>
        </aside>

        {mobileOpen && (
          <div className="md:hidden border-b border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-3 space-y-1">
            <NavLinks />
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                onClick={() => setMobileOpen(false)}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 w-full"
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
