'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-8">
          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Join Our Team:{' '}
              <span className="text-primary">Registered Behavior Technician (RBT)</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Where Growth Begins
            </p>
          </div>

          {/* Description */}
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Specialized Applied Behavior Analysis services for children with autism, helping them
            develop essential skills for communication, social interaction, and daily living in a
            supportive, family-centered environment.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/apply">
              <Button
                size="lg"
                className="gradient-primary text-white border-0 px-8 py-6 text-lg font-semibold"
              >
                Apply Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#about">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-gray-300 px-8 py-6 text-lg font-semibold"
              >
                Learn More
              </Button>
            </Link>
          </div>

          {/* Key Differentiators */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
              BCBA Certified
            </div>
            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
              Insurance Accepted
            </div>
            <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium">
              Family-Centered
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
