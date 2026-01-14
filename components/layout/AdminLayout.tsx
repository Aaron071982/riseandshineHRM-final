'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileCheck,
  Clock,
  CalendarDays,
  UserCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

interface AdminLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/rbts', label: 'RBTs & Candidates', icon: Users },
  { href: '/admin/interviews', label: 'Interviews', icon: Calendar },
  { href: '/admin/onboarding', label: 'Onboarding', icon: FileCheck },
  { href: '/admin/onboarding-documents', label: 'Onboarding Docs', icon: FileCheck },
  { href: '/admin/attendance', label: 'Attendance & Hours', icon: Clock },
  { href: '/admin/leave', label: 'Leave Requests', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: UserCircle },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-gradient-to-r from-orange-50 via-white to-orange-50 border-b border-orange-200/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin/dashboard" className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Image
                    src="/new-real-logo.png"
                    alt="Rise and Shine"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                  <span className="text-base font-extrabold tracking-tight text-[#e36f1e] whitespace-nowrap">
                    RISE AND SHINE HRM
                  </span>
                </div>
              </Link>
              <div className="hidden md:ml-10 md:flex md:space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold transition-colors border border-transparent',
                        isActive
                          ? 'text-[#e36f1e] bg-orange-50 border-orange-200 shadow-sm'
                          : 'text-gray-800 hover:text-[#e36f1e] hover:bg-orange-50'
                      )}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden ml-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-base font-medium',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

