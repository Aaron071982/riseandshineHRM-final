'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Facebook,
  HeartHandshake,
  Instagram,
  Linkedin,
  MapPin,
  Menu,
  Sparkles,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Benefits', href: '#benefits' },
  { label: 'Requirements', href: '#requirements' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
]

const faqItems = [
  {
    q: 'Do I need RBT certification to apply?',
    a: "No. We accept candidates who are willing to complete the 40-hour training course. We'll guide you through the process.",
  },
  {
    q: 'What are the typical work hours?',
    a: 'Most sessions occur after 2PM on weekdays and throughout the day on weekends. We work around your schedule.',
  },
  {
    q: 'How much does the job pay?',
    a: 'Compensation is competitive and based on experience. We discuss pay during the interview process.',
  },
  {
    q: 'Do I need a car?',
    a: 'Transportation to client locations is required. Many of our RBTs use public transit in NYC.',
  },
  {
    q: 'How long does hiring take?',
    a: 'Most candidates complete the process in 2-4 weeks from application to first session.',
  },
  {
    q: 'What training do you provide?',
    a: 'We support you through the 40-hour RBT training course and prepare you for certification.',
  },
  {
    q: 'Is this full-time or part-time?',
    a: 'We offer flexible part-time positions that can grow into full-time as you take on more clients.',
  },
  {
    q: 'What areas do you serve?',
    a: 'We currently serve New York City and surrounding areas including Brooklyn, Queens, Staten Island, and the Bronx.',
  },
]

