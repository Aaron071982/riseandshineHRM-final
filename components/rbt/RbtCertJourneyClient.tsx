'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Laptop,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { PEARSON_VUE_BACB_URL } from '@/lib/rbt/examJourneyConstants'

type FeeRequest = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  note: string | null
  adminNote: string | null
  createdAt: string
  reviewedAt: string | null
}

type Props = {
  firstName: string
  scheduledAt: string | null
  outcome: 'PASSED' | 'FAILED' | null
  feeRequests: FeeRequest[]
}

const STEPS = [
  {
    n: 1,
    title: 'Read the handbook',
    detail: 'Start with the BACB RBT Handbook — it is the rulebook for the whole journey.',
    icon: BookOpen,
  },
  {
    n: 2,
    title: 'Meet eligibility',
    detail: 'Age, education, background check, and 40-hour training — you are already on this path.',
    icon: CheckCircle2,
  },
  {
    n: 3,
    title: 'Apply in your BACB account',
    detail: 'Submit your application when your coursework and paperwork are ready.',
    icon: Laptop,
  },
  {
    n: 4,
    title: 'Schedule & pass the exam',
    detail: 'Book through Pearson VUE, show up prepared, and earn the credential.',
    icon: GraduationCap,
  },
  {
    n: 5,
    title: 'Maintain & recertify',
    detail: 'Keep your certification current — ethics, supervision, and renewal on schedule.',
    icon: Clock,
  },
]

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Stronger pay',
    body: 'Certified RBTs sit in a higher pay band. The credential signals you can deliver quality care — and that is what families and agencies pay for.',
  },
  {
    icon: Award,
    title: 'Career runway',
    body: 'RBT → senior therapist → BCaBA/BCBA. The exam is the door that opens every next step in ABA.',
  },
  {
    icon: Users,
    title: 'More session opportunities',
    body: 'Staffing prefers certified clinicians. Certification makes you easier to place with clients who need consistent care.',
  },
  {
    icon: Zap,
    title: 'Professional credibility',
    body: 'Parents trust the BACB mark. You will feel the difference the first time you introduce yourself as a certified RBT.',
  },
]

