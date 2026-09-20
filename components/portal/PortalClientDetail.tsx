'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { OverviewPanel } from '@/components/crm/NotesPanel'
import { AuthorizationPanel } from '@/components/crm/AuthorizationPanel'
import { TreatmentAssessmentPanel } from '@/components/crm/assessment/TreatmentAssessmentPanel'
import { SchedulePanel } from '@/components/crm/SchedulePanel'
import type { ClientCrmDetailData } from '@/lib/crm/loadClientDetail'
import { STAGE_LABELS } from '@/lib/crm/stages'
import { derivePortalLifecycle } from '@/lib/crm/portalLifecycle'
import { PortalStageStrip } from '@/components/portal/PortalStageStrip'
import { cn } from '@/lib/utils'

type TabId = 'overview' | 'authorization' | 'assessment' | 'schedule'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'schedule', label: 'Schedule' },
]

function resolveTab(value?: string | null): TabId {
  if (value && TABS.some((t) => t.id === value)) return value as TabId
  return 'overview'
}

export type PortalClientDetailData = {
  client: ClientCrmDetailData['client']
  weeklyScheduleHours: number
  treatmentAssessment: ClientCrmDetailData['treatmentAssessment']
}

export function PortalClientDetail({
  data,
  initialTab,
}: {
  data: PortalClientDetailData
  initialTab?: string | null
}) {
  const { client, weeklyScheduleHours, treatmentAssessment } = data
  const [tab, setTab] = useState<TabId>(() => resolveTab(initialTab))

  useEffect(() => {
    setTab(resolveTab(initialTab))
  }, [initialTab])

  const stageLabel =
    STAGE_LABELS[client.stage as keyof typeof STAGE_LABELS] ?? client.stage

  const lifecycle = useMemo(
    () =>
      derivePortalLifecycle({
        stage: client.stage,
        assessmentStatus: treatmentAssessment?.assessments?.[0]?.status ?? null,
        hasTherapistAssigned: client.btAssignments.some(
          (a) => a.status === 'ACTIVE'
        ),
      }),
    [client, treatmentAssessment]
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 pb-16 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/portal"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--portal-line)] bg-white px-3 text-sm text-[var(--muted-ink)] hover:bg-[var(--portal-paper)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Your clients
          </Link>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--espresso)] sm:text-3xl">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-sm text-[var(--muted-ink)]">
              <span className="tabular-nums">{client.clientCode}</span>
              <span className="mx-2 text-[var(--portal-line)]">·</span>
              <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--portal-orange)_14%,white)] px-2 py-0.5 text-xs font-medium text-[var(--espresso)]">
                {stageLabel}
              </span>
            </p>
          </div>
        </div>
        <div className="hidden min-w-[12rem] rounded-[14px] border border-[var(--portal-line)] bg-white px-4 py-3 shadow-[var(--portal-shadow)] sm:block">
          <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Lifecycle
          </p>
          <PortalStageStrip lifecycle={lifecycle} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--portal-line)] pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border border-b-white border-[var(--portal-line)] -mb-px bg-white text-[var(--portal-orange)]'
                : 'text-[var(--muted-ink)] hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-1">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[var(--portal-line)] bg-white p-4 shadow-[var(--portal-shadow)] sm:hidden">
              <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                Lifecycle
              </p>
              <PortalStageStrip lifecycle={lifecycle} />
            </div>
            <OverviewPanel
              client={client}
              canEdit={false}
              canAssignPortalBcba={false}
            />
          </div>
        )}

        {tab === 'authorization' && (
          <AuthorizationPanel
            clientId={client.id}
            authorizations={client.authorizations}
            canEdit={false}
            authRequired={client.authRequired}
            paAutoSatisfied={!client.authRequired}
          />
        )}

        {tab === 'assessment' && treatmentAssessment?.canView && (
          <TreatmentAssessmentPanel
            clientId={client.id}
            clientCode={client.clientCode}
            assessments={treatmentAssessment.assessments ?? []}
            hasAssessmentOnFile={treatmentAssessment.hasAssessmentOnFile ?? false}
            canEdit={treatmentAssessment.canEdit ?? false}
            canUpload={treatmentAssessment.canUpload ?? false}
            basePath="/portal"
          />
        )}

        {tab === 'assessment' && !treatmentAssessment?.canView && (
          <p className="rounded-xl border border-[var(--portal-line)] bg-white px-4 py-6 text-sm text-[var(--muted-ink)]">
            Assessment access is not available for this account. Contact an
            administrator if you need it enabled.
          </p>
        )}

        {tab === 'schedule' && (
          <div className="space-y-3">
            <p className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)] px-4 py-3 text-sm text-[var(--muted-ink)]">
              Schedule is view-only here. To request changes, reach out to
              staffing or your clinical lead.
            </p>
            <SchedulePanel
              clientId={client.id}
              slots={client.scheduleAssignments}
              weeklyHours={weeklyScheduleHours}
              authHours={client.authHours}
              assignedRbtIds={client.btAssignments
                .map((a) => a.rbtProfileId)
                .filter((id): id is string => !!id)}
              canEdit={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
