'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

interface CTASectionProps {
  title: string
  description: string
  ctaText: string
  ctaHref: string
  variant?: 'default' | 'gradient'
}

export default function CTASection({
  title,
  description,
  ctaText,
  ctaHref,
  variant = 'gradient',
}: CTASectionProps) {
  if (variant === 'gradient') {
    return (
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(228, 137, 61, 0.08) 0%, rgba(255, 159, 90, 0.05) 100%)',
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-white/95 backdrop-blur-sm rounded-cardLg border-2 border-primary/20 shadow-cardGlow">
              <CardHeader className="space-y-4 pb-6">
                <CardTitle className="text-3xl md:text-4xl font-semibold text-gray-900">{title}</CardTitle>
                <CardDescription className="text-lg text-gray-600 leading-relaxed">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={ctaHref}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      size="lg"
                      className="gradient-primary text-white border-0 rounded-button px-8 py-6 text-lg font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                    >
                      {ctaText}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-white rounded-cardLg border border-gray-200 shadow-cardHover">
            <CardHeader className="space-y-4 pb-6">
              <CardTitle className="text-3xl md:text-4xl font-semibold text-gray-900">{title}</CardTitle>
              <CardDescription className="text-lg text-gray-600 leading-relaxed">{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={ctaHref}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    size="lg"
                    className="gradient-primary text-white border-0 rounded-button px-8 py-6 text-lg font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                  >
                    {ctaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
