'use client'

import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Mail, Phone, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

export default function PublicFooter() {
  const quickLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '#about' },
    { name: 'Requirements', href: '#requirements' },
    { name: 'Benefits', href: '#benefits' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Apply Now', href: '/apply' },
    { name: 'Login', href: '/login' },
  ]

  const contactInfo = {
    tollFree: '(888) 898-4774',
    company: '(929) 460-9600',
    email: 'info@riseandshine.nyc',
    hours: 'Mon–Sun: 9:00 AM – 7:00 PM',
  }

  const legalLinks = [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Cookie Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'HIPAA Notice', href: '#' },
    { name: 'Accessibility', href: '#' },
  ]

  const socialLinks = [
    { name: 'Instagram', icon: Instagram, href: '#' },
    { name: 'Facebook', icon: Facebook, href: '#' },
    { name: 'LinkedIn', icon: Linkedin, href: '#' },
  ]

  return (
    <footer className="relative bg-gray-900 text-white mt-auto">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Rise & Shine ABA</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Empowering young children with autism through evidence-based ABA therapy and comprehensive family support.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 pt-2">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <Link
                    key={social.name}
                    href={social.href}
                    className="w-9 h-9 rounded-full bg-gray-800 hover:bg-primary transition-colors duration-200 flex items-center justify-center group"
                  >
                    <Icon className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors duration-200" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Quick Links Column */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors duration-200 inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <a
                    href={`tel:${contactInfo.tollFree.replace(/\s/g, '')}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors duration-200 block"
                  >
                    {contactInfo.tollFree}
                  </a>
                  <a
                    href={`tel:${contactInfo.company.replace(/\s/g, '')}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors duration-200 block mt-1"
                  >
                    {contactInfo.company}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  {contactInfo.email}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                <p className="text-gray-400 text-sm">{contactInfo.hours}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Legal links */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
              {legalLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="hover:text-white transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Copyright */}
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Rise & Shine ABA. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
