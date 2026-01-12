'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

export default function PublicNavBar() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Image
                src="/logo.png"
                alt="Rise and Shine"
                width={120}
                height={48}
                className="object-contain transition-opacity group-hover:opacity-80"
              />
            </motion.div>
          </Link>

          {/* Navigation Links (hidden on mobile, visible on desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="#about"
              className="text-gray-700 hover:text-primary transition-colors duration-200 font-medium text-sm"
            >
              About
            </a>
            <a
              href="#benefits"
              className="text-gray-700 hover:text-primary transition-colors duration-200 font-medium text-sm"
            >
              Benefits
            </a>
            <a
              href="#requirements"
              className="text-gray-700 hover:text-primary transition-colors duration-200 font-medium text-sm"
            >
              Requirements
            </a>
            <a
              href="#how-it-works"
              className="text-gray-700 hover:text-primary transition-colors duration-200 font-medium text-sm"
            >
              How It Works
            </a>
            <a
              href="#faq"
              className="text-gray-700 hover:text-primary transition-colors duration-200 font-medium text-sm"
            >
              FAQ
            </a>
          </div>

          {/* Login Button */}
          <div className="flex flex-col items-end gap-1">
            <Link href="/login">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <Button
                  className="gradient-primary text-white border-0 rounded-button px-7 py-2.5 font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200 hover:ring-2 hover:ring-primary/30"
                  style={{
                    boxShadow: '0 4px 12px rgba(228, 137, 61, 0.25)',
                  }}
                >
                  Login
                </Button>
              </motion.div>
            </Link>
            <span className="hidden lg:block text-xs text-gray-500 font-medium">Returning RBTs</span>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
