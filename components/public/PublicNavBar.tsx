'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function PublicNavBar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Rise and Shine"
              width={120}
              height={48}
              className="object-contain"
            />
          </Link>

          {/* Navigation Links (hidden on mobile, visible on desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#about" className="text-gray-700 hover:text-primary transition-colors">
              About
            </a>
            <a href="#benefits" className="text-gray-700 hover:text-primary transition-colors">
              Benefits
            </a>
            <a href="#requirements" className="text-gray-700 hover:text-primary transition-colors">
              Requirements
            </a>
            <a href="#how-it-works" className="text-gray-700 hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#faq" className="text-gray-700 hover:text-primary transition-colors">
              FAQ
            </a>
          </div>

          {/* Login Button */}
          <Link href="/login">
            <Button className="gradient-primary text-white border-0">
              Login
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