const FAQS = [
  {
    q: 'Do I have to take the exam while I work here?',
    a: 'We strongly encourage every hired RBT to pursue certification. It is one of the highest-leverage investments you can make in your career with us.',
  },
  {
    q: 'Will Rise & Shine cover the exam fee?',
    a: 'You can request fee coverage below. We review each request and may approve or deny. We never cover cancellation or no-show fees — if you book, protect that appointment.',
  },
  {
    q: 'Where do I schedule?',
    a: 'Pearson VUE handles BACB exams. Use the official scheduling link on this page, then come back and tell us your date and time.',
  },
  {
    q: 'What if I do not pass the first time?',
    a: 'Report the result here so we can support you. Many people pass on a second attempt with a clearer study plan — failing once is not the end of the story.',
  },
  {
    q: 'What happens after I pass?',
    a: 'Update your result here and tell your supervisor. We will celebrate it on your profile and talk through next steps for pay and placement.',
  },
]

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RbtCertJourneyClient({
  firstName,
  scheduledAt: initialScheduled,
  outcome: initialOutcome,
  feeRequests: initialFees,
}: Props) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [feeNote, setFeeNote] = useState('')
  const [scheduleLocal, setScheduleLocal] = useState(toLocalInputValue(initialScheduled))
  const [scheduledAt, setScheduledAt] = useState(initialScheduled)
  const [outcome, setOutcome] = useState(initialOutcome)
  const [feeRequests, setFeeRequests] = useState(initialFees)

  useEffect(() => {
    void fetch('/api/rbt/exam-journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seen' }),
    })
  }, [])

  const post = (body: Record<string, unknown>) =>
    fetch('/api/rbt/exam-journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    })

  const requestFee = () => {
    startTransition(async () => {
      try {
        const data = await post({ action: 'request_fee', note: feeNote })
        showToast('Fee coverage request submitted', 'success')
        setFeeRequests((prev) => [
          {
            id: typeof data.id === 'string' ? data.id : `temp-${Date.now()}`,
            status: 'PENDING',
            note: feeNote || null,
            adminNote: null,
            createdAt: new Date().toISOString(),
            reviewedAt: null,
          },
          ...prev,
        ])
        setFeeNote('')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not submit', 'error')
      }
    })
  }

  const saveSchedule = () => {
    if (!scheduleLocal) {
      showToast('Pick a date and time', 'error')
      return
    }
    startTransition(async () => {
      try {
        const iso = new Date(scheduleLocal).toISOString()
        await post({ action: 'schedule', scheduledAt: iso })
        setScheduledAt(iso)
        setOutcome(null)
        showToast('Exam date saved — we can see it on your profile', 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      }
    })
  }

  const reportOutcome = (next: 'PASSED' | 'FAILED') => {
    startTransition(async () => {
      try {
        await post({ action: 'outcome', outcome: next })
        setOutcome(next)
        showToast(
          next === 'PASSED' ? 'Congrats — we recorded your pass!' : 'Result recorded — we are here to help you retry',
          next === 'PASSED' ? 'success' : 'success'
        )
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      }
    })
  }

  const pendingFee = feeRequests.some((f) => f.status === 'PENDING')

  return (
    <div className="relative min-h-[70vh] overflow-hidden pb-16">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(227,111,30,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 20%, rgba(59,130,246,0.12), transparent 50%), linear-gradient(180deg, #fff8f2 0%, #ffffff 40%, #f7f4ef 100%)',
        }}
      />

      <div className="mx-auto max-w-4xl space-y-12 px-4 pt-6">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e36f1e] to-[#f5a623] text-white shadow-lg shadow-orange-500/30"
          >
            <Sparkles className="h-8 w-8" />
          </motion.div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e36f1e]">
            Your next level
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-[var(--text-primary)]">
            {firstName}, become a certified RBT
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 dark:text-[var(--text-secondary)]">
            The BACB credential is how you unlock better pay, stronger placements, and a real
            career path in ABA — not just a job. Here is the roadmap, the why, and how we can
            help you get there.
          </p>
          {outcome === 'PASSED' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              You passed — wear that credential with pride. Tell your supervisor if you have not already.
            </motion.div>
          ) : null}
        </motion.section>

        {/* Steps */}
        <section>
          <h2 className="mb-6 text-center text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            How to obtain &amp; maintain RBT certification
          </h2>
          <div className="relative">
            <div className="absolute left-0 right-0 top-8 hidden h-0.5 border-t-2 border-dashed border-[#3b5bdb]/40 md:block" />
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="relative flex flex-col items-center text-center"
                  >
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-lg font-bold text-white shadow-md"
                    >
                      {step.n}
                    </motion.div>
                    <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#1e3a5f]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{step.detail}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            Start with the{' '}
            <a
              href="https://www.bacb.com/rbt/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#e36f1e] underline"
            >
              RBT Handbook
            </a>
            , ethics code, and BACB updates — then book your exam when you are ready.
          </p>
        </section>

        {/* Benefits */}
        <section>
          <h2 className="mb-4 text-center text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Why certification is worth it
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b, i) => {
              const Icon = b.icon
              return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-orange-100 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e36f1e]/15 text-[#e36f1e]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                    {b.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-secondary)]">
                    {b.body}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Fee request */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-[#1e3a5f]/15 bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] p-6 text-white shadow-xl"
        >
          <h2 className="text-xl font-bold">Need help covering the exam fee?</h2>
          <p className="mt-2 text-sm text-white/80">
            Ask us to cover the test fee. We approve or deny on a case-by-case basis.
            <strong className="text-amber-200"> We do not cover cancellation or no-show fees</strong>
            — only book a seat you can keep.
          </p>
          {pendingFee ? (
            <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">
              You have a pending request. We will update you when it is reviewed.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <Textarea
                value={feeNote}
                onChange={(e) => setFeeNote(e.target.value)}
                placeholder="Optional note (timeline, hardship, etc.)"
                className="min-h-[80px] border-white/20 bg-white/10 text-white placeholder:text-white/50"
              />
              <Button
                disabled={pending}
                onClick={requestFee}
                className="bg-[#e36f1e] hover:bg-[#c45a1a] text-white"
              >
                Request fee coverage
              </Button>
            </div>
          )}
          {feeRequests.length > 0 ? (
            <ul className="mt-4 space-y-2 text-xs text-white/70">
              {feeRequests.slice(0, 3).map((f) => (
                <li key={f.id}>
                  {new Date(f.createdAt).toLocaleDateString()} —{' '}
                  <span className="font-semibold text-white">{f.status}</span>
                  {f.adminNote ? ` · ${f.adminNote}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </motion.section>

        {/* Schedule exam */}
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm dark:bg-[var(--bg-elevated)]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Schedule your exam
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Book through Pearson VUE, then tell us when you are sitting so we can cheer you on
            (and see it on your admin profile).
          </p>
          <a
            href={PEARSON_VUE_BACB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3b5bdb] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#2f4bc0]"
          >
            Schedule on Pearson VUE
            <ExternalLink className="h-4 w-4" />
          </a>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm">
              <span className="font-medium text-gray-700">My exam date &amp; time</span>
              <Input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                className="mt-1"
              />
            </label>
            <Button disabled={pending} onClick={saveSchedule} variant="outline">
              Save exam date
            </Button>
          </div>
          {scheduledAt ? (
            <p className="mt-3 text-sm text-gray-600">
              On file:{' '}
              <strong>
                {new Date(scheduledAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </strong>
            </p>
          ) : null}

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium text-gray-800">After the exam — how did it go?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => reportOutcome('PASSED')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                I passed
              </Button>
              <Button
                disabled={pending}
                variant="outline"
                onClick={() => reportOutcome('FAILED')}
              >
                I did not pass this time
              </Button>
            </div>
            {outcome ? (
              <p className="mt-2 text-sm text-gray-600">
                Latest result on file: <strong>{outcome}</strong>
              </p>
            ) : null}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="mb-4 flex items-center justify-center gap-2 text-xl font-bold text-gray-900">
            <HelpCircle className="h-5 w-5 text-[#e36f1e]" />
            FAQ
          </h2>
          <div className="space-y-2">
            {FAQS.map((item, i) => {
              const open = openFaq === i
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[var(--bg-elevated)]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-900"
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    {item.q}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="border-t border-line px-4 py-3 text-sm text-gray-600">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">
          Questions? Message admin from your{' '}
          <Link href="/rbt/profile" className="underline">
            profile
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
