'use client'

import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Mail, Phone, MapPin, Clock } from 'lucide-react'
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

  const states = ['New York', 'New Jersey', 'Pennsylvania', 'Connecticut', 'Florida']

  const services = [
    '1:1 ABA Therapy',
    'Assessment & Evaluation',
    'Family Training',
    'School Collaboration',
  ]

  const resources = [
    { name: 'Careers', href: '/apply' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Insurance', href: '#' },
    { name: 'Contact', href: '#' },
  ]

  const contactInfo = {
    tollFree: '(888) 898-4774',
    company: '(929) 460-9600',
    fax: '(888) 898-6260',
    email: 'info@riseandshine.nyc',
    hours: 'Mon–Sun: 9:00 AM – 7:00 PM',
  }

  const legalLinks = [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Cookie Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'HIPAA Notice', href: '#' },
    { name: 'Accessibility', href: '#' },
    { name: 'Disclaimer', href: '#' },
    { name: 'Non-Discrimination Policy', href: '#' },
    { name: 'Client Rights & Responsibilities', href: '#' },
  ]

  const socialLinks = [
    { name: 'Instagram', icon: Instagram, href: '#' },
    { name: 'Facebook', icon: Facebook, href: '#' },
    { name: 'LinkedIn', icon: Linkedin, href: '#' },
  ]

  return (
    <footer className="relative mt-20 bg-gradient-to-b from-[#E4893D] via-[#E4893D] to-[#D87A2E] text-white">
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Left column - Brand */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">Rise and Shine ABA</h3>
              <p className="text-orange-50 text-sm leading-relaxed">
                Empowering young children with autism through evidence-based ABA therapy and
                comprehensive family support.
              </p>
              {/* Social icons */}
              <div className="flex items-center gap-3 pt-2">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                    <Link
                      key={social.name}
                      href={social.href}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200 group"
                    >
                      <Icon className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-200" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-orange-50 hover:text-white text-sm transition-colors duration-200 inline-block hover:translate-x-1 transition-transform duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* States We Serve */}
          <div>
            <h4 className="font-semibold text-lg mb-4">States We Serve</h4>
            <ul className="space-y-2">
              {states.map((state) => (
                <li key={state}>
                  <span className="text-orange-50 text-sm">{state}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Services</h4>
            <ul className="space-y-2">
              {services.map((service) => (
                <li key={service}>
                  <span className="text-orange-50 text-sm">{service}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact Info Section */}
        <div className="mt-12 pt-8 border-t border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-orange-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Toll-Free</p>
                <p className="text-orange-50 text-sm">{contactInfo.tollFree}</p>
                <p className="text-orange-50 text-sm mt-1">{contactInfo.company}</p>
                <p className="text-orange-50 text-xs mt-1">Fax: {contactInfo.fax}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-orange-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Email</p>
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="text-orange-50 hover:text-white text-sm transition-colors duration-200"
                >
                  {contactInfo.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-orange-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Hours</p>
                <p className="text-orange-50 text-sm">{contactInfo.hours}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/20 bg-orange-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Legal links */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-orange-100 mb-4">
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

          {/* Copyright + HIPAA notice */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-orange-100 leading-relaxed">
              © {new Date().getFullYear()} Rise & Shine ABA. All rights reserved.
            </p>
            <p className="text-xs text-orange-100/80 mt-2 leading-relaxed">
              All forms and documents on this website are protected under copyright and HIPAA
              compliance. Unauthorized use, reproduction, or scraping is strictly prohibited.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
