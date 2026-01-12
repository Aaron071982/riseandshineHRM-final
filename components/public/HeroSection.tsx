'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HeroSection() {
  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-8">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 leading-tight">
              Join Our Team:{' '}
              <span className="text-primary">Registered Behavior Technician (RBT)</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto font-normal">
              Where Growth Begins
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed"
          >
            Specialized Applied Behavior Analysis services for children with autism, helping them
            develop essential skills for communication, social interaction, and daily living in a
            supportive, family-centered environment.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link href="/apply">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  className="gradient-primary text-white border-0 rounded-button px-8 py-6 text-lg font-semibold shadow-button hover:shadow-buttonHover transition-all duration-200"
                >
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
            <Link href="#about">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-gray-300 rounded-button px-8 py-6 text-lg font-semibold bg-white hover:bg-gray-50 transition-all duration-200"
                >
                  Learn More
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Key Differentiators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-8"
          >
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium border border-blue-100">
              BCBA Certified
            </div>
            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium border border-green-100">
              Insurance Accepted
            </div>
            <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium border border-purple-100">
              Family-Centered
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
