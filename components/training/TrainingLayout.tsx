'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  Users,
  History,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const nav = [
  { href: '/training/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/training/sessions', label: 'Sessions', icon: Calendar },
  { href: '/training/trainees', label: 'Trainees', icon: Users },
  { href: '/training/history', label: 'History', icon: History },
]

export default function TrainingLayout({
  children,
  userName,
}: {
  children: React.ReactNode
  userName: string
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
        const active = pathname === item.href || (item.href !== '/training/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[var(--bg-elevated-hover)]'
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
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--bg-primary)] flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-gray-200 md:dark:border-[var(--border-subtle)] md:bg-white md:dark:bg-[var(--bg-elevated)] md:p-4 md:gap-2">
        <div className="flex items-center gap-2 mb-6 px-1">
          <GraduationCap className="w-8 h-8 text-[#e36f1e] dark:text-[var(--orange-primary)]" />
          <div>
            <p className="text-xs text-gray-500">Training</p>
            <p className="font-semibold text-sm truncate max-w-[140px]">{userName}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLinks />
        </nav>
        <div className="mt-auto pt-4">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between border-b border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] px-4 py-3">
          <Link href="/training/dashboard" className="flex items-center gap-2">
            <Image src="/new-real-logo.png" alt="" width={36} height={36} />
            <span className="font-semibold text-[#e36f1e] dark:text-[var(--text-primary)]">Training</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </header>
        {mobileOpen && (
          <div className="md:hidden border-b bg-white dark:bg-[var(--bg-elevated)] px-4 py-3 flex flex-col gap-1">
            <NavLinks />
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
        <main className="flex-1 p-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  )
}
