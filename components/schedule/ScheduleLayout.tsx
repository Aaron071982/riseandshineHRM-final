'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, ArrowLeft, CalendarDays } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

export default function ScheduleLayout({
  children,
  userName,
}: {
  children: React.ReactNode
  userName: string
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F4F6F6] dark:bg-[var(--bg-primary)]">
      <header className="bg-[#0A3A3E] text-white border-b border-[#0E4D52]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <h1 className="text-lg font-bold truncate flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#E7A13A]" />
                  Weekly Schedule
                </h1>
                <p className="text-teal-100/80 text-sm truncate">
                  Recurring therapist ↔ client session slots
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Link href="/admin/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-[#0E4D52] hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Admin
                </Button>
              </Link>
              <span className="text-teal-100 text-sm truncate max-w-[140px]">{userName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-white hover:bg-[#0E4D52] hover:text-white"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
            <button
              type="button"
              className="sm:hidden p-2 rounded-md hover:bg-[#0E4D52]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  )
}
