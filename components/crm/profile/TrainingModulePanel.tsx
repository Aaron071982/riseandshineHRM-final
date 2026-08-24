'use client'

import { useMemo, useState, useTransition } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Eye,
  FileCheck,
  FileSearch,
  FileSignature,
  FileText,
  FolderCheck,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Network,
  PenLine,
  Phone,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { toggleTrainingStepCompletion } from '@/lib/crm/training/actions'
import { TRAINING_MODULE_ROLE_LABELS } from '@/lib/crm/training/constants'
import { youtubeEmbedUrl } from '@/lib/crm/training/youtube'
import { ProgressRing } from '@/components/crm/shared/ProgressRing'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle,
  ClipboardList,
  Eye,
  FileCheck,
  FileSearch,
  FileSignature,
  FileText,
  FolderCheck,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Network,
  PenLine,
  Phone,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
}

export type TrainingModuleView = {
  id: string
  crmRole: string
  title: string
  summary: string | null
  goalStatement: string | null
  completedCount: number
  totalSteps: number
  percent: number
  steps: {
    id: string
    stepNumber: number
    slug: string
    title: string
    body: string
    icon: string | null
    completed: boolean
  }[]
  videos?: {
    id: string
    url: string
    videoId: string
    title: string | null
    position: number
  }[]
}

function StepIcon({ name }: { name: string | null }) {
  const Icon = (name && ICON_MAP[name]) || Circle
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--sunrise-soft)] to-[var(--sunrise)]/25 text-[var(--sunrise-dark)] shadow-sm">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

export function TrainingModulePanel({
  module: mod,
  targetUserId,
  readOnly = false,
}: {
  module: TrainingModuleView
  targetUserId: string
  readOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(
    mod.steps.find((s) => !s.completed)?.id ?? mod.steps[0]?.id ?? null
  )

  const roleLabel =
    TRAINING_MODULE_ROLE_LABELS[
      mod.crmRole as keyof typeof TRAINING_MODULE_ROLE_LABELS
    ] ?? mod.crmRole

  const onToggle = (stepId: string, completed: boolean) => {
    if (readOnly) return
    setError('')
    startTransition(async () => {
      const res = await toggleTrainingStepCompletion(
        stepId,
        !completed,
        targetUserId
      )
      if (!res.ok) setError(res.error)
    })
  }

  const progressColor = useMemo(() => {
    if (mod.percent >= 100) return 'bg-[var(--green)]'
    if (mod.percent >= 50) return 'bg-[var(--sunrise)]'
    return 'bg-[var(--sunrise-dark)]'
  }, [mod.percent])

  return (
    <section className="crm-card overflow-hidden">
      <div className="border-b border-line bg-gradient-to-r from-[var(--sunrise-soft)]/50 to-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--brand)]">
              {roleLabel}
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">{mod.title}</h3>
            {mod.summary && (
              <p className="mt-1 max-w-2xl text-sm text-quiet">{mod.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing percent={mod.percent} size={56} stroke={5} />
            <div className="text-xs text-quiet tabular-nums">
              <span className="font-semibold text-ink">{mod.completedCount}</span> / {mod.totalSteps} steps
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line-2">
          <div
            className={cn('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${mod.percent}%` }}
          />
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">

      {mod.goalStatement && (
        <blockquote className="rounded-xl border border-[var(--sunrise)]/25 bg-gradient-to-r from-[var(--sunrise-soft)] to-transparent px-4 py-3 text-sm italic text-ink">
          {mod.goalStatement}
        </blockquote>
      )}

      {(mod.videos?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h4 className="font-display text-base font-semibold text-ink">
            Videos &amp; Guides
          </h4>
          <div className="grid gap-4 sm:grid-cols-1">
            {mod.videos!.map((video) => (
              <div key={video.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                {video.title && (
                  <p className="border-b border-line px-3 py-2 text-sm font-medium text-ink">
                    {video.title}
                  </p>
                )}
                <div className="relative aspect-video w-full bg-[var(--espresso)]/5">
                  <iframe
                    src={youtubeEmbedUrl(video.videoId)}
                    title={video.title || 'Training video'}
                    loading="lazy"
                    allowFullScreen
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="text-sm text-[var(--urgent)]" role="alert">
          {error}
        </p>
      )}

      <ol className="space-y-2">
        {mod.steps.map((step) => {
          const open = expanded === step.id
          return (
            <li
              key={step.id}
              className={cn(
                'rounded-xl border transition-all duration-200',
                step.completed
                  ? 'border-[var(--green)]/35 bg-[var(--green-bg)]/50 shadow-sm'
                  : open
                    ? 'border-[var(--brand)]/30 bg-[var(--sunrise-soft)]/40 shadow-sm ring-1 ring-[var(--brand)]/15'
                    : 'border-line bg-surface hover:border-[var(--sunrise)]/25'
              )}
            >
              <div className="flex items-start gap-3 p-3">
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onToggle(step.id, step.completed)}
                    className="mt-0.5 shrink-0 text-[var(--sunrise-dark)] hover:text-[var(--green)] disabled:opacity-50"
                    aria-label={
                      step.completed
                        ? `Mark step ${step.stepNumber} incomplete`
                        : `Mark step ${step.stepNumber} complete`
                    }
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--green)]" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                ) : (
                  <span className="mt-0.5 shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--green)]" />
                    ) : (
                      <Circle className="h-5 w-5 text-faint" />
                    )}
                  </span>
                )}
                <StepIcon name={step.icon} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : step.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold tabular-nums text-[var(--sunrise-dark)]">
                        {step.stepNumber}.
                      </span>
                      <span className="font-medium text-ink">{step.title}</span>
                    </div>
                  </button>
                  {open && (
                    <p className="mt-2 text-sm leading-relaxed text-quiet">
                      {step.body}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      </div>
    </section>
  )
}
