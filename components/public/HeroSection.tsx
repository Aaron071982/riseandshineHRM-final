'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowRight,
  CheckCircle,
  Users,
  Smile,
  TrendingUp,
  HeartHandshake,
  Clock,
  Shield,
  LogIn,
} from 'lucide-react'
import { motion } from 'framer-motion'
import IconChip from './IconChip'

export default function HeroSection() {
  const floatingStats = [
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Active Sessions',
      value: '54+',
      color: 'blue' as const,
    },
    {
      icon: <Smile className="h-4 w-4" />,
      label: 'Child-Friendly',
      value: '100%',
      color: 'green' as const,
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Success Rate',
      value: '95%',
      color: 'purple' as const,
    },
  ]

  const trustPoints = [
    { icon: <Shield className="h-4 w-4" />, text: 'Clinical supervision' },
    { icon: <Clock className="h-4 w-4" />, text: 'Flexible scheduling' },
    { icon: <HeartHandshake className="h-4 w-4" />, text: 'Supportive team' },
  ]

  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Content */}
          <div className="space-y-8">
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
              <p className="text-xl md:text-2xl text-gray-600 max-w-3xl font-normal">
                Where Growth Begins
              </p>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-lg md:text-xl text-gray-700 leading-relaxed"
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
              className="flex flex-col sm:flex-row items-start gap-4 pt-4"
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

            {/* Returning RBT Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="pt-2"
            >
              <Card className="bg-gradient-to-br from-blue-50 to-orange-50 border border-primary/30 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <IconChip icon={<LogIn className="h-5 w-5" />} size="md" color="orange" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Already part of Rise & Shine?
                      </p>
                      <p className="text-xs text-gray-600 mb-3">
                        Log in to your HRM portal to access your dashboard, schedule, and documents.
                      </p>
                      <Link href="/login">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-2 border-primary/30 text-primary hover:bg-primary/10 rounded-button font-medium transition-all duration-200"
                        >
                          Log in
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Key Differentiators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 pt-4"
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

            {/* Trust Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200"
            >
              {trustPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="text-primary">{point.icon}</div>
                  <span>{point.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: Visual Card */}
          <div className="relative hidden lg:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              {/* Main Visual Card */}
              <Card
                className="bg-gradient-to-br from-orange-50 to-blue-50 rounded-cardLg border-2 border-primary/20 shadow-cardGlow p-8 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 245, 240, 0.8) 0%, rgba(227, 242, 253, 0.6) 100%)',
                  boxShadow: '0 20px 40px rgba(228, 137, 61, 0.15), 0 0 0 1px rgba(228, 137, 61, 0.1)',
                }}
              >
                {/* Light highlight */}
                <div
                  className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, transparent 60%)',
                  }}
                />
                <div className="relative z-10 text-center space-y-6">
                  <div className="flex justify-center">
                    <IconChip icon={<HeartHandshake className="h-7 w-7" />} size="lg" color="orange" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">ABA Therapy</h3>
                    <p className="text-gray-600">Evidence-based intervention for children with autism</p>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-4 right-4 w-20 h-20 bg-orange-200/20 rounded-full blur-2xl" />
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-blue-200/20 rounded-full blur-2xl" />
              </Card>

              {/* Floating Stat Cards */}
              {floatingStats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20, x: index === 0 ? -20 : index === 1 ? 20 : -10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.4 + index * 0.1,
                    type: 'spring',
                    stiffness: 100,
                  }}
                  whileHover={{ y: -4 }}
                  className={`absolute ${
                    index === 0
                      ? 'top-8 -right-8'
                      : index === 1
                        ? 'bottom-16 -left-8'
                        : 'top-1/2 -right-12'
                  } ${index === 0 ? 'bob-animation' : index === 1 ? 'bob-animation-delayed-1' : 'bob-animation-delayed-2'}`}
                >
                  <Card className="bg-white rounded-card border border-gray-200 shadow-floating p-4 min-w-[140px]">
                    <CardContent className="p-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <IconChip icon={stat.icon} size="sm" color={stat.color} />
                        <div>
                          <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                          <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
