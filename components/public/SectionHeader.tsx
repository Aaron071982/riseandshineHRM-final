'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface SectionHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  className?: string
}

export default function SectionHeader({ title, description, eyebrow, className = '' }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`text-center mb-12 ${className}`}
    >
      {eyebrow && (
        <p className="text-sm font-medium text-primary mb-2 uppercase tracking-wide">{eyebrow}</p>
      )}
      <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 leading-tight">{title}</h2>
      {description && (
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">{description}</p>
      )}
    </motion.div>
  )
}
