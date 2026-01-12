'use client'

import PublicNavBar from './PublicNavBar'
import SoftBackgroundBlobs from './SoftBackgroundBlobs'
import HeroSection from './HeroSection'
import FeatureCards from './FeatureCards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Heart,
  Users,
  GraduationCap,
  DollarSign,
  Clock,
  Shield,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

export default function PublicCareersLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const whatRbtsDo = [
    {
      icon: <Heart className="h-6 w-6" />,
      title: 'Work One-on-One',
      description:
        'Provide direct ABA therapy to children with autism, building meaningful relationships and supporting their development.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Support Families',
      description:
        'Collaborate with parents and caregivers to ensure consistent support and progress across home and therapy settings.',
    },
    {
      icon: <GraduationCap className="h-6 w-6" />,
      title: 'Implement Programs',
      description:
        'Follow individualized treatment plans designed by BCBAs, tracking progress and adapting strategies as needed.',
    },
  ]

  const benefits = [
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: 'Competitive Pay',
      description: 'Fair compensation that recognizes your expertise and dedication to helping children thrive.',
    },
    {
      icon: <GraduationCap className="h-6 w-6" />,
      title: 'Mentorship & Growth',
      description:
        'Learn from experienced BCBAs and grow your career with ongoing training and professional development opportunities.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Supportive Team',
      description:
        'Join a collaborative environment where your contributions matter and you receive the support you need to succeed.',
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'Flexible Scheduling',
      description:
        'Work schedules that accommodate your life, with most sessions occurring after school hours and on weekends.',
    },
  ]

  const requirements = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'RBT Certification',
      description:
        'RBT certification or willingness to complete the 40-hour RBT course and obtain certification (we support this process).',
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: 'Background Check',
      description:
        'Ability to pass a comprehensive background check, including criminal history and reference verification.',
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'Availability',
      description:
        'Available for sessions after 2PM on weekdays and/or weekends, as most therapy occurs during these times.',
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: 'Passion for Helping',
      description:
        'Genuine passion for working with children with autism and supporting their growth and development.',
    },
  ]

  const howItWorks = [
    { step: 1, title: 'Apply', description: 'Submit your application through our simple online form.' },
    {
      step: 2,
      title: 'Screening',
      description: 'Our team reviews your application and qualifications.',
    },
    {
      step: 3,
      title: 'Interview',
      description: 'Meet with our team to discuss the role and your fit.',
    },
    {
      step: 4,
      title: 'Onboarding',
      description: 'Complete training and get ready to make a difference.',
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
    <div className="min-h-screen bg-white">
      <SoftBackgroundBlobs />
      <PublicNavBar />

      {/* Hero Section */}
      <HeroSection />

      {/* What RBTs Do */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What RBTs Do
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            As a Registered Behavior Technician, you&apos;ll play a vital role in helping children
            with autism reach their full potential.
          </p>
        </div>
          <FeatureCards features={whatRbtsDo} />
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Work With Rise & Shine?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We&apos;re committed to supporting our team members and creating a positive work
            environment.
          </p>
        </div>
          <FeatureCards features={benefits} />
        </div>
      </section>

      {/* Requirements */}
      <section id="requirements" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Requirements
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Here&apos;s what we&apos;re looking for in our RBT candidates.
          </p>
        </div>
          <FeatureCards features={requirements} />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our simple application and hiring process makes it easy to get started.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item) => (
              <Card key={item.step} className="text-center border-2 border-gray-100 shadow-md">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card
                key={index}
                className="border-2 border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardHeader
                  className="flex flex-row items-center justify-between"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <CardTitle className="text-left">{faq.question}</CardTitle>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </CardHeader>
                {openFaq === index && (
                  <CardContent>
                    <p className="text-gray-600">{faq.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-white to-orange-50/50">
            <CardHeader className="space-y-4">
              <CardTitle className="text-3xl md:text-4xl font-bold text-gray-900">
                Ready to Make a Difference?
              </CardTitle>
              <CardDescription className="text-lg text-gray-600">
                Join our team and help children with autism reach their full potential. Start your
                application today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/apply">
                <Button
                  size="lg"
                  className="gradient-primary text-white border-0 px-8 py-6 text-lg font-semibold"
                >
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} Rise & Shine ABA. All rights reserved.
          </p>
          <div className="mt-4 space-x-6">
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