function SectionIntro({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-10">
      <p className="text-[#F97316] font-semibold tracking-wide">{number}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-[#0F172A]">{title}</h2>
      {subtitle ? <p className="mt-3 text-slate-600 max-w-2xl">{subtitle}</p> : null}
    </div>
  )
}

export default function PublicCareersLandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const tickerText = useMemo(
    () =>
      'Flexible Hours  •  NYC Area  •  Competitive Pay  •  Training Provided  •  BCBA Supervision  •  Career Growth  •  Make a Difference  •  ',
    []
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('reveal-visible')
        })
      },
      { threshold: 0.12 }
    )
    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'))
    revealElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (href: string) => {
    setMobileOpen(false)
    const id = href.replace('#', '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="bg-white text-slate-900 overflow-x-clip">
      <style jsx global>{`
        .reveal-init {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .ticker-track {
          width: max-content;
          animation: tickerMove 25s linear infinite;
        }
        @keyframes tickerMove {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? 'bg-white/95 shadow-sm backdrop-blur border-b border-slate-100' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/new-real-logo.png" alt="Rise and Shine" width={24} height={24} className="object-contain" />
            <span className="font-semibold text-sm sm:text-base tracking-tight text-[#F97316]">Rise and Shine</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                className="text-sm font-medium text-slate-700 hover:text-[#F97316] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-[#F97316]">
              Returning RBT? Log In
            </Link>
            <Link
              href="/apply"
              className="inline-flex items-center rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              Apply Now
            </Link>
          </div>

          <button className="md:hidden text-slate-800" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-7 h-7" />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[60] md:hidden transition ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/35 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-[82%] max-w-sm bg-white shadow-2xl p-6 transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-[#0F172A]">Menu</p>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-8 space-y-5">
            {navItems.map((item) => (
              <button key={item.href} className="block text-left text-base font-medium w-full" onClick={() => scrollToSection(item.href)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-10 space-y-3">
            <Link href="/login" className="block text-sm font-medium text-slate-700">
              Returning RBT? Log In
            </Link>
            <Link href="/apply" className="inline-flex items-center rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-white">
              Apply Now
            </Link>
          </div>
        </aside>
      </div>

      <section className="bg-gradient-to-br from-orange-50 via-white to-amber-50 relative pt-28 pb-10 lg:pb-8">
        <div className="absolute right-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-[#F97316]/20 blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-3 reveal-init" data-reveal>
            <span className="inline-flex rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-[#F97316] border border-orange-200">
              Now Hiring in NYC
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-slate-900">
              Make a Real Impact.
              <br />
              Build a Real Career.
            </h1>
            <p className="mt-6 text-lg text-slate-700 max-w-2xl">
              Join Rise & Shine ABA as a Registered Behavior Technician. Work with children with autism, grow under expert BCBA
              supervision, and be part of a team that actually supports you.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/apply"
                className="inline-flex items-center rounded-xl bg-[#F97316] px-7 py-3.5 text-base font-semibold text-white hover:bg-orange-600 transition"
              >
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <button
                onClick={() => scrollToSection('#benefits')}
                className="inline-flex items-center rounded-xl border border-slate-300 px-7 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-100 transition"
              >
                See What We Offer
              </button>
            </div>
            <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
              {['No experience required', 'Free 40-hour training support', 'Flexible scheduling', 'Weekly pay'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#F97316]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:grid lg:col-span-2 grid-cols-2 gap-4 reveal-init" data-reveal>
            {[
              { value: '48+', label: 'RBTs Hired', icon: <Users className="w-4 h-4" /> },
              { value: '95%', label: 'Candidate Satisfaction', icon: <HeartHandshake className="w-4 h-4" /> },
              { value: '5★', label: 'Team Rating', icon: <Sparkles className="w-4 h-4" /> },
              { value: 'NYC & Surrounding Areas', label: 'Service Area', icon: <MapPin className="w-4 h-4" /> },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl bg-white p-5 shadow-xl shadow-black/10">
                <div className="text-[#F97316]">{card.icon}</div>
                <p className="mt-3 text-2xl font-bold text-[#0F172A] leading-tight">{card.value}</p>
                <p className="mt-1 text-sm text-slate-600">{card.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F97316] py-3 overflow-hidden">
        <div className="ticker-track flex whitespace-nowrap text-white font-medium text-sm sm:text-base">
          <span className="pr-12">{tickerText}</span>
          <span className="pr-12">{tickerText}</span>
          <span className="pr-12">{tickerText}</span>
          <span className="pr-12">{tickerText}</span>
        </div>
      </section>

      <section id="about" className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-start">
          <div className="reveal-init" data-reveal>
            <SectionIntro
              number="01"
              title="What You'll Actually Do"
              subtitle="As an RBT at Rise & Shine, you'll help children build communication, social, and daily living skills through structured one-on-one sessions. You won't be thrown in alone - you'll have clear guidance and real support."
            />
          </div>
          <div className="space-y-4 reveal-init" data-reveal>
            {[
              {
                icon: <Users className="w-5 h-5 text-[#F97316]" />,
                title: 'Work One-on-One',
                description: 'Direct therapy sessions with children, building real relationships.',
              },
              {
                icon: <HeartHandshake className="w-5 h-5 text-[#F97316]" />,
                title: 'Support Families',
                description: 'Be the consistent presence families rely on.',
              },
              {
                icon: <UserRoundCheck className="w-5 h-5 text-[#F97316]" />,
                title: 'Grow Your Skills',
                description: 'Learn from BCBAs in real sessions, not just training videos.',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-orange-50 p-2">{card.icon}</div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A]">{card.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{card.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 reveal-init" data-reveal>
          <blockquote className="rounded-2xl border-l-4 border-[#F97316] bg-white p-6 italic text-slate-700 shadow-sm">
            "Rise & Shine actually trained me and supported me through the whole process. I went from having no experience to running
            sessions within weeks."
            <footer className="mt-3 not-italic font-semibold text-[#0F172A]">- Maria R., RBT since 2024</footer>
          </blockquote>
        </div>
      </section>

      <section id="benefits" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal-init" data-reveal>
            <SectionIntro number="02" title="Why RBTs Choose Rise & Shine" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(
              [
                { Icon: Users, title: 'Competitive Pay', text: 'Fair weekly compensation that reflects your dedication.' },
                { Icon: CalendarDays, title: 'Flexible Hours', text: 'Most sessions after 2PM and on weekends - built around your life.' },
                { Icon: Sparkles, title: 'Free Training Support', text: 'We guide you through the 40-hour course and certification process.' },
                { Icon: HeartHandshake, title: 'BCBA Supervision', text: 'Learn directly from certified clinicians on every case.' },
                { Icon: MapPin, title: 'Local to You', text: 'Sessions matched to your neighborhood and travel preference.' },
                { Icon: ArrowRight, title: 'Career Pathway', text: 'A real pathway from RBT to BCBA with our support.' },
              ] as const
            ).map(({ Icon, title, text }) => (
              <div
                key={title}
                data-reveal
                className="reveal-init rounded-2xl border border-slate-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#F97316] hover:shadow-orange-100"
              >
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-[#F97316]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-[#0F172A]">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="requirements" className="py-20 bg-gradient-to-br from-white via-orange-50/40 to-orange-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal-init" data-reveal>
            <SectionIntro number="03" title="What We're Looking For" subtitle="Less than you might think." />
          </div>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="reveal-init" data-reveal>
              <p className="text-4xl sm:text-5xl font-bold text-[#0F172A] leading-tight">
                You don't need experience.
                <br />
                You need heart.
              </p>
            </div>
            <div className="reveal-init" data-reveal>
              <ul className="space-y-3">
                {[
                  '18 years or older',
                  'Able to pass a background check',
                  'Available afternoons and/or weekends',
                  'Genuine passion for working with children',
                  'Reliable transportation',
                  'Willing to complete 40-hour RBT training (we support this process)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#F97316] mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl bg-[#F97316] p-5 text-white font-medium">
                Already have your RBT certification? You'll be fast-tracked in our process.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-orange-50 text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal-init" data-reveal>
            <p className="text-[#F97316] font-semibold">04</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold">From Application to First Session</h2>
            <p className="mt-3 text-slate-600 max-w-2xl">Most candidates go from applying to working within 2-4 weeks.</p>
          </div>
          <div className="mt-10 relative">
            <div className="hidden lg:block absolute top-10 left-0 right-0 border-t-2 border-dashed border-[#F97316]/70 animate-pulse" />
            <div className="grid lg:grid-cols-4 gap-5">
              {[
                ['Apply (5 minutes)', 'Fill out our simple online application. No resume required.'],
                ['Phone Screen', 'A quick 15-minute call to learn about you and answer your questions.'],
                ['Interview', 'A relaxed video interview with our team. We want to get to know you.'],
                ['Onboard & Start', 'Complete your onboarding documents and get matched to your first client.'],
              ].map(([title, text], idx) => (
                <div key={title} className="reveal-init" data-reveal>
                  <div className="rounded-2xl border border-orange-100 bg-white p-5 h-full shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-[#F97316] text-white flex items-center justify-center font-bold mb-4">{idx + 1}</div>
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 reveal-init" data-reveal>
            <Link
              href="/apply"
              className="inline-flex items-center rounded-xl bg-[#F97316] px-7 py-3.5 text-base font-semibold text-white hover:bg-orange-600 transition"
            >
              Start Your Application <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="reveal-init text-3xl sm:text-4xl font-bold text-[#0F172A] mb-8" data-reveal>
            Questions We Get All The Time
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx
              return (
                <div key={item.q} className="reveal-init rounded-2xl border border-slate-200 bg-white overflow-hidden" data-reveal>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <span className="font-semibold text-[#0F172A]">{item.q}</span>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                  </button>
                  {isOpen ? <p className="px-5 pb-5 text-sm text-slate-600">{item.a}</p> : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-orange-500 to-amber-400 py-20 text-center text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 reveal-init" data-reveal>
          <h2 className="text-4xl sm:text-5xl font-bold">Ready to Start?</h2>
          <p className="mt-4 text-white/90">Applications take less than 5 minutes. No resume required. Apply today.</p>
          <Link
            href="/apply"
            className="mt-8 inline-flex items-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#F97316] hover:bg-slate-100 transition"
          >
            Apply Now <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <p className="mt-5 text-sm text-white/85">
            Already applied?{' '}
            <Link href="/login" className="font-semibold underline underline-offset-4">
              Log in to check your status →
            </Link>
          </p>
        </div>
      </section>

      <footer className="bg-slate-100 text-slate-700 pt-14 pb-6 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-10">
          <div>
            <p className="font-bold text-xl text-slate-900">Rise & Shine</p>
            <p className="mt-3 text-sm text-slate-600">Building careers that change lives.</p>
            <div className="mt-4 flex items-center gap-3">
              {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                <button key={i} className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center hover:border-[#F97316]">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Quick Links</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/">Home</Link></li>
              <li><button onClick={() => scrollToSection('#about')}>About</button></li>
              <li><button onClick={() => scrollToSection('#benefits')}>Benefits</button></li>
              <li><button onClick={() => scrollToSection('#requirements')}>Requirements</button></li>
              <li><button onClick={() => scrollToSection('#how-it-works')}>How It Works</button></li>
              <li><button onClick={() => scrollToSection('#faq')}>FAQ</button></li>
              <li><Link href="/apply">Apply Now</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Phone: (929) 352-6469</li>
              <li>Email: info@riseandshine.nyc</li>
              <li>Hours: Mon-Fri, 9AM-6PM</li>
              <li>Address: Brooklyn, NY</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-5 border-t border-slate-300 text-xs text-slate-500">
          © 2026 Rise & Shine ABA LLC. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
