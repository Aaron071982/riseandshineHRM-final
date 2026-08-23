'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CrmRole } from '@prisma/client'
import { BookOpen, History, Mail, Phone, User, Users } from 'lucide-react'
import type { StaffProfileData } from '@/lib/crm/profile/loadStaffProfile'
import { CRM_ROLE_CHIP, stageChipClass } from '@/lib/crm/profile/uiTheme'
import { TRAINING_MODULE_ROLE_LABELS } from '@/lib/crm/training/constants'
import { CrmAvatar } from '@/components/crm/shared/CrmAvatar'
import { ProgressRing } from '@/components/crm/shared/ProgressRing'
import { TrainingModulePanel } from '@/components/crm/profile/TrainingModulePanel'
import { TrainingAdminEditor } from '@/components/crm/profile/TrainingAdminEditor'
import { cn } from '@/lib/utils'

type Tab = 'info' | 'clients' | 'history' | 'training'

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function roleLabel(role: string) {
  return (
    TRAINING_MODULE_ROLE_LABELS[
      role as keyof typeof TRAINING_MODULE_ROLE_LABELS
    ] ?? role.replace(/_/g, ' ')
  )
}

export function StaffProfileClient({ data }: { data: StaffProfileData }) {
  const [tab, setTab] = useState<Tab>('info')

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'info', label: 'Profile', icon: User },
    { id: 'clients', label: 'My clients', icon: Users },
    { id: 'history', label: 'Client history', icon: History },
    { id: 'training', label: 'My training', icon: BookOpen },
  ]

  const overallTraining = data.trainingModules.reduce(
    (acc: { done: number; total: number }, m: StaffProfileData['trainingModules'][number]) => ({
      done: acc.done + m.completedCount,
      total: acc.total + m.totalSteps,
    }),
    { done: 0, total: 0 }
  )
  const overallPercent = overallTraining.total
    ? Math.round((overallTraining.done / overallTraining.total) * 100)
    : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="crm-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-[var(--sunrise-soft)] via-surface to-surface px-5 py-6 sm:px-6">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[var(--sunrise)]/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start gap-4">
            <CrmAvatar
              name={data.target.displayName}
              email={data.target.email}
              size={72}
              seed={data.target.id}
              className="ring-4 ring-white shadow-md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--brand)]">
                Rise & Shine CRM
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {data.isSelf ? 'My profile' : data.target.displayName}
              </h1>
              {data.target.displayTitle && (
                <p className="mt-0.5 text-sm font-medium text-quiet">
                  {data.target.displayTitle}
                </p>
              )}
              {!data.isSelf && (
                <p className="mt-1 text-xs text-faint">
                  Manager view — training & claim history
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {data.target.crmRoles.map((role) => (
                  <span
                    key={role}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                      CRM_ROLE_CHIP[role as CrmRole]
                    )}
                  >
                    {roleLabel(role)}
                  </span>
                ))}
              </div>
            </div>
            {overallTraining.total > 0 && (
              <div className="flex flex-col items-center gap-1">
                <ProgressRing percent={overallPercent} size={64} stroke={5} />
                <span className="text-[10px] font-medium text-quiet">Training</span>
              </div>
            )}
          </div>

          <div className="relative mt-5 flex flex-wrap gap-4 text-sm">
            {data.target.email && (
              <span className="inline-flex items-center gap-1.5 text-quiet">
                <Mail className="h-4 w-4 text-[var(--brand)]" />
                {data.target.email}
              </span>
            )}
            {data.target.displayPhone && (
              <span className="inline-flex items-center gap-1.5 text-quiet">
                <Phone className="h-4 w-4 text-[var(--brand)]" />
                {data.target.displayPhone}
              </span>
            )}
            {data.target.profile?.department && (
              <span className="text-quiet">{data.target.profile.department}</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === id
                ? 'bg-[var(--espresso)] text-white shadow-sm'
                : 'text-quiet hover:bg-[var(--sunrise-soft)] hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {data.isSelf || id === 'info' || id === 'training'
              ? label
              : label.replace(/^My /, '')}
            {id === 'training' && overallTraining.total > 0 && tab !== 'training' && (
              <span className="ml-1 rounded-full bg-[var(--sunrise)]/30 px-1.5 text-[10px] tabular-nums font-semibold">
                {overallPercent}%
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <section className="crm-card space-y-4 p-5">
          {data.target.profile?.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">About</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{data.target.profile.bio}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--bg)] p-3">
              <p className="text-xs text-faint">Active clients</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
                {data.activeClaims.length}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--bg)] p-3">
              <p className="text-xs text-faint">Claim history</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
                {data.claimHistory.length}
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-[var(--sunrise-soft)] to-surface p-3">
              <p className="text-xs text-faint">Training</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[var(--brand)]">
                {overallPercent}%
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === 'clients' && (
        <ClaimCards
          rows={data.activeClaims}
          empty="No active claimed clients — claim clients from your department queue."
        />
      )}

      {tab === 'history' && (
        <ClaimCards
          rows={data.claimHistory}
          empty="No client claim history yet."
          showReleased
        />
      )}

      {tab === 'training' && (
        <div className="space-y-6">
          {data.viewer.canEditTrainingContent && (
            <TrainingAdminEditor viewerUserId={data.viewer.id} />
          )}

          {data.trainingModules.length === 0 ? (
            <div className="crm-card flex flex-col items-center px-6 py-12 text-center">
              <BookOpen className="h-10 w-10 text-[var(--brand)]" />
              <p className="mt-3 font-display font-semibold text-ink">No training modules yet</p>
              <p className="mt-1 text-sm text-quiet">
                Modules appear when CRM roles are assigned.
              </p>
            </div>
          ) : (
            data.trainingModules.map((mod: StaffProfileData['trainingModules'][number]) => (
              <TrainingModulePanel
                key={mod.id}
                module={mod}
                targetUserId={data.target.id}
                readOnly={!data.isSelf}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ClaimCards({
  rows,
  empty,
  showReleased = false,
}: {
  rows: StaffProfileData['activeClaims']
  empty: string
  showReleased?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="crm-card px-6 py-12 text-center">
        <Users className="mx-auto h-10 w-10 text-faint" />
        <p className="mt-3 text-sm text-quiet">{empty}</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => {
        const name = `${row.serviceClient.firstName} ${row.serviceClient.lastName}`
        const stage = row.serviceClient.stage.replace(/_/g, ' ')
        return (
          <li
            key={row.id}
            className="crm-card crm-card-hover group overflow-hidden transition-all"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                {row.canViewClient ? (
                  <Link
                    href={`/client-services/clients/${row.serviceClient.id}`}
                    className="font-display text-base font-semibold text-ink group-hover:text-[var(--brand)]"
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="font-display text-base font-semibold text-quiet">{name}</span>
                )}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    stageChipClass(row.serviceClient.stage)
                  )}
                >
                  {stage}
                </span>
              </div>
              <p className="mt-1 text-xs text-faint">{row.serviceClient.clientCode}</p>
              {row.serviceClient.currentOwnerDept && (
                <p className="mt-2 text-xs text-quiet">
                  {row.serviceClient.currentOwnerDept.replace(/_/g, ' ')}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-faint tabular-nums">
                <span>Claimed {formatDate(row.claimedAt)}</span>
                {showReleased && (
                  <span>
                    {row.releasedAt ? `Released ${formatDate(row.releasedAt)}` : 'Active'}
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
