'use client'

import PublicNavBar from './PublicNavBar'
import PublicBackground from './PublicBackground'
import HeroSection from './HeroSection'
import FeatureCards from './FeatureCards'
import SectionHeader from './SectionHeader'
import SectionDivider from './SectionDivider'
import CTASection from './CTASection'
import PublicFooter from './PublicFooter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  HeartHandshake,
  Users,
  GraduationCap,
  DollarSign,
  Clock,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CalendarDays,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import IconChip from './IconChip'

export default function PublicCareersLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const whatRbtsDo = [
    {
      icon: <HeartHandshake className="h-5 w-5" />,
      title: 'Work One-on-One',
      description:
        'Provide direct ABA therapy to children with autism, building meaningful relationships and supporting their development.',
      color: 'orange' as const,
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Support Families',
      description:
        'Collaborate with parents and caregivers to ensure consistent support and progress across home and therapy settings.',
      color: 'blue' as const,
    },
    {
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Implement Programs',
      description:
        'Follow individualized treatment plans designed by BCBAs, tracking progress and adapting strategies as needed.',
      color: 'purple' as const,
    },
  ]

  const benefits = [
    {
      icon: <DollarSign className="h-5 w-5" />,
      title: 'Competitive Pay',
      description: 'Fair compensation that recognizes your expertise and dedication to helping children thrive.',
      color: 'green' as const,
      featured: true,
    },
    {
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Mentorship & Growth',
      description:
        'Learn from experienced BCBAs and grow your career with ongoing training and professional development opportunities.',
      color: 'purple' as const,
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Supportive Team',
      description:
        'Join a collaborative environment where your contributions matter and you receive the support you need to succeed.',
      color: 'blue' as const,
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: 'Flexible Scheduling',
      description:
        'Work schedules that accommodate your life, with most sessions occurring after school hours and on weekends.',
      color: 'orange' as const,
    },
  ]

  const requirements = [
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'RBT Certification',
      description:
        'RBT certification or willingness to complete the 40-hour RBT course and obtain certification (we support this process).',
      color: 'blue' as const,
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: 'Background Check',
      description:
        'Ability to pass a comprehensive background check, including criminal history and reference verification.',
      color: 'green' as const,
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: 'Availability',
      description:
        'Available for sessions after 2PM on weekdays and/or weekends, as most therapy occurs during these times.',
      color: 'orange' as const,
    },
    {
      icon: <HeartHandshake className="h-5 w-5" />,
      title: 'Passion for Helping',
      description:
        'Genuine passion for working with children with autism and supporting their growth and development.',
      color: 'pink' as const,
    },
  ]

  const howItWorks = [
    {
      step: 1,
      icon: <ClipboardCheck className="h-5 w-5" />,
      title: 'Apply',
      description: 'Submit your application through our simple online form.',
      color: 'orange' as const,
    },
    {
      step: 2,
      icon: <Users className="h-5 w-5" />,
      title: 'Review',
      description: 'Our team reviews your application and qualifications.',
      color: 'blue' as const,
    },
    {
      step: 3,
      icon: <CalendarDays className="h-5 w-5" />,
      title: 'Interview',
      description: 'Meet with our team to discuss the role and your fit.',
      color: 'purple' as const,
    },
    {
      step: 4,
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Onboarding',
      description: 'Complete training and get ready to make a difference.',
      color: 'green' as const,
    },
  ]

  const faqs = [
    {
      question: 'Do I need RBT certification to apply?',
      answer:
        'While RBT certification is preferred, we accept applications from candidates willing to complete the 40-hour RBT course. We provide support and resources to help you obtain certification.',
    },
    {
      question: 'What are the typical work hours?',
      answer:
        'Most RBT sessions occur after school hours (after 2PM) on weekdays and on weekends. This schedule allows us to work with children when they are available, typically after school and on weekends.',
    },
    {
      question: 'What training do you provide?',
      answer:
        'We provide comprehensive training including ABA principles, behavior management techniques, data collection, and working with children with autism. Ongoing supervision and support from BCBAs is also provided.',
    },
    {
      question: 'Is this a full-time or part-time position?',
      answer:
        'We offer both full-time and part-time positions, depending on availability and client needs. During the application process, we discuss your preferred hours and match you with appropriate opportunities.',
    },
    {
      question: 'What benefits do you offer?',
      answer:
        'Benefits vary by position type and include competitive pay, ongoing training, mentorship from BCBAs, and a supportive team environment. Specific benefits are discussed during the interview process.',
    },
  ]

  return (
    <div className="min-h-screen bg-white relative">
      <PublicBackground variant="hero" />
      <PublicNavBar />

      {/* Hero Section */}
      <HeroSection />

      <SectionDivider variant="wave" />

      {/* What RBTs Do */}
      <section
        id="about"
        className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(227, 242, 253, 0.3) 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="What RBTs Do"
            description="As a Registered Behavior Technician, you&apos;ll play a vital role in helping children with autism reach their full potential."
          />
          <FeatureCards features={whatRbtsDo} columns={3} />
        </div>
      </section>

      <SectionDivider variant="gradient" />

      {/* Benefits */}
      <section id="benefits" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Why Work With Rise & Shine?"
            description="We&apos;re committed to supporting our team members and creating a positive work environment."
          />
          <FeatureCards features={benefits} columns={4} />
        </div>
      </section>

      <SectionDivider variant="gradient" />

      {/* Requirements */}
      <section
        id="requirements"
        className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(232, 245, 233, 0.3) 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Requirements"
            description="Here&apos;s what we&apos;re looking for in our RBT candidates."
          />
          <FeatureCards features={requirements} columns={4} />
        </div>
      </section>

      <SectionDivider variant="gradient" />

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="How It Works"
            description="Our simple application and hiring process makes it easy to get started."
          />
          <div className="relative">
            {/* Timeline line */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-200 via-blue-200 to-green-200" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {howItWorks.map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="relative"
                >
                  <Card className="bg-white rounded-card border border-gray-200 shadow-sm hover:shadow-cardHover transition-all duration-250 text-center h-full">
                    <CardHeader>
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <IconChip icon={item.icon} size="lg" color={item.color} />
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                            {item.step}
                          </div>
                        </div>
                      </div>
                      <CardTitle className="font-semibold text-gray-900">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base text-gray-600 leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionDivider variant="gradient" />

      {/* FAQs */}
      <section
        id="faq"
        className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(243, 229, 245, 0.2) 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="Frequently Asked Questions" />
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="bg-white rounded-card border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader
                    className="flex flex-row items-center justify-between pb-3 hover:bg-gray-50/50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <IconChip icon={<Sparkles className="h-4 w-4" />} size="sm" color="purple" />
                      <CardTitle className="text-left font-semibold text-gray-900 pr-4">
                        {faq.question}
                      </CardTitle>
                    </div>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {openFaq === index ? (
                        <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      )}
                    </motion.div>
                  </CardHeader>
                  <AnimatePresence>
                    {openFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="pt-0 pb-4 pl-14">
                          <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <CTASection
        title="Ready to Make a Difference?"
        description="Join our team and help children with autism reach their full potential. Start your application today."
        ctaText="Apply Now"
        ctaHref="/apply"
        variant="gradient"
      />

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
